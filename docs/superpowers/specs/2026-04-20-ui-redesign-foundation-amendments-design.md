# UI Redesign Foundation — Amendments

**Date:** 2026-04-20
**Status:** Design — supersedes the affected sections of the 2026-04-19 Foundation spec.
**Original spec:** [`2026-04-19-ui-redesign-foundation-design.md`](./2026-04-19-ui-redesign-foundation-design.md)
**Original plan:** [`2026-04-19-ui-redesign-foundation-plan.md`](./2026-04-19-ui-redesign-foundation-plan.md)

## Why these amendments

The original Foundation spec ships 13 primitives (Tier A + B from PDF p.12 plus
common needs) and a minimal token set. An audit of what sub-projects B–F will
inevitably need, plus what the PDF screens already imply, surfaced seven
missing primitives, two missing token groups, and one Button API tweak. Each
addition is small and independently removable; collectively they prevent
sub-projects B–F from dipping back into Foundation to add primitives the
original cut left out.

Foundation has not yet been built — this is a pre-build amendment. No code
change implications; the original implementation plan's phase ordering still
holds, with the new primitives slotting into Phase 3.

## Changes

### Add — Motion tokens

Foundation originally has only `transition: all 120ms ease` for hover. As soon
as sub-project B starts (Modal open/close, Tabs panel switch, ToggleGroup
elevate, Tooltip appear) it needs consistent motion. Defining tokens now
prevents ad-hoc values across primitives.

```css
--motion-fast:  120ms;
--motion-base:  180ms;
--motion-slow:  280ms;
--ease-standard:    cubic-bezier(0.2, 0, 0, 1);
--ease-emphasized:  cubic-bezier(0.3, 0, 0, 1.2);
```

Mirror in `tokens.ts` as `tokens.motion = { fast: 120, base: 180, slow: 280 }`
and `tokens.ease = { standard: "...", emphasized: "..." }`.

### Add — Focus-ring tokens

The focus-visible style was hardcoded in plan Phase 4.1. Promoting to tokens
lets every primitive share one source of truth and removes the magic number
from `primitives.css`.

```css
--focus-ring-color:  var(--accent);
--focus-ring-width:  2px;
--focus-ring-offset: 2px;
```

The shared `:focus-visible` rule becomes:

```css
:focus-visible {
  outline: var(--focus-ring-width) solid var(--focus-ring-color);
  outline-offset: var(--focus-ring-offset);
}
```

### Add — Pagination primitive

Used in Manage Library (PDF p.10): "Showing 1–8 of 8 · Previous / Next".
Without it, sub-project F dips back to extend Foundation.

```tsx
<Pagination
  totalItems={number}
  pageSize={number}
  page={number}
  onPageChange={(p: number) => void}
/>
```

Hand-rolled, ~30 lines. No Radix dependency.

### Add — Toast primitive

Wraps `@radix-ui/react-toast`. Sub-project B will want it on day one for
"Saved", "Exported", "Logo added", "AFP generation queued". Core to the
"Readiness beats ceremony" principle from PDF p.12.

```tsx
// Provider mounted once in app/layout.tsx
<ToastProvider>
  ...
  <ToastViewport />
</ToastProvider>

// Trigger from anywhere via a hook
const toast = useToast();
toast({ tone: "success", title: "Saved", description: "All blocks merged." });
```

`tone`: `neutral | success | warn | danger | info` matching Badge tones.

New dep: `@radix-ui/react-toast@^1.2.2` (~5 KB gzipped).

### Add — Spinner primitive

Currently inlined inside Button's loading state as a CSS keyframe. Extracting
as a primitive lets it appear at page-level (CSV upload progress), modal-level
(during AFP generation), and inline.

```tsx
<Spinner size="sm|md|lg" />
```

Pure CSS keyframes, ~15 lines. Button's loading state internally renders
`<Spinner size="sm" />` instead of an inlined element.

### Add — Kbd primitive

PDF shows `⌘K` (library search) and `⌘+Enter` (save in modals). Currently the
styling lives inside `Input.Search`'s hint slot. Promoting to its own primitive
lets shortcuts appear in tooltips, menu items, help text, and onboarding
overlays.

```tsx
<Kbd>⌘K</Kbd>
<Kbd>Ctrl</Kbd> + <Kbd>Enter</Kbd>
```

~10 lines. `Input.Search`'s hint slot updates to render `<Kbd>` internally so
existing usage stays consistent.

### Add — VisuallyHidden utility

Icon-only buttons (formatting toolbar, sidebar rail) need accessible names.
Foundation's "Keyboard first" principle implies a11y. Implemented as a
CSS-only utility (no Radix dep) using the canonical visually-hidden snippet:

```tsx
<VisuallyHidden>Bold</VisuallyHidden>
```

```css
.psd-visually-hidden {
  position: absolute; width: 1px; height: 1px; padding: 0;
  margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0);
  white-space: nowrap; border: 0;
}
```

One component file (~10 lines) plus the CSS block above in
`styles/primitives.css`.

### Add — EmptyState primitive

Empty/first-run (PDF p.11) and many "no results" cases (search with no matches,
library tab empty, no recipients yet). A thin compound keeps later work
consistent and prevents one-off empty states drifting visually.

```tsx
<EmptyState
  icon={<FileText />}
  title="Start a new letter"
  description="Pick a starter below, or build from scratch by dragging blocks."
>
  <Button variant="secondary">Blank letter</Button>
  <Button variant="secondary">From template</Button>
  <Button variant="secondary">Import Word</Button>
</EmptyState>
```

~25 lines. Children render in a button row beneath the description.

### Add — Divider primitive

Sidebar nav, between sections in inspector, in dropdowns. Trivial but explicit
so we don't sprinkle ad-hoc `<hr>` styling.

```tsx
<Divider orientation="horizontal|vertical" />
```

~5 lines.

### Modify — Button: add `iconOnly` mode

PDF formatting toolbar (B/I/U, alignment, undo/redo) and sidebar rail (Logo,
Return, Verbiage…) are densely populated with icon-only buttons. Current Button
accepts `leadingIcon`/`trailingIcon` but doesn't enforce square aspect or
require an accessible name. Adding `iconOnly` ensures both:

```tsx
<Button iconOnly icon={<Bold />} aria-label="Bold" />
```

The existing variant API stays — `iconOnly` is an additional shape option, not
a new variant. Internally enforces `aspect-ratio: 1` and a minimum tap-target
size of 32×32 (sm) / 40×40 (md). The TypeScript prop type requires `aria-label`
to be a non-empty string when `iconOnly` is `true` (via a discriminated union),
so omitting it is a compile-time error in TSX consumers.

### Modify — Button loading state uses `<Spinner size="sm" />`

Drop the inlined keyframe element; render the new Spinner primitive instead.
Pure refactor; no API change.

## Stay deferred (explicit)

These were considered and intentionally not added:

- **Combobox** — design against the real Data & Mapping use case in sub-project
  D. Combobox is the heaviest of the deferred primitives (typeahead, async
  loading, keyboard nav); Radix doesn't ship one. Designing it abstractly
  risks the wrong shape.
- **DropdownMenu** — no PDF surface clearly needs it. If sub-project B uncovers
  one (inspector "more actions"?), add then.
- **Skeleton** — defer to D (CSV upload, AFP generation are the natural homes).
- **Popover** — no PDF surface clearly needs it.
- **Dark mode** — YAGNI; no PDF coverage.
- **Responsive breakpoints** — Builder is desktop-by-nature.
- **Form-library / validation primitives** — design with a real form in
  sub-project D.

## Net impact

| | Original Foundation | Amended Foundation |
|---|---:|---:|
| Token groups | 7 | 9 (+ motion, focus-ring) |
| Primitives | 13 | **20** (+ Pagination, Toast, Spinner, Kbd, VisuallyHidden, EmptyState, Divider) |
| New runtime deps | 6 Radix + lucide | + `@radix-ui/react-toast` (~5 KB) |
| `/design` route sections | 2 (tokens, primitives) | unchanged structure; longer pages |
| Build estimate (rough) | ~2 days | ~2.5 days |
| API breakage on existing code | none | none — all amendments are additive (Button gets an option, never breaks callers) |

## What this does NOT change

- `apps/web/src/design/` location.
- `psd-` class prefix.
- The `--accent` collision rename in `globals.css`.
- The `/design` preview route structure.
- The "Radix wrapped, never re-exported raw" rule.
- The "no Storybook, no animations beyond Radix defaults + a hover transition"
  decisions (the new motion tokens are *available* but most primitives still
  use only the hover transition; B onwards picks them up).
- The implementation plan's phase ordering. New primitives slot into Phase 3
  (one per step, same pattern). See plan delta below.

## Implementation plan delta

The 2026-04-19 implementation plan still applies. Insert the following new
steps into Phase 3, ordered to put dependencies first (Spinner before Button
refactor; VisuallyHidden before icon-only Button):

```
3.x  VisuallyHidden  (utility — no Radix; 10 lines)
3.x  Spinner         (extracted keyframes — replaces Button's inlined spinner)
3.x  Kbd             (10 lines; Input.Search hint slot internally renders <Kbd>)
3.x  Divider         (5 lines)
3.x  EmptyState      (compound — ~25 lines)
3.x  Pagination      (~30 lines; no Radix dep)
3.x  Toast           (Radix Toast; provider in app/layout.tsx)
3.x  Button refactor (add iconOnly mode; replace inlined spinner with <Spinner>)
```

Phase 0.1 install command grows by one package:

```bash
npm install @radix-ui/react-toast@^1.2.2
```

Phase 1.3 `tokens.css` grows by the motion + focus-ring blocks above.
Phase 1.4 `tokens.ts` mirrors the same values.
Phase 4.1 (focus-visible) becomes a token reference instead of a hardcoded
rule.

All other phases unchanged.

## Acceptance criteria (unchanged from original spec, plus)

- All 20 primitives render in `/design/primitives` with every variant.
- Pagination works keyboard-only (arrow keys advance page, Home/End jump).
- Toast announces via aria-live (Radix default), dismisses on timeout.
- Icon-only Button without `aria-label` fails a TypeScript build.
- Focus-ring style applies via the new tokens; changing
  `--focus-ring-color` re-styles every primitive.
