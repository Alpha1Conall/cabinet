# PRD — Rooms (Workspaces) & the Home Switcher

**Status:** Draft (v2 — lighter direction) · **Author:** hilash · **Date:** 2026-05-22
**Driver:** Bring back the home button next to the logo and turn it into a Notion-style
workspace switcher. Let people move between *rooms* (office, study, research…) — and, later,
open any cabinet in its own window.

> **v2 note:** v1 of this PRD proposed flattening into `data/<room>/` with a destructive
> migration and "nothing shared." Investigation showed Cabinet **already** stores every cabinet
> as a self-contained, path-keyed workspace (agents, tasks, jobs, skills). So v2 *surfaces and
> completes* that existing model instead of rebuilding it. No data migration.

---

## 1. Summary

Cabinet's analogy is *your home*, and the file system already mirrors it: every cabinet — at
any depth — is its own workspace, addressed by its path (`cabinetPath`). Agents, tasks,
conversations, jobs, and skills already resolve under `data/<cabinetPath>/`. What's missing is
(a) a way to **see and switch** between your top-level cabinets, (b) per-cabinet **identity**
(icon + theme), and (c) making the two still-global bits (**theme**, **search scope**) follow
the cabinet you're in.

**Rooms** = the top-level cabinets, surfaced in a **home-button switcher** (icon + name → switch
/ edit / add). The **root stays the default room** — no migration. Because the window's scope is
just a `cabinetPath`, "open any cabinet (a room *or* a nested sub-cabinet) in its own window"
falls out almost for free, which is the foundation for multi-window later.

## 2. Goals & non-goals

**Goals**
- One click on the logo → a switcher: current room (icon + name), list, switch, edit, add.
- Per-cabinet **icon** and **theme**, stored in the cabinet's `.cabinet` manifest.
- **Theme** and **search** follow the active cabinet (the two things still global today).
- A window's scope is a `cabinetPath` — so the design is **multi-window-ready** (window per cabinet).
- **No destructive migration.** Reuse the per-cabinet isolation that already exists.

**Non-goals (this pass)**
- Flattening the model or any forced `data/` move. (v1's plan — dropped.)
- Tearing down the existing nested **roll-up** visibility (own / +1 / +2 / all). It stays; new
  rooms just default to "own" (isolated).
- The actual **second-window experience** (Electron multi-window + a "New Window in…" command).
  The app is single-window today (`electron/main.cjs:594`). We make the scope per-window-ready
  now and build the window UX as a fast-follow (§8).
- Cross-cabinet search (search is scoped to the active cabinet's subtree).
- Reworking onboarding's room picker (templated types + starter teams). Separate later PRD.

## 3. Decisions (from product Q&A, 2026-05-22)

| Question | Decision |
|---|---|
| Overall direction | **Lighter — surface what exists.** Rooms = top-level cabinets in a switcher; reuse per-cabinet isolation. *(Reversed v1's flatten+migrate.)* |
| What is a room? | A **top-level cabinet** (direct child of `data/` with a `.cabinet` manifest). The **root is the default room**. Plain folders stay as content; "promote to room" is a one-click action. |
| Home button | **Notion-style switcher** — current room (icon + name), list, switch, edit, add. |
| Window scope / multi-window | A window carries a **`cabinetPath`** (the address), not a new opaque ID. Room = the path's relevant cabinet; "open any cabinet in a window" works on the scope key the code already uses. Multi-window UX is a fast-follow. |
| What's per-cabinet (already) | Agents, tasks/conversations, jobs, skills — **already** keyed by path. We default new rooms to **isolated** (visibility "own", no global agents). |
| Net-new isolation | **Theme** (today global) → per-cabinet. **Search** (today one root DB) → scoped to the active cabinet's subtree. |
| Room metadata | **Extend the `.cabinet` manifest** with `icon` + `theme` (name already exists). No new dotfile. |
| Migration | **None.** Root becomes the default room (its existing `.cabinet` gains icon/theme). Name unchanged but **renameable** in the switcher (e.g. to "Studio"). |
| `.global-agents` | **Kept as opt-in** cross-room agents, default empty. *(Reversed v1's "retire" — no reason to remove working machinery.)* |
| Switch UX | **Instant + subtle crossfade** (reload scoped stores, apply theme behind a quick fade). |
| Onboarding | **Minimal** later; full templated picker is a separate PRD. |
| Caveat (not isolatable) | The **OS-level AI CLI login** lives outside the cabinet, so it's machine-level and shared regardless. Per-cabinet isolation covers everything inside the cabinet. |

---

## 4. Current state — what already exists (and we reuse)

Every cabinet (root or child, any depth) is already a self-contained workspace, keyed by path:

| Concern | Where it lives today | Per-cabinet? |
|---|---|---|
| Agents | `data/<cabinetPath>/.agents/<slug>/` (`persona-manager.ts:41`) | ✅ |
| Tasks / conversations | `data/<cabinetPath>/.agents/.conversations/` (`conversation-store.ts:58`) | ✅ |
| Jobs / automations | `data/<cabinetPath>/.jobs/` (`cabinet-scaffold.ts:114`) | ✅ |
| Skills | `data/<cabinet>/.agents/skills/` (CLAUDE.md rule 15) | ✅ |
| Cabinet identity | `.cabinet` manifest (`id`, `name`, `kind`, …) per cabinet | ✅ |
| Viewer scope | `section.cabinetPath` (`app-store.ts`) | ✅ |
| Create a cabinet | New Cabinet → `/api/cabinets/create` → `scaffoldCabinet()` (writes `.cabinet`, `index.md`, `.agents/`, `.jobs/`, `.cabinet-state/`) | ✅ |
| Roll-up visibility | own / +1 / +2 / all (`visibility.ts`) | ✅ |
| **Theme** | global `localStorage` (`theme-initializer.tsx`, `themes.ts`) | ❌ (make per-cabinet) |
| **Search index / DB** | one root `data/.cabinet.db` | ❌ (scope by path) |
| Cross-cabinet agents | `data/.global-agents/` (`persona-manager.ts:27`) | shared by design |

Also relevant: the home button was simplified in `1a85287` (the `cabinet` wordmark still navigates
home — `sidebar.tsx:184-210`); room *types* with Lucide icons already exist in
`src/lib/onboarding/rooms.ts`; `.cabinet` metadata is read by `overview.ts`. In *this* dev cabinet,
the top-level dirs (`content-creator`, `saas-startup`, …) are **plain folders** (no `.cabinet`), so
only the root is a real cabinet today.

## 5. Design

### 5.1 What a "room" is
- A **room** is a top-level cabinet: a direct child of `data/` whose dir has a `.cabinet` manifest.
- The **root cabinet is the default room** (you start there). You're always scoped to a room
  (`section.cabinetPath` defaults to the root).
- Plain top-level **folders** (no manifest) remain content inside the root. The switcher offers
  **Promote to room** (writes a `.cabinet` via `scaffoldCabinet`, leaving content in place).
- Nested sub-cabinets keep working exactly as today (per-path isolation + roll-up).

### 5.2 The switcher (UI)
Replaces the logo button (`sidebar.tsx:184-210`):
- Trigger: room **icon + name**.
- Dropdown: list of rooms (top-level cabinets) with icon + active check → click to switch;
  **+ Add room**; per-row **Edit** (name, icon, theme); **Promote folder to room** for plain folders.
- Switch = set `section.cabinetPath` to the room, reload the scoped stores (tree/Team/Tasks),
  apply the room's theme — behind a subtle crossfade.
- i18n + RTL like the rest of the sidebar (en + he minimum).

### 5.3 Room metadata (`.cabinet` manifest)
Extend the existing manifest (no new dotfile):
```yaml
schemaVersion: 1
id: marketing-root
name: Marketing            # display name (renameable in the switcher)
kind: root
room:                      # NEW
  icon: briefcase          # Lucide name (from rooms.ts set) or emoji
  theme: paper             # theme name from src/lib/themes.ts; unset → global default
version: 0.1.0
entry: index.md
```

### 5.4 Per-cabinet theme
The only currently-global thing we move per-cabinet. On switch, read `room.theme` from the target
cabinet's `.cabinet`; apply via the existing `applyTheme()` (`themes.ts`); fall back to the global
default when unset. Each window has its own DOM, so per-window themes don't collide.

### 5.5 Scoped search
Keep the single root `data/.cabinet.db` (no per-cabinet DB split). Scope queries by the active
cabinet's **path prefix** so Cmd+K finds only the current room's subtree. Lighter than splitting
DBs and trivially reversible if we ever want cross-room search.

### 5.6 Window scope = `cabinetPath` (multi-window-ready)
A window's scope is the `cabinetPath` it's viewing. The agent/task/conversation/job/skill layers
already accept `cabinetPath` (e.g. the personas route reads `?cabinetPath=`), so a second window in
a different cabinet largely *already* resolves correctly. To finish:
- **Audit `DATA_DIR` sites that assume "root == the active scope"** without taking a `cabinetPath`,
  and make them explicit. This is a *subset* of the 71 `DATA_DIR` references (many are legitimately
  global: install metadata, ports, library, backups), not a wholesale re-root.
- Daemon runs / PTY sessions / scheduled jobs are already created with their `cabinetPath`; keep that.
- The actual "open a second window" command is the fast-follow (§8).

## 6. Migration & compatibility (minimal)
- **No data move.** On first run after this ships: ensure the root `.cabinet` has a `room` block
  (backfill default icon/theme if absent); register the root as the default room.
- Optionally set the root room's display name to **"Studio"** (suggested default; user-renameable),
  or keep its existing name. *(Open question §7.)*
- Existing plain folders are untouched; they appear as content and can be **promoted** to rooms.
- Fully backward compatible: a cabinet with no `room` block just uses defaults + the global theme.

## 7. Open questions (small)
1. **Search.** Scope the shared DB by path prefix (proposed) vs. per-cabinet DB. → *Proposed: shared DB, scoped.*
2. **Room definition.** Rooms = top-level **cabinets** only (proposed) vs. auto-treat every top-level dir as a room. → *Proposed: cabinets only, with one-click promote.*
3. **Default room name.** Keep the root's existing name (renameable) vs. set it to **"Studio"** on first run. → *Proposed: set to "Studio", renameable.*
4. **`.global-agents`.** Keep as opt-in cross-room (proposed, default empty) vs. retire. → *Proposed: keep.*
5. **"Promote folder to room"** in v1 of this feature, or defer to the add/edit phase? → *Proposed: defer to Phase 4.*

## 8. Risks
- **Hidden "root == active" assumptions.** Some `DATA_DIR` sites resolve content without a
  `cabinetPath` and quietly mean "root." For multi-window correctness these must become explicit;
  a path resolved with no scope should **fail loud**, not default to root (cross-room leak).
- **Stale caches on switch.** Tree-store, agent stores, task board, theme must reload on switch;
  audit any store keyed by absolute path or assuming a fixed root.
- **Plain-folder vs cabinet clarity.** The switcher must make "this folder isn't a room yet —
  promote it?" legible, or top-level folders feel missing.
- **Theme flash on switch.** Apply theme before the scoped content paints (reuse ThemeInitializer ordering).

## 9. Phased plan
- **Phase 1 — Switcher + room identity.** Restore the home button as the switcher; read/write the
  `room` block (icon, name) in `.cabinet`; root = default room; switch sets `section.cabinetPath`
  + reloads scoped stores. (Theme + search still global.)
- **Phase 2 — Per-cabinet theme.** Store/apply `room.theme` on switch; fall back to global.
- **Phase 3 — Scoped search.** Filter the root DB by the active cabinet's path prefix.
- **Phase 4 — Add / Edit / Promote.** Create a new top-level cabinet (room) with name+icon+theme;
  edit existing; promote a plain folder to a room.
- **Phase 5 (fast-follow) — Multi-window.** Audit/close the "root == active" gaps; Electron
  multi-window + a "New Window (cabinet…)" command; each window binds its own `cabinetPath`.
- **Phase 6 (later, separate PRD) — Onboarding** room picker.

---

*Out of scope here, tracked separately:* templated room-types onboarding picker; cross-room
search; the second-window UX (scope lands now, window experience in Phase 5).
