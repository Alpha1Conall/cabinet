/**
 * Drives the Microsoft device-code sign-in from Cabinet's own backend, so the
 * connect panel can authenticate a *personal* Microsoft account before any
 * agent runs — instead of deferring login to first agent use.
 *
 * We don't reimplement OAuth: we spawn the same server's one-shot login command
 * (`@softeria/ms-365-mcp-server --login`), which performs the device-code flow
 * and caches the token where the MCP server reads it later. We parse the
 * device-code URL + code from its output, hand them to the UI, and let the
 * process keep polling Microsoft in the background until the user finishes.
 *
 * Personal flow only: no Entra credentials are passed, so the server uses its
 * built-in public-client app. Work/school accounts paste their own app and use
 * the deferred (first-use) login instead.
 *
 * The session registry is stashed on globalThis so it survives Next.js HMR in
 * dev. This is a local, single-instance feature — no cross-process store needed.
 */

import { spawn, type ChildProcess } from "child_process";
import { randomUUID } from "crypto";

export type LoginStatus = "pending" | "success" | "error" | "expired";

interface LoginSession {
  id: string;
  proc: ChildProcess;
  status: LoginStatus;
  verificationUri?: string;
  userCode?: string;
  error?: string;
  startedAt: number;
  output: string;
}

const g = globalThis as unknown as {
  __msLoginSessions?: Map<string, LoginSession>;
};
const sessions = (g.__msLoginSessions ??= new Map<string, LoginSession>());

/** Device codes are valid ~15 min; expire the session a touch after that. */
const DEVICE_CODE_TIMEOUT_MS = 16 * 60 * 1000;
/** Allow first-run `npx` download + the code to be printed. */
const CODE_WAIT_MS = 120_000;

// Device-code message, e.g.:
//   "...open the page https://login.microsoft.com/device and enter the code LF25UZJJQ to authenticate."
// The verification URL host/path varies (login.microsoft.com/device,
// microsoft.com/devicelogin, login.microsoftonline.com/...), so match any
// Microsoft URL in the message rather than a fixed path.
const URL_RE = /(https?:\/\/\S*microsoft\S*)/i;
const CODE_RE = /enter the code\s+([A-Z0-9-]{6,})|code[:\s]+([A-Z0-9-]{6,})/i;
const SUCCESS_RE = /login successful|logged in|authentication (?:successful|complete)/i;

function parseDeviceCode(text: string): { uri?: string; code?: string } {
  const uri = URL_RE.exec(text)?.[1];
  const m = CODE_RE.exec(text);
  const code = m?.[1] ?? m?.[2];
  return { uri, code };
}

export function getLoginStatus(sessionId: string): {
  status: LoginStatus;
  verificationUri?: string;
  userCode?: string;
  error?: string;
} | null {
  const s = sessions.get(sessionId);
  if (!s) return null;
  if (s.status === "pending" && Date.now() - s.startedAt > DEVICE_CODE_TIMEOUT_MS) {
    s.status = "expired";
    try {
      s.proc.kill();
    } catch {
      /* already gone */
    }
  }
  return {
    status: s.status,
    verificationUri: s.verificationUri,
    userCode: s.userCode,
    error: s.error,
  };
}

export function cancelLogin(sessionId: string): boolean {
  const s = sessions.get(sessionId);
  if (!s) return false;
  try {
    s.proc.kill();
  } catch {
    /* already gone */
  }
  sessions.delete(sessionId);
  return true;
}

/**
 * Spawn the device-code login and resolve once the URL + code are available.
 * The child keeps running (polling Microsoft) afterwards; poll `getLoginStatus`
 * to learn when the user has finished.
 */
export function startDeviceLogin(): Promise<{
  sessionId: string;
  verificationUri: string;
  userCode: string;
}> {
  const id = randomUUID();
  const proc = spawn("npx", ["-y", "@softeria/ms-365-mcp-server", "--login"], {
    env: process.env, // no MS365_MCP_* → built-in public-client app (personal)
    stdio: ["ignore", "pipe", "pipe"],
  });
  const session: LoginSession = {
    id,
    proc,
    status: "pending",
    startedAt: Date.now(),
    output: "",
  };
  sessions.set(id, session);

  return new Promise((resolve, reject) => {
    let settled = false;
    const fail = (message: string) => {
      session.status = "error";
      session.error = message;
      if (!settled) {
        settled = true;
        try {
          proc.kill();
        } catch {
          /* already gone */
        }
        reject(new Error(message));
      }
    };

    const onData = (buf: Buffer) => {
      session.output += buf.toString();
      if (!session.verificationUri || !session.userCode) {
        const { uri, code } = parseDeviceCode(session.output);
        if (uri) session.verificationUri = uri;
        if (code) session.userCode = code;
        if (!settled && session.verificationUri && session.userCode) {
          settled = true;
          resolve({
            sessionId: id,
            verificationUri: session.verificationUri,
            userCode: session.userCode,
          });
        }
      }
      if (SUCCESS_RE.test(session.output)) session.status = "success";
    };

    proc.stdout?.on("data", onData);
    proc.stderr?.on("data", onData);

    proc.on("error", (err) => fail(err.message));
    proc.on("exit", (code) => {
      if (session.status !== "success") {
        if (code === 0) session.status = "success";
        else if (session.status === "pending") {
          session.status = "error";
          session.error ??= `Sign-in process exited with code ${code}`;
        }
      }
      // Exited before ever emitting a device code → the start call failed.
      if (!settled) fail(session.error ?? "Sign-in ended before a code was issued");
    });

    setTimeout(() => {
      if (!settled) fail("Timed out waiting for the Microsoft device code");
    }, CODE_WAIT_MS);
  });
}
