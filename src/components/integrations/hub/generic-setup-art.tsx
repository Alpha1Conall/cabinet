"use client";

// stepArtFor returns render callbacks ((index) => ReactNode), not components —
// react/display-name false-positives on those inline arrows.
/* eslint-disable react/display-name */

import type { ReactNode } from "react";
import { Check, CornerDownRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { DiscordStepArt } from "@/components/integrations/hub/discord-setup-art";
import { TelegramStepArt } from "@/components/integrations/hub/telegram-setup-art";

/**
 * Per-step "mini-mockup" art for the setup guide of EVERY integration.
 *
 * Most connectors share a setup *pattern*, so rather than hand-draw 50 bespoke
 * mockups we render reusable, brand-parameterized ones keyed by pattern:
 *   - official one-click OAuth  → a consent-screen mock
 *   - bring-your-own URL        → get-URL + paste-URL mocks
 *   - Microsoft 365             → Azure app register / scopes / secret
 *   - Shopify / Figma / Salesforce → tailored single-screen mocks
 * Discord & Telegram keep their fully bespoke art. `stepArtFor` is the
 * dispatcher the detail page calls.
 */

export function stepArtFor(opts: {
  id: string;
  label: string;
  brand: string;
  authBackend: string;
  transport: string;
  hasUrlCredential: boolean;
}): ((index: number) => ReactNode) | undefined {
  const { id, label, brand, authBackend, transport, hasUrlCredential } = opts;

  if (id === "discord") return (i) => <DiscordStepArt step={i} brand={brand} />;
  if (id === "telegram") return (i) => <TelegramStepArt step={i} brand={brand} />;
  if (id === "microsoft-365") return (i) => <MicrosoftArt step={i} brand={brand} />;
  if (id === "shopify") return () => <ShopifyArt brand={brand} />;
  if (id === "figma") return () => <FigmaArt brand={brand} />;
  if (id === "salesforce") return () => <SalesforceArt brand={brand} />;

  if (transport === "http" && authBackend === "cli-pkce") {
    return (i) => <OAuthConsentArt step={i} label={label} brand={brand} />;
  }
  if (authBackend === "token" && hasUrlCredential) {
    return (i) => <ByoUrlArt step={i} label={label} brand={brand} />;
  }
  return undefined;
}

/* ── pattern renderers ──────────────────────────────────────────────────── */

/** Official one-click OAuth — the browser consent screen (step 0 only). */
function OAuthConsentArt({ step, label, brand }: { step: number; label: string; brand: string }) {
  if (step !== 0) return null;
  return (
    <MockWindow title={`Authorize · ${label}`} brand={brand}>
      <div className="flex flex-col items-center text-center">
        <Avatar brand={brand}>{label.charAt(0)}</Avatar>
        <div className="mt-2 text-[11px] text-foreground">
          <b>Cabinet</b> wants to access your <b>{label}</b> account
        </div>
        <div className="mt-2 w-full space-y-1 text-left">
          <CheckRow brand={brand}>Read your {label} data</CheckRow>
          <CheckRow brand={brand}>Act on your behalf</CheckRow>
        </div>
        <div className="mt-3 flex w-full items-center justify-center gap-2">
          <BtnMock brand={brand}>Authorize</BtnMock>
          <BtnMock>Cancel</BtnMock>
        </div>
      </div>
      <Hint brand={brand}>
        Your agent&apos;s CLI opens this in the browser the first time — approve once, nothing to paste.
      </Hint>
    </MockWindow>
  );
}

/** Bring-your-own remote — copy your URL (0), then paste it (1). */
function ByoUrlArt({ step, label, brand }: { step: number; label: string; brand: string }) {
  if (step === 0) {
    return (
      <MockWindow title={`${label} · MCP server`} brand={brand}>
        <div className="text-[10px] text-muted-foreground">Your server URL</div>
        <div className="mt-1 flex items-center gap-2">
          <div className="flex-1 truncate rounded-md bg-foreground/[0.06] px-2 py-1.5 font-mono text-[10px] text-muted-foreground">
            https://mcp.example.com/…/mcp
          </div>
          <BtnMock brand={brand}>Copy</BtnMock>
        </div>
        <Hint brand={brand}>
          Copy your MCP URL from {label} — or a hosted gateway (Composio, Pipedream, Zapier).
        </Hint>
      </MockWindow>
    );
  }
  return (
    <MockWindow title={`Connect ${label}`} brand={brand}>
      <div className="text-[10px] font-medium text-foreground">{label} MCP server URL</div>
      <FieldMock>https://…/mcp</FieldMock>
      <BtnMock brand={brand} full>
        Connect
      </BtnMock>
      <Hint brand={brand}>Paste it into the field on the right →</Hint>
    </MockWindow>
  );
}

/** Microsoft 365 — Azure app registration / Graph scopes / client secret. */
function MicrosoftArt({ step, brand }: { step: number; brand: string }) {
  if (step === 0) {
    return (
      <MockWindow title="Azure · App registrations" brand={brand}>
        <div className="flex items-center justify-between">
          <span className="font-medium text-foreground">App registrations</span>
          <BtnMock brand={brand}>+ New registration</BtnMock>
        </div>
        <div className="mt-2 space-y-1">
          <KvRow k="Application (client) ID" v="0000…-0000" />
          <KvRow k="Directory (tenant) ID" v="common" />
        </div>
        <Hint brand={brand}>Register an app, then copy the Client &amp; Tenant IDs.</Hint>
      </MockWindow>
    );
  }
  if (step === 1) {
    return (
      <MockWindow title="API permissions · Microsoft Graph" brand={brand}>
        <div className="grid grid-cols-1 gap-1">
          <CheckRow brand={brand}>Mail.ReadWrite</CheckRow>
          <CheckRow brand={brand}>Calendars.ReadWrite</CheckRow>
          <CheckRow brand={brand}>Chat.ReadWrite</CheckRow>
          <CheckRow brand={brand}>Sites.Read.All · Files.Read.All</CheckRow>
        </div>
        <div className="mt-2">
          <BtnMock brand={brand}>✓ Grant admin consent</BtnMock>
        </div>
        <Hint brand={brand}>Add the delegated Graph scopes, then grant consent.</Hint>
      </MockWindow>
    );
  }
  return (
    <MockWindow title="Certificates &amp; secrets" brand={brand}>
      <div className="flex items-center justify-between">
        <span className="text-foreground">New client secret</span>
        <BtnMock brand={brand}>+ New</BtnMock>
      </div>
      <div className="mt-2 flex items-center justify-between rounded-md bg-foreground/[0.06] px-2 py-1.5">
        <span className="font-mono text-[10px] text-muted-foreground">••••••••••••••••</span>
        <span className="text-[10px] font-medium" style={{ color: brand }}>
          Copy
        </span>
      </div>
      <Hint brand={brand}>Create a secret, then paste Client ID, Tenant ID &amp; Secret below.</Hint>
    </MockWindow>
  );
}

/** Shopify — runs locally via npx (docs + GraphQL), no sign-in. */
function ShopifyArt({ brand }: { brand: string }) {
  return (
    <MockWindow title="Terminal" brand={brand}>
      <div className="rounded-md bg-foreground/[0.06] p-2 font-mono text-[10px] leading-relaxed">
        <div className="text-muted-foreground">
          <span style={{ color: brand }}>$</span> npx -y @shopify/dev-mcp@latest
        </div>
        <div className="text-foreground">✓ Shopify dev MCP ready — docs + GraphQL schema</div>
      </div>
      <Hint brand={brand}>No sign-in — it runs locally. Just click Connect.</Hint>
    </MockWindow>
  );
}

/** Figma — enable the Dev Mode MCP server in the desktop app. */
function FigmaArt({ brand }: { brand: string }) {
  return (
    <MockWindow title="Figma · Preferences" brand={brand}>
      <ToggleRow label="Enable Dev Mode MCP Server" brand={brand} on />
      <div className="mt-2 rounded-md bg-foreground/[0.06] px-2 py-1 font-mono text-[10px] text-muted-foreground">
        Server: http://127.0.0.1:3845/mcp
      </div>
      <Hint brand={brand}>Turn it on in the Figma desktop app, then click Connect.</Hint>
    </MockWindow>
  );
}

/** Salesforce — authorize an org via the sf CLI. */
function SalesforceArt({ brand }: { brand: string }) {
  return (
    <MockWindow title="Terminal" brand={brand}>
      <div className="rounded-md bg-foreground/[0.06] p-2 font-mono text-[10px] leading-relaxed">
        <div className="text-muted-foreground">
          <span style={{ color: brand }}>$</span> sf org login web
        </div>
        <div className="text-foreground">✓ Logged in to org — DEFAULT_TARGET_ORG</div>
      </div>
      <Hint brand={brand}>Authorize your org once; the MCP uses your CLI&apos;s default org.</Hint>
    </MockWindow>
  );
}

/* ── primitives ─────────────────────────────────────────────────────────── */

function MockWindow({ title, brand, children }: { title: string; brand: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card text-[11px] shadow-sm">
      <div className="flex items-center gap-1.5 border-b border-border bg-muted/40 px-2.5 py-1.5">
        <span className="h-2 w-2 rounded-full" style={{ background: `${brand}66` }} />
        <span className="h-2 w-2 rounded-full bg-foreground/15" />
        <span className="h-2 w-2 rounded-full bg-foreground/15" />
        <span className="ml-1.5 truncate text-[10px] font-medium text-muted-foreground">{title}</span>
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

function Hint({ brand, children }: { brand: string; children: ReactNode }) {
  return (
    <div className="mt-2.5 flex items-start gap-1.5 text-[10.5px] leading-snug text-muted-foreground">
      <CornerDownRight className="mt-px h-3 w-3 shrink-0" style={{ color: brand }} />
      <span>{children}</span>
    </div>
  );
}

function Avatar({ brand, children }: { brand: string; children: ReactNode }) {
  return (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl text-[13px] font-bold uppercase text-white"
      style={{ background: brand }}
    >
      {children}
    </span>
  );
}

function CheckRow({ brand, children }: { brand: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 text-[10.5px] text-foreground">
      <span
        className="flex h-3 w-3 shrink-0 items-center justify-center rounded-[3px]"
        style={{ background: brand }}
      >
        <Check className="h-2 w-2 text-white" />
      </span>
      {children}
    </div>
  );
}

function BtnMock({
  brand,
  full,
  children,
}: {
  brand?: string;
  full?: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-md px-2.5 py-1 text-[10px] font-semibold",
        full && "mt-2 w-full",
        brand ? "text-white" : "bg-foreground/[0.06] text-muted-foreground",
      )}
      style={brand ? { background: brand } : undefined}
    >
      {children}
    </span>
  );
}

function FieldMock({ children }: { children: ReactNode }) {
  return (
    <div className="mt-1 rounded-md bg-foreground/[0.06] px-2 py-1.5 font-mono text-[10px] text-muted-foreground">
      {children}
    </div>
  );
}

function KvRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between rounded-md bg-foreground/[0.04] px-2 py-1">
      <span className="text-[10px] text-muted-foreground">{k}</span>
      <span className="font-mono text-[10px] text-foreground">{v}</span>
    </div>
  );
}

function ToggleRow({ label, on, brand }: { label: string; on?: boolean; brand: string }) {
  return (
    <div className="flex items-center justify-between rounded-md px-2 py-1.5" style={{ background: `${brand}14` }}>
      <span className="text-[10.5px] text-foreground">{label}</span>
      <span
        className={cn("relative h-4 w-7 rounded-full", !on && "bg-foreground/15")}
        style={on ? { background: brand } : undefined}
      >
        <span
          className={cn(
            "absolute top-0.5 h-3 w-3 rounded-full bg-white shadow-sm",
            on ? "right-0.5" : "left-0.5",
          )}
        />
      </span>
    </div>
  );
}
