# UI Redesign Foundation — Implementation Plan

**Date:** 2026-04-19
**Spec:** [`2026-04-19-ui-redesign-foundation-design.md`](./2026-04-19-ui-redesign-foundation-design.md)
**Repo:** `C:\AdhocPrintStudio-main\AdhocPrintStudio-main`
**Working dir:** `apps/web`

## How to use this plan

Execute phases in order. Inside each phase, steps can usually run in sequence
within a single commit. Each step has a one-line **Verify** that should pass
before moving on. If a Verify fails, fix the step before progressing — do not
batch failures.

Acceptance criteria for the whole plan:
- `npm run build` and `npm run lint` pass in `apps/web`.
- `npm run dev` followed by visiting `/design`, `/design/tokens`, and
  `/design/primitives` shows every primitive in every variant, rendering
  cleanly.
- `BuilderClient.tsx` and `EditorClient.tsx` remain byte-identical.
- The current Builder page (`/`) renders visually unchanged.

---

## Phase 0 — Prep

### 0.1 Install dependencies

```
cd apps/web
npm install \
  @radix-ui/react-dialog@^1.1.2 \
  @radix-ui/react-tabs@^1.1.1 \
  @radix-ui/react-select@^2.1.2 \
  @radix-ui/react-tooltip@^1.1.4 \
  @radix-ui/react-toggle-group@^1.1.1 \
  @radix-ui/react-checkbox@^1.1.2 \
  lucide-react@^0.460.0
```

**Verify:** `npm ls @radix-ui/react-dialog lucide-react` shows the versions.
`npm run build` still succeeds.

### 0.2 Resolve the `--accent` collision in `globals.css`

Edit `apps/web/app/globals.css`:

| Line | Old | New |
|------|-----|-----|
| 6    | `--accent: #0f172a;`           | `--legacy-accent: #0f172a;`        |
| 7    | `--accent-strong: #0b1220;`    | `--legacy-accent-strong: #0b1220;` |
| 43   | `background: var(--accent);`        | `background: var(--legacy-accent);` |
| 48   | `background: var(--accent-strong);` | `background: var(--legacy-accent-strong);` |
| 1225 | `background: var(--accent);`        | `background: var(--legacy-accent);` |

**Verify:** `grep -n "var(--accent" apps/web/app/globals.css` returns no
results. `grep -n "var(--legacy-accent" apps/web/app/globals.css` returns
3 lines. `npm run dev` and visit `/`; the Builder looks visually identical
to before (this is the only test that matters — the navy / dark accents on
the current Builder must still render).

**Commit:** `chore(web): rename existing --accent tokens to --legacy-accent to free namespace for Foundation`

---

## Phase 1 — Tokens, fonts, reset

### 1.1 Create the folder structure

```
apps/web/src/design/
  styles/
  primitives/
```

### 1.2 `apps/web/src/design/reset.css`

Minimal reset:
- `*, *::before, *::after { box-sizing: border-box; }`
- `html, body { margin: 0; }`
- `button, input, textarea, select { font: inherit; color: inherit; }`
- `:focus { outline: none; }` (focus-visible takes over)

### 1.3 `apps/web/src/design/tokens.css`

Copy verbatim from the spec's "Tokens" section. Includes:
- Primitive neutrals, accent, status (PDF p.12 values).
- Semantic aliases (`--text-*`, `--surface-*`, `--border-*`).
- Spacing scale `--space-1`..`--space-16`.
- Radii `--radius-{xs,sm,md,lg,pill}`.
- Shadows `--shadow-{sm,md,lg}`.
- Type sizes `--font-size-{xs,sm,base,md,lg,xl,2xl}` and matching `--line-height-*`.

The font family vars (`--font-sans` etc.) are **set by next/font in 1.5**,
not here. Don't redeclare them.

### 1.4 `apps/web/src/design/tokens.ts`

Typed mirror of the same values. Shape:

```ts
export const tokens = {
  color: {
    ink: { 900: "#0b1220", 700: "#1f2937", 500: "#4b5563",
           300: "#9ca3af", 150: "#e5e7eb",  50: "#f8fafc" },
    accent: { base: "#b3502f", hover: "#9a4326",
              ink: "#7a3318",  soft:  "#fdeee6" },
    status: { success: "#0f7a55", warn: "#b45309",
              danger:  "#b42318", info: "#1d5fbe" },
    text:    { primary: "...", secondary: "...", muted: "...", inverse: "#fff" },
    surface: { page: "...", card: "#fff", sunken: "...", overlay: "rgba(11,18,32,.55)" },
    border:  { subtle: "...", strong: "..." },
  },
  space:  { 1:4, 2:8, 3:12, 4:16, 5:20, 6:24, 8:32, 10:40, 12:48, 16:64 },
  radius: { xs:4, sm:6, md:8, lg:12, pill:999 },
  shadow: { sm: "...", md: "...", lg: "..." },
  fontSize:  { xs:11, sm:12, base:13, md:14, lg:16, xl:20, "2xl":28 },
  lineHeight:{ xs:16, sm:16, base:18, md:20, lg:22, xl:26, "2xl":34 },
} as const;
```

Use `as const` so consumers get literal types.

### 1.5 `apps/web/src/design/fonts.ts`

```ts
import { Inter, Source_Serif_4, JetBrains_Mono } from "next/font/google";

export const sans  = Inter({          subsets: ["latin"], variable: "--font-sans",  display: "swap" });
export const serif = Source_Serif_4({ subsets: ["latin"], variable: "--font-serif", display: "swap" });
export const mono  = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono",  display: "swap" });
```

### 1.6 Wire into `apps/web/app/layout.tsx`

Add three imports and apply font variable classes to `<body>`:

```tsx
import "@/design/reset.css";
import "@/design/tokens.css";
import { sans, serif, mono } from "@/design/fonts";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${serif.variable} ${mono.variable}`}
            style={{ fontFamily: "var(--font-sans)" }}>
        {children}
      </body>
    </html>
  );
}
```

The existing `globals.css` import (if any) stays; load order in `layout.tsx`
must be `reset → globals → tokens` so tokens win over any conflicting global
rule that survives.

If `tsconfig.json` doesn't already alias `@/*` to `src/*`, add:
```json
"compilerOptions": { "baseUrl": ".", "paths": { "@/*": ["./src/*"] } }
```

**Verify:** `npm run dev`; visit `/`. Page renders. DevTools shows
`--ink-900`, `--accent`, `--space-4`, `--font-sans` defined on `:root` /
`<body>`. The Builder still looks identical to before.

**Commit:** `feat(design): add tokens, fonts, and CSS reset (Foundation step 1)`

---

## Phase 2 — /design demo route shell

### 2.1 `apps/web/app/design/page.tsx`

Index page with two links: `/design/tokens` and `/design/primitives`. Plain
React, no client component.

### 2.2 `apps/web/app/design/tokens/page.tsx`

Port `mockups/tokens.html` body into a React server component. Use the actual
`tokens.css` variables (don't re-hardcode). Layout: swatches grid, type
samples, spacing/radii/shadow visualizers.

### 2.3 `apps/web/app/design/primitives/page.tsx`

Empty shell with section anchors per primitive (`#button`, `#badge`, `#card`,
…). Each section gets filled in during Phase 3.

**Verify:** `npm run dev`; `/design`, `/design/tokens`, `/design/primitives`
all 200 OK. Tokens page visually matches `mockups/tokens.html`.

**Commit:** `feat(design): add /design preview route (Foundation step 2)`

---

## Phase 3 — Primitives

For each primitive below: implement the React component, add a CSS block in
`apps/web/src/design/styles/primitives.css`, add a section to
`/design/primitives/page.tsx` showing every variant, and re-export from
`apps/web/src/design/index.ts`.

All primitives are client components only when they need to be (anything that
uses Radix or holds interactive state). Pure-display primitives (Button,
Badge, Card, Table) can be server components.

### 3.1 `icons.ts`

`apps/web/src/design/icons.ts`:

```ts
export {
  Mail, MapPin, MessageSquare, Tag, FileText, Upload, Database, Search,
  Check, X, ChevronDown, ChevronRight, Plus, Minus, MoreHorizontal,
  Star, AlertCircle, AlertTriangle, Info, Loader2,
} from "lucide-react";
```

Add or remove names as components below need them.

### 3.2 Button — `primitives/Button.tsx`

Forwarded ref, all native `<button>` props pass through. CSS in `psd-button`,
modifier classes per variant (`psd-button--primary`, etc.) and size
(`psd-button--sm`).

States: `hover`, `:focus-visible` (shared focus ring), `disabled`, `loading`
(replaces leading icon with a spinner; disables clicks).

**Verify:** `/design/primitives#button` shows primary, secondary, ghost, link,
accent, danger; sm and md sizes; disabled and loading.

### 3.3 Badge — `primitives/Badge.tsx`

Props: `tone` (6 values), `caps?` (uppercase mono variant), `dot?` (leading
status dot).

**Verify:** `/design/primitives#badge` shows all 6 inline tones, plus
caps variants for READY / PENDING / DRAFT / ADVANCED / CUSTOM / SYSTEM.

### 3.4 Card — `primitives/Card.tsx`

Compound: `<Card>`, `<Card.Header>`, `<Card.Body>`. Props on root: `padding`,
`interactive`. Interactive adds hover lift (shadow-sm + 1px translate).

**Verify:** `/design/primitives#card` shows static card and interactive card
side by side.

### 3.5 Input — `primitives/Input.tsx`

Compound: `<Input>` + `<Input.Search>`. Slots: `leadingIcon`, `trailingSlot`.
Search variant pre-applies the search icon and accepts an optional `hint`
prop (e.g. `"⌘K"`) rendered as a kbd badge inside the trailing slot.

Focus state: token-driven ring on focus-within.

**Verify:** `/design/primitives#input` shows text input, search input with
hint, and a small numeric input (sm size).

### 3.6 Textarea — `primitives/Textarea.tsx`

Props: `autoResize?`, `maxRows?`, `counter?: { total: number }`. AutoResize
uses a hidden ghost element (no `field-sizing` reliance). Counter renders
under the textarea: `{value.length} chars · {paragraphCount} paragraph(s)`.

**Verify:** `/design/primitives#textarea` shows a 192-character verbiage
sample with the counter readout matching.

### 3.7 Table — `primitives/Table.tsx`

Compound wrappers around `<table>`, `<thead>`, `<tbody>`, `<tr>`, `<th>`,
`<td>`. Header cells in mono uppercase per tokens. Row hover sets background
to `--surface-page`.

**Verify:** `/design/primitives#table` shows a 3-row sample with header.

### 3.8 DropZone — `primitives/DropZone.tsx`

Custom (no Radix). Props:

```ts
interface DropZoneProps {
  accept?: string;            // e.g. "image/png,image/jpeg,image/svg+xml"
  maxSize?: number;           // bytes
  multiple?: boolean;         // default false
  onFiles: (files: File[]) => void;
  onError?: (reason: "type" | "size") => void;
  children?: React.ReactNode; // <DropZone.Idle />, <DropZone.Dragging />
}
```

Behavior:
- Renders a focusable button-role region with `tabindex=0`.
- Click or Enter/Space opens the native file picker.
- Drag enter swaps to `<DropZone.Dragging />` if provided, else applies
  `is-dragging` class.
- On drop or pick, validate type and size; call `onFiles` or `onError`.
- Never throws.

**Verify:** `/design/primitives#dropzone` shows the idle state. Dragging a
file over visually changes state. Picking a too-large file logs an
`onError("size")` to the console.

### 3.9 Tooltip — `primitives/Tooltip.tsx`

Wraps `@radix-ui/react-tooltip`. Provider mounted once in `app/layout.tsx`
with `delayDuration={200}` and `skipDelayDuration={300}`. The `<Tooltip>`
component takes `content` and a single child:

```tsx
<Tooltip content="Open library (⌘K)"><Button variant="ghost">⌕</Button></Tooltip>
```

**Verify:** `/design/primitives#tooltip` — hovering or focusing the trigger
shows the bubble; ESC dismisses.

### 3.10 Tabs — `primitives/Tabs.tsx`

Wraps `@radix-ui/react-tabs`. Compound: `Tabs`, `Tabs.List`, `Tabs.Trigger`,
`Tabs.Panel`. Underline-style triggers per `mockups/primitives.html`.

**Verify:** `/design/primitives#tabs` shows a Block / Document / Merge tab
strip; arrow keys cycle triggers; active panel content swaps.

### 3.11 Modal — `primitives/Modal.tsx`

Wraps `@radix-ui/react-dialog`. Compound: `Modal`, `Modal.Header`,
`Modal.Body`, `Modal.Footer`. Sizes: sm (480px), md (640px), lg (880px).
Overlay uses `--surface-overlay`; container uses `--shadow-md` and
`--radius-lg`.

ESC and click-outside close (Radix). Focus trap on (Radix). Focus restored
to trigger on close (Radix).

**Verify:** `/design/primitives#modal` has a "Open modal" button; modal
opens, focus moves inside, ESC closes, focus returns to button.

### 3.12 Select — `primitives/Select.tsx`

Wraps `@radix-ui/react-select`. Trigger looks identical to `<Input>` for
visual consistency; content panel uses `--shadow-md` and `--radius-md`.

**Verify:** `/design/primitives#select` — clicking the trigger opens a
panel with 3+ items; arrow keys navigate; type-to-select works.

### 3.13 ToggleGroup — `primitives/ToggleGroup.tsx`

Wraps `@radix-ui/react-toggle-group`. Single-selection by default; pill
container with current selection elevated.

**Verify:** `/design/primitives#toggle-group` shows three groups
(Static/Dynamic, PDF/AFP, Table/Single row); selection visually swaps.

### 3.14 Checkbox — `primitives/Checkbox.tsx`

Wraps `@radix-ui/react-checkbox`. Renders the box + an inline label slot.

**Verify:** `/design/primitives#checkbox` shows checked and unchecked
examples.

**Commit (one per primitive, or one per group of 3 — whichever the developer
prefers):** `feat(design): add <Primitive> primitive (Foundation step 3.x)`

---

## Phase 4 — Polish

### 4.1 Shared focus-visible style

In `styles/primitives.css`, add at the top:

```css
.psd-button:focus-visible,
.psd-input:focus-within,
.psd-tab:focus-visible,
.psd-select-trigger:focus-visible,
.psd-toggle-group-item:focus-visible,
.psd-checkbox:focus-visible,
.psd-dropzone:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
```

(Adjust selectors per actual primitive CSS class names.)

### 4.2 Keyboard pass

Visit `/design/primitives` and tab through every primitive. Every interactive
element must show a visible focus ring; arrow keys must navigate Tabs,
ToggleGroup, Select; ESC must close Modal, Tooltip, Select.

### 4.3 Type and lint

```
cd apps/web
npx tsc --noEmit
npm run lint
```

Fix anything reported. Both must be clean.

### 4.4 Update `apps/web/app/layout.tsx` if needed

Confirm the Tooltip provider is mounted exactly once. If `<TooltipProvider>`
ended up inside `Tooltip.tsx` instead of `layout.tsx`, move it.

### 4.5 Final smoke

```
npm run build
npm run dev
```

Visit `/` (Builder must look unchanged), `/design`, `/design/tokens`,
`/design/primitives`. All four render cleanly with no console errors.

**Commit:** `feat(design): polish — focus styles, keyboard pass, lint clean (Foundation step 4)`

---

## Out of scope reminders

- No edits to `BuilderClient.tsx` or `EditorClient.tsx`.
- No deletion of `globals.css` rules other than the `--accent` rename in 0.2.
- No new fonts beyond Inter / Source Serif 4 / JetBrains Mono.
- No dark mode, Storybook, or visual regression tooling.
- No `Combobox`, `Toast`, `Skeleton`, `Popover`, `DropdownMenu`, `Pagination` —
  those are Tier C (deferred to later sub-projects).

## Rollback

Phase 0.2 (the `--accent` rename) is the only change that touches existing
code. To roll back: `git revert <0.2 commit>`. Everything else lives in
`apps/web/src/design/`, `apps/web/app/design/`, and a single small edit to
`apps/web/app/layout.tsx`. Deleting those files and the layout edit
disengages the Foundation entirely with no other side effects.
