# UI Redesign — Foundation (sub-project A)

**Date:** 2026-04-19
**Status:** Design — awaiting implementation plan
**Source visual spec:** `redesign.pdf` (12 pages, page 12 = Design tokens)

## Context

The redesign PDF specifies a complete visual overhaul of AdhocPrintStudio across
11 screens/states. This document covers **only the Foundation** — design tokens,
fonts, and a shared primitive component library. Subsequent sub-projects
(Builder shell, Library flyouts, Data &amp; mapping, Modals, Manage library)
will compose these primitives.

Decomposition rationale: the existing `apps/web/app/BuilderClient.tsx` is 4287
lines and `apps/web/app/globals.css` is 3551 lines. Doing the full redesign as
one spec would be unwieldy; cutting Foundation off as its own sub-project lets
later screens ship without reinventing primitives, and lets the existing
Builder keep working until sub-project B replaces it.

## Goals

1. A token system (color, type, spacing, radii, shadow) sourced from
   `redesign.pdf` page 12 and codified as CSS custom properties + a typed TS
   mirror.
2. Three font faces (Inter UI, Source Serif 4 letter body, JetBrains Mono data)
   loaded via `next/font/google`, with the principle "Serif is opt-in" enforced
   structurally.
3. Thirteen primitive components covering everything visible in the PDF:
   Button, Badge, Card, Input, Textarea, Select, Tabs, Modal, Tooltip,
   ToggleGroup, Checkbox, DropZone, Table.
4. A `/design` route inside `apps/web` that renders every primitive in every
   variant, for dev-time browsing.
5. Zero impact on the running Builder while Foundation is being built.

## Non-goals

- Dark mode.
- Storybook, Chromatic, visual regression tooling.
- Animations beyond Radix defaults plus a single 120ms hover transition.
- Form-library / validation primitives — those belong with the data-mapping
  sub-project.
- Any change to `BuilderClient.tsx` or `EditorClient.tsx`. Those are
  sub-project B.

## Architecture

### File layout

```
apps/web/src/design/
  tokens.css           CSS custom properties. Imported once from app/layout.tsx.
  tokens.ts            Same values as a typed TS object (for code that needs
                       values in JS — chart axes, inline styles in dnd previews).
  fonts.ts             next/font config for Inter, Source Serif 4, JetBrains Mono.
                       Exports CSS variables (--font-sans, --font-serif, --font-mono).
  reset.css            Minimal CSS reset. Loaded before tokens.css.
  icons.ts             Re-exports lucide-react icons we use, named.

  primitives/
    Button.tsx         variants: primary | secondary | ghost | link | accent | danger
                       sizes: sm | md
    Badge.tsx          tone: neutral | accent | success | warn | danger | info
                       caps?: boolean (READY/PENDING/DRAFT/ADVANCED-style)
                       dot?: boolean
    Card.tsx           padding: sm | md | lg, interactive?: boolean
    Input.tsx          + Input.Search variant with optional ⌘K kbd hint
    Textarea.tsx       autoResize?, maxRows?, counter?: { total: number }
    Select.tsx         wraps @radix-ui/react-select
    Tabs.tsx           wraps @radix-ui/react-tabs (underline triggers)
    Modal.tsx          wraps @radix-ui/react-dialog; sizes sm 480 / md 640 / lg 880
    Tooltip.tsx        wraps @radix-ui/react-tooltip; provider in app/layout.tsx
    ToggleGroup.tsx    wraps @radix-ui/react-toggle-group
    Checkbox.tsx       wraps @radix-ui/react-checkbox
    DropZone.tsx       custom; accept, maxSize, onFiles(File[]), onError(reason)
    Table.tsx          thin styled <table> wrappers (no data layer)

  styles/
    primitives.css     One block per primitive, prefixed `.psd-*`.

  index.ts             Barrel export.

apps/web/app/design/
  page.tsx             Index linking to /design/tokens and /design/primitives.
  tokens/page.tsx      Live render of tokens (port of mockups/tokens.html).
  primitives/page.tsx  Live render of every primitive in every variant.
```

### Boundaries

- Tokens have no React in them — CSS + TS values. Sub-project B can use the
  CSS classnames or pull TS values; both work.
- Primitives are layout + behavior + tokens only. No business state, no fetch,
  no app logic. A primitive should be deletable from this folder and replaceable
  without touching the rest of `apps/web/src`.
- Radix is wrapped, never re-exported raw. Keeps the primitive API ours so we
  can swap libraries later with a single edit.
- Lucide is wrapped via `icons.ts` for the same reason.

## Tokens

### Primitive — neutrals (PDF p.12)

```
--ink-900 #0b1220   --ink-700 #1f2937   --ink-500 #4b5563
--ink-300 #9ca3af   --ink-150 #e5e7eb   --ink-50  #f8fafc
```

### Primitive — accent (PDF p.12)

```
--accent       #b3502f
--accent-hover #9a4326
--accent-ink   #7a3318
--accent-soft  #fdeee6
```

### Primitive — status (PDF p.12)

```
--success #0f7a55   --warn #b45309   --danger #b42318   --info #1d5fbe
```

### Semantic aliases

Components reference semantic names only — never the primitive (`--ink-900`)
directly. This lets us re-skin without touching component CSS.

```
--text-primary     var(--ink-900)
--text-secondary   var(--ink-500)
--text-muted       var(--ink-300)
--text-inverse     #ffffff
--surface-page     var(--ink-50)
--surface-card     #ffffff
--surface-sunken   var(--ink-150)
--surface-overlay  rgba(11,18,32,.55)
--border-subtle    var(--ink-150)
--border-strong    var(--ink-300)
```

### Spacing — 4px base

```
--space-1  4    --space-2  8    --space-3  12   --space-4  16
--space-5  20   --space-6  24   --space-8  32   --space-10 40
--space-12 48   --space-16 64
```

### Radii

```
--radius-xs  4 (chips)         --radius-sm  6 (buttons, inputs)
--radius-md  8 (cards)         --radius-lg  12 (modals)
--radius-pill 999 (badges)
```

### Shadow

```
--shadow-sm  0 1px 2px rgba(11,18,32,.06), 0 1px 1px rgba(11,18,32,.04)
--shadow-md  0 6px 16px rgba(11,18,32,.08), 0 2px 4px rgba(11,18,32,.04)
--shadow-lg  0 24px 48px rgba(11,18,32,.18), 0 8px 16px rgba(11,18,32,.08)
```

### Type — faces

```
--font-sans   Inter            (UI default)
--font-serif  Source Serif 4   (letter canvas only — opt-in)
--font-mono   JetBrains Mono   (data, placeholders, file metadata)
```

Loaded via `next/font/google` in `fonts.ts`. The font CSS variables are attached
to `<body>` in `app/layout.tsx`. Body inherits `--font-sans` by default.

### Type — size scale (Inter)

```
xs   11/16    uppercase labels, captions
sm   12/16    secondary text
base 13/18    default UI body, inspector lists
md   14/20    inputs, button labels, table cells
lg   16/22    section titles
xl   20/26    modal titles
2xl  28/34    page titles (Manage library)
```

Defined as `--font-size-*` and `--line-height-*` paired tokens.

## Primitives — public API

Conventions across all primitives:
- Forwarded `ref` and pass-through `...rest` for the underlying element so
  consumers can attach handlers / data attrs.
- `className` is appended, never replaced. No `style` prop overrides on
  primitives — go through tokens.
- All Radix wrappers re-export Radix's controlled / uncontrolled pattern.
  Provider components (TooltipProvider) mounted once in `app/layout.tsx`.
- Focus ring is a single shared style on `:focus-visible` (never on `:focus`):
  `outline: 2px solid var(--accent); outline-offset: 2px`.
- One CSS block per primitive in `styles/primitives.css`, scoped with a `psd-`
  prefix. No CSS modules, no CSS-in-JS.

```tsx
<Button variant="primary|secondary|ghost|link|accent|danger" size="sm|md"
        leadingIcon? trailingIcon? loading? disabled? />

<Badge tone="neutral|accent|success|warn|danger|info" caps? dot? />

<Card padding="sm|md|lg" interactive?> children </Card>

<Input value onChange leadingIcon? trailingSlot? size="sm|md" />
<Input.Search hint?="⌘K" />

<Textarea autoResize? maxRows? counter?={total: number} />

<Select value onValueChange>
  <Select.Trigger /> <Select.Content>
    <Select.Item value /> </Select.Content>
</Select>

<Tabs value onValueChange>
  <Tabs.List><Tabs.Trigger value /></Tabs.List>
  <Tabs.Panel value />
</Tabs>

<Modal open onOpenChange size="sm|md|lg">
  <Modal.Header title description?>
  <Modal.Body /> <Modal.Footer />
</Modal>

<Tooltip content delayMs?={200}> child </Tooltip>

<ToggleGroup type="single|multiple" value onValueChange>
  <ToggleGroup.Item value /> </ToggleGroup>

<Checkbox checked onCheckedChange label />

<DropZone accept maxSize onFiles={(f: File[]) => void}
          onError?={(reason: 'type'|'size') => void}>
  <DropZone.Idle /> <DropZone.Dragging />
</DropZone>

<Table>
  <Table.Header><Table.Row><Table.HeadCell /></Table.Row></Table.Header>
  <Table.Body><Table.Row><Table.Cell /></Table.Row></Table.Body>
</Table>
```

## Dependencies (new)

Add to `apps/web/package.json`:

```
@radix-ui/react-dialog          ^1.1.2
@radix-ui/react-tabs            ^1.1.1
@radix-ui/react-select          ^2.1.2
@radix-ui/react-tooltip         ^1.1.4
@radix-ui/react-toggle-group    ^1.1.1
@radix-ui/react-checkbox        ^1.1.2
lucide-react                    ^0.460.0
```

~35–40 KB gzipped total once tree-shaken. No peer-dep conflicts with
Next 14.2 / React 18.

## Coexistence with the current Builder

- Foundation CSS is loaded **after** `globals.css` in `app/layout.tsx`. Tokens
  are defined on `:root`; they're available everywhere.
- **One existing collision** to resolve: `globals.css` currently defines
  `--accent: #0f172a` and `--accent-strong: #0b1220` (lines 6–7) and references
  `--accent` at lines 43, 48, 1225. None of the TSX/TS code references either
  variable (confirmed by grep). The Foundation work renames the existing tokens
  to `--legacy-accent` / `--legacy-accent-strong` (and the three `var(--accent)`
  call-sites accordingly) inside `globals.css` as a one-time, surgical edit
  before adding the new tokens. This is the only modification to `globals.css`
  during Foundation work; no other rules are touched.
- Primitive class names use a `psd-` prefix (`psd-button`, `psd-modal-header`)
  to avoid collision with existing Builder styles. Confirmed by grep that the
  current `globals.css` uses no `psd-` prefix.
- The current Builder continues to use `globals.css`. New code (the `/design`
  route, and later sub-project B) uses primitives.
- Sub-project B will systematically delete from `globals.css` as it ports
  each region of the Builder, including the `--legacy-accent*` tokens once
  no rule references them.

## Demo route

`/design` is a Next.js route inside `apps/web/app/design/`. It is a dev-time
gallery: every primitive in every variant on one scrollable page, plus a
tokens page that mirrors `redesign.pdf` p.12. No build flag — just a route.
Left in production (cheap, useful for support and design review).

## Error handling

Primitives are presentational. The only runtime concerns are:
- `DropZone` rejects unsupported types and oversize files via `onError`,
  never throws.
- `Modal` restores focus to the trigger on close (Radix handles this).

## Testing

- `tsc --noEmit` and existing `next lint` cover correctness.
- Visual smoke check by opening `/design` after every change — that is what
  the gallery is for.
- No component-level unit tests in this Foundation. Behavior comes from Radix
  (already tested upstream); our wrappers are styling shims. Sub-projects
  that compose primitives will get their own tests.

## Open questions / explicit deferrals

- Token scale could later add `2xs` (10px) and `3xl` (32px) text sizes if
  Manage library or marketing surfaces need them. Not added now.
- Animation tokens (durations, easings) are not formalised. Use the single
  120ms hover transition and Radix defaults; revisit if motion becomes a
  named design concern.
- A `Combobox` / typeahead primitive will be needed for the data-mapping
  sub-project (column → placeholder). Deferred until that work begins so
  we design it against a real use case.
