# AdhocPrintStudio Phase 4 — Design Document

**Date:** 2026-06-04  
**Status:** Approved  
**Scope:** Frontend only (`apps/web/`) — no backend changes

---

## Goal

Make the Phase 1–3 UI production-ready and complete the multi-page letter model. Five independent feature areas, each buildable in isolation.

---

## Architecture

All state stays in `BuilderClient.tsx`. Phase 4 adds two new component files and extends two existing ones:

| File | Change |
|---|---|
| `apps/web/app/BuilderClient.tsx` | Autosave hooks, toast state, multi-page logic, TaglineLibrary wiring |
| `apps/web/app/globals.css` | Toast styles, page navigator styles |
| `apps/web/app/components/Toast.tsx` | **NEW** — lightweight toast notification |
| `apps/web/app/components/TaglineLibrary.tsx` | **NEW** — extracted from inline BuilderClient |
| `apps/web/app/components/InspectorPanel.tsx` | Add Block tab controls (X/Y/width/align) |

No new dependencies. No backend changes.

---

## Feature 1: Autosave (Persistence)

### What gets saved

A single JSON blob written to `localStorage` under key `adhoc_letter_draft`:

```json
{
  "title": "Untitled letter",
  "bodyContentByPage": { "0": "<p>…</p>", "1": "<p>…</p>" },
  "blocksByPage": { "0": [{ "id": "…", "type": "tagline", "x": 120, "y": 80, … }] },
  "pages": ["Page 1", "Page 2"],
  "activePage": 0,
  "spreadsheetName": "mailing_list.csv",
  "spreadsheetContent": "col_A,col_B\nJohn,Smith",
  "placeholderMap": { "Name": "col_A" },
  "mailingMap": { "mailing_name": "col_A", "mailing_addr1": "col_B", "mailing_addr2": "", "mailing_addr3": "" },
  "selectedLogoId": "logo-abc",
  "selectedReturnId": "return-xyz"
}
```

### When to save

Debounced `useEffect` — fires 500ms after any of the tracked values change. Dependencies:
`letterTitle`, `bodyContentByPage`, `blocksByPage`, `pages`, `placeholderMap`, `mailingMap`, `spreadsheetName`, `spreadsheetContent`, `selectedLogo?.id`, `selectedReturn?.id`.

### Size guard

Before writing, check `JSON.stringify(draft).length`. If > 4MB, omit `spreadsheetContent` from the blob and set a flag `spreadsheetNotSaved: true`. The Data panel shows a soft warning: "Spreadsheet is too large to auto-save — re-upload after refresh."

### Restore on mount

In the existing `useEffect([], [])` (mount effect), after loading localStorage favorites/recently-used, check for `adhoc_letter_draft`. If found, restore all fields. The `savedAgo` badge already exists — wire it to say "Saved just now" after each successful write and update to time-elapsed on a 30s interval.

### Clear draft

No explicit "clear" button. The draft is naturally overwritten on the next change. On a fresh session (no draft in localStorage), the app starts blank as before.

---

## Feature 2: Generate UX Polish

### Toast component (`components/Toast.tsx`)

```
┌────────────────────────────────────────────────┐
│  ✓  AFP downloaded — 250 letters generated     │  ← success (green)
│  ✗  Cannot reach server. Check API is running  │  ← error (red)
│  ℹ  Upload a spreadsheet in the Data panel     │  ← info (neutral)
└────────────────────────────────────────────────┘
```

- Fixed position: bottom-right, `z-index: 200`, 16px margin
- Auto-dismisses after 4 seconds (error toasts: 6 seconds)
- Single toast at a time (new replaces old)
- State: `toast: { message: string; variant: "success" | "error" | "info" } | null` in BuilderClient

### Changes to `handleGenerate`

| Current | New |
|---|---|
| `alert("Please upload a spreadsheet first.")` | `setToast({ message: "Upload a spreadsheet in the Data panel first.", variant: "info" })` |
| `alert(message)` on error | `setToast({ message: truncate(message, 120), variant: "error" })` |
| Download only, no feedback | `setToast({ message: `${format.toUpperCase()} downloaded — ${rowCount} letters generated`, variant: "success" })` |

### Generate button state

The Topbar `onGenerate` already receives the `generateDisabled` prop. Phase 4 also passes `generating: boolean` so the button can show a spinner + "Generating…" text while the API call is in-flight.

---

## Feature 3: TaglineLibrary Component

Extract the inline tagline flyout from `BuilderClient.tsx` (currently ~300 lines of JSX inside the sidebar flyout section) into `components/TaglineLibrary.tsx`.

### Props

```ts
interface TaglineLibraryProps {
  items: LibraryItem[];
  onSelect: (item: LibraryItem) => void;
  recentlyUsed: string[];       // item IDs
  favorites: string[];          // item IDs
  onToggleFavorite: (id: string, e: React.MouseEvent) => void;
}
```

### UI pattern

Same as `VerbiageLibrary`:
- Search input at top
- Recently-used strip (if any)
- Tag filter chips (taglines have content, not structured tags — derive chips from first word of content if needed, or skip chips)
- Dense list: label + 80-char content preview
- Click → `onSelect(item)` which calls the existing `addLibraryItemToCanvas(item)` path

The inline JSX in `BuilderClient` is deleted and replaced with `<TaglineLibrary ... />`.

---

## Feature 4: Inspector Block Tab

`InspectorPanel` currently renders "Select a block on the canvas to see its properties." unconditionally on the Block tab.

### New props added to `InspectorPanel`

```ts
selectedBlock?: PlacedBlock | null;
onUpdateBlock?: (id: string, updates: Partial<PlacedBlock>) => void;
```

### Block tab UI (when `selectedBlock` is not null)

```
Label:   [Tagline: Proud to serve you]  (read-only)

Position
  X  [____120____]px    Y  [_____80____]px

Width    [____320____]px

Align    [Left] [Center] [Right]
```

- Number inputs are `type="number"` with `min=0`; on change call `onUpdateBlock(selectedBlock.id, { x: value })`
- Align toggle: three buttons, active one has rust background (same pattern as existing segment controls)
- All changes are immediate (no "Apply" button) — mirrors how drag-to-reposition already works

When `selectedBlock` is null, keep the existing "Select a block…" placeholder.

---

## Feature 5: Multi-Page

### Page Navigator Strip

A `<div className="page-navigator">` rendered between the Topbar and the canvas toolbar:

```
┌─────────────────────────────────────────────────────────┐
│  Page 1 ×  │  Page 2 ×  │  + Add page                  │
└─────────────────────────────────────────────────────────┘
```

- 32px tall, background `var(--ink-50)`, border-bottom `var(--outline)`
- Active tab: `var(--accent)` 2px bottom border, ink-900 text
- The `×` delete button is `display: none` when `pages.length === 1`
- "+" button calls `addPage()`:
  ```js
  const addPage = () => {
    const next = pages.length;
    setPages(prev => [...prev, `Page ${next + 1}`]);
    setActivePage(next);
  };
  ```
- Delete button calls `deletePage(index)`:
  ```js
  const deletePage = (index: number) => {
    setPages(prev => prev.filter((_, i) => i !== index));
    setBodyContentByPage(prev => { const next = { ...prev }; delete next[index]; return next; });
    setBlocksByPage(prev => { const next = { ...prev }; delete next[index]; return next; });
    setActivePage(prev => Math.max(0, prev >= index ? prev - 1 : prev));
  };
  ```

### Generate — send all pages

Change `handleGenerate` payload from:
```js
template_html: stripInlineControls(bodyContentByPage[0] ?? "")
```
to:
```js
template_html: pages
  .map((_, i) => stripInlineControls(bodyContentByPage[i] ?? ""))
  .map((html, i) => i === 0 ? html : `<div style="page-break-before:always">${html}</div>`)
  .join("")
```

No backend change — the AFP and PDF generators already respect CSS page-break-before.

---

## Error Handling

- Autosave: wrap localStorage write in try/catch (quota exceeded → silently skip, show warning in Data panel)
- Toast: auto-dismiss timer cleared on unmount
- Page delete: if deleting the active page, always move to an adjacent page

---

## Testing Plan

| Area | Manual test |
|---|---|
| Autosave | Edit letter → refresh → content restored |
| Autosave | Large CSV (>4MB) → Data panel shows "too large to save" hint |
| Toast | Click Generate with no spreadsheet → info toast |
| Toast | Generate succeeds → success toast with letter count |
| TaglineLibrary | Click Tagline tab → flyout opens, search works, click inserts |
| Inspector Block | Place a tagline block → select it → Block tab shows X/Y/align controls → change X → block moves |
| Multi-page | Add page → edit content → switch back → page 1 content preserved |
| Multi-page | Delete page 2 → activePage snaps to page 1 |
| Multi-page | Generate with 2 pages → downloaded file has page break between pages |
