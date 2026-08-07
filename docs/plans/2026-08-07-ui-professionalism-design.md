# UI professionalism pass — design

**Goal:** any business user can produce a mail-merge letter with zero manual.
Remove unnecessary buttons, kill jargon, one clear path through the app.

**Evidence (screenshot audit, 2026-08-07):** duplicate empty states on the
canvas; dead "Document — coming soon" inspector tab; "Merge" tab duplicating
the always-visible readiness footer; cryptic topbar "AI" button; "Export" vs
"Preview" vs "Generate" ambiguity; Generate hard-disabled with no explanation;
print-industry jargon ("Verbiage", "TLE Fields", "Merge readiness"); toolbar
built from text glyphs (⇤ ⇥ ≡ ↕ ⌫); unreachable legacy preview modal;
"By PSD" branding noise.

## Six-lens review

- **PM:** the product has one job — letter + data → generated mail. Every
  surface should point at the next step of that path. Readiness checklist is
  the strongest no-manual affordance; promote it, don't hide it in a tab.
- **UI:** icon toolbar (lucide, already a dependency), one toolbar row, one
  empty state, plain-language labels. No new visual language — reuse the
  existing design tokens.
- **Researcher:** matches Word/Docs conventions users already know (icon
  toolbar, named buttons, contextual properties panel).
- **Architect:** display-string changes only where possible; state keys
  ("Verbiage", "Return") stay untouched so persistence/library data survive.
- **Developer:** delete unreachable code (legacy preview modal); disabled
  buttons that explain nothing become enabled buttons that route to the
  missing step.
- **Tester:** browser click-through of every changed surface + lint/build;
  API contract untouched (no backend changes).

## Changes

### 1. Topbar
- Remove "· By PSD".
- "AI" → "AI settings".
- "Export" → "Export Word".
- Generate: only disabled while generating. With no data file it routes to
  the Data tab with a toast (same pattern Preview already uses).

### 2. Left sidebar (display labels only; ids/state keys unchanged)
- "Return" → "Return address"
- "Verbiage" → "Snippets" (flyout title + search placeholder follow)
- "Import" → "Import Word"

### 3. Right inspector
- Delete "Document" tab (dead: "coming soon").
- Delete "Merge" tab (duplicate of footer); its "Open merge panel" button
  moves into the readiness footer as "Preview letters →".
- "Block" tab only shown while a canvas block is selected; falls back to
  Data when deselected.
- "MERGE READINESS" → "READY TO SEND?"
- Data panel sub-tab "TLE Fields" → "Index fields".

### 4. Canvas empty state
- One voice: hide the editor's "Start typing your letter..." placeholder
  while the starter hero is visible; compact the hero so all three starter
  cards sit above the fold.

### 5. Editor toolbar
- Replace text glyphs with lucide icons (Undo2, Redo2, Bold, Italic,
  Underline, Strikethrough, Baseline, Highlighter, List, ListOrdered,
  IndentDecrease, IndentIncrease, AlignLeft, AlignCenter, AlignRight,
  Link2, Minus, RemoveFormatting). Keep existing tooltips and shortcuts.
- Collapse to a single row.

### 6. Dead code
- Remove the unreachable legacy preview modal (`showPreview`),
  `handleMergePreview`, and its now-unused helpers.

## Out of scope
Backend, output formats, library data model, ManageLibrary internals,
dynamic-asset modes, AI feature behavior.

## Verification
Lint + build; live browser pass: first-run view, each renamed surface,
block-select behavior, Generate-with-no-data routing, merge preview still
opens; API test suite stays green.
