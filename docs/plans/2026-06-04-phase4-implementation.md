# AdhocPrintStudio Phase 4 — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the Phase 1–3 UI production-ready: autosave letter state, replace alert() with toasts, extract the TaglineLibrary component, and add multi-page support.

**Architecture:** All changes are frontend-only (`apps/web/`). State stays in `BuilderClient.tsx`. Two new component files: `Toast.tsx` and `TaglineLibrary.tsx`. No new npm dependencies. No backend changes. Inspector Block tab is already fully implemented (wired in BuilderClient + InspectorPanel) — do NOT touch it.

**Tech Stack:** Next.js 14, React 18, plain CSS variables, localStorage API.

**Dev server:** `cd apps/web && npm run dev` → http://localhost:3000

**Key files to read before starting each task:**
- `apps/web/app/BuilderClient.tsx` — root orchestrator (~3400 lines)
- `apps/web/app/globals.css` — all CSS lives here
- `apps/web/app/components/` — existing extracted components (pattern reference)

---

## TASK 1: Toast notification component

**Files:**
- Create: `apps/web/app/components/Toast.tsx`
- Modify: `apps/web/app/globals.css` (append toast styles)

### Context

There is no toast component yet. Currently `handleGenerate` and `handleSaveLetter` use `alert()` which blocks the UI. This task creates a lightweight `Toast` component that BuilderClient will use in Task 2.

### Step 1: Create `Toast.tsx`

Create `apps/web/app/components/Toast.tsx`:

```tsx
"use client";

import { useEffect } from "react";

export type ToastVariant = "success" | "error" | "info";

export interface ToastMessage {
  message: string;
  variant: ToastVariant;
}

interface ToastProps {
  toast: ToastMessage | null;
  onDismiss: () => void;
}

const AUTO_DISMISS_MS: Record<ToastVariant, number> = {
  success: 4000,
  info: 4000,
  error: 6000,
};

export function Toast({ toast, onDismiss }: ToastProps) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(onDismiss, AUTO_DISMISS_MS[toast.variant]);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  if (!toast) return null;

  return (
    <div className={`toast toast-${toast.variant}`} role="status" aria-live="polite">
      <span className="toast-icon">
        {toast.variant === "success" ? "✓" : toast.variant === "error" ? "✕" : "ℹ"}
      </span>
      <span className="toast-message">{toast.message}</span>
      <button type="button" className="toast-close" onClick={onDismiss} aria-label="Dismiss">
        ×
      </button>
    </div>
  );
}
```

### Step 2: Add CSS to globals.css

Append to the **end** of `apps/web/app/globals.css`:

```css
/* ── Toast ── */
.toast {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 200;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  font-size: 0.875rem;
  font-weight: 500;
  max-width: 380px;
  animation: toast-in 0.2s ease;
}
@keyframes toast-in {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
.toast-success { background: #ecfdf5; color: var(--success); border: 1px solid #a7f3d0; }
.toast-error   { background: #fef2f2; color: var(--danger);  border: 1px solid #fecaca; }
.toast-info    { background: var(--ink-50); color: var(--ink-700); border: 1px solid var(--outline); }
.toast-icon    { font-size: 1rem; flex-shrink: 0; }
.toast-message { flex: 1; }
.toast-close   { background: none; border: none; cursor: pointer; font-size: 1.1rem; color: inherit; padding: 0; line-height: 1; opacity: 0.6; }
.toast-close:hover { opacity: 1; }
```

### Step 3: Verify it renders (manual)

Temporarily add `<Toast toast={{ message: "Test toast", variant: "success" }} onDismiss={() => {}} />` somewhere in BuilderClient's return, start the dev server, confirm it appears bottom-right, then remove it.

### Step 4: Commit

```bash
git add apps/web/app/components/Toast.tsx apps/web/app/globals.css
git commit -m "feat: add Toast notification component"
```

---

## TASK 2: Generate UX polish — replace alert() with toasts

**Files:**
- Modify: `apps/web/app/BuilderClient.tsx`

### Context

`BuilderClient.tsx` has three `alert()` calls and two `handleSaveLetter` alerts that block the UI. The `generating` state already exists (line ~505) but the Topbar `Generate` button doesn't show a spinner. This task wires the Toast component and fixes the button.

### Step 1: Add toast state to BuilderClient

Read `BuilderClient.tsx` and find the imports section (top of file). Add:

```tsx
import { Toast, type ToastMessage } from "./components/Toast";
```

Find where `useState` declarations are grouped (around line 505). Add:

```tsx
const [toast, setToast] = useState<ToastMessage | null>(null);
```

### Step 2: Replace alert() in handleGenerate

Find `handleGenerate` (around line 1775). Make these three changes:

**Change 1** — line ~1777 (no spreadsheet):
```tsx
// BEFORE:
alert("Please upload a spreadsheet first.");
return;

// AFTER:
setToast({ message: "Upload a spreadsheet in the Data panel first.", variant: "info" });
return;
```

**Change 2** — line ~1885 (error):
```tsx
// BEFORE:
alert(`Error: ${message}`);

// AFTER:
setToast({ message: message.slice(0, 160), variant: "error" });
```

**Change 3** — after the `link.click()` download (line ~1870, after `URL.revokeObjectURL`), add success toast. You'll need the row count — find where `spreadsheetContent` is parsed into rows. The `rows` variable is available in `buildMergedHtmlForRow` but not in `handleGenerate` directly. Use a simpler approach: count newlines in `spreadsheetContent`:

```tsx
// Add after URL.revokeObjectURL(url); (line ~1870):
const rowCount = Math.max(0, (spreadsheetContent ?? "").split("\n").filter(Boolean).length - 1);
setToast({
  message: `${format.toUpperCase()} downloaded — ${rowCount} letter${rowCount !== 1 ? "s" : ""} generated`,
  variant: "success",
});
```

### Step 3: Replace alert() in handleSaveLetter

Find `handleSaveLetter` (around line 1048). Replace both alerts:

```tsx
// BEFORE (line ~1050):
alert("Cannot save empty letter. Please add some content first.");

// AFTER:
setToast({ message: "Add some content to the letter first.", variant: "info" });
return;
```

```tsx
// BEFORE (line ~1073):
alert("Letter saved to Full Letters library!");

// AFTER:
setToast({ message: "Letter saved to the Full Letters library.", variant: "success" });
```

### Step 4: Add spinner to Generate button in Topbar

Find where Topbar is rendered in BuilderClient (around line 2165). The `Topbar` component already receives `onGenerate`. Pass the `generating` state so the button can show a spinner.

Open `apps/web/app/components/Topbar.tsx`. Find the `TopbarProps` interface and add:

```tsx
generating?: boolean;
```

Find the Generate button in Topbar's JSX. It likely looks like:
```tsx
<button ... onClick={onGenerate} disabled={generateDisabled}>
  Generate
</button>
```

Change to:
```tsx
<button ... onClick={onGenerate} disabled={generateDisabled || generating}>
  {generating ? (
    <><span className="topbar-spinner" aria-hidden="true" />Generating…</>
  ) : (
    "Generate"
  )}
</button>
```

Add spinner CSS to `globals.css`:
```css
.topbar-spinner {
  display: inline-block;
  width: 12px;
  height: 12px;
  border: 2px solid rgba(255,255,255,0.4);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  margin-right: 6px;
}
@keyframes spin { to { transform: rotate(360deg); } }
```

Pass `generating={generating}` when rendering `<Topbar>` in BuilderClient.

### Step 5: Render Toast in BuilderClient's return

Find the outer `<div>` wrapper in BuilderClient's `return`. Before the closing `</div>`, add:

```tsx
<Toast toast={toast} onDismiss={() => setToast(null)} />
```

### Step 6: Verify (manual)

1. Start dev server. Click Generate with no spreadsheet → info toast appears.
2. Upload a spreadsheet and click Generate with the API running → success toast shows letter count.
3. Try with API offline → error toast appears instead of alert().
4. Click "Save letter" with content → success toast.

### Step 7: Commit

```bash
git add apps/web/app/BuilderClient.tsx apps/web/app/components/Topbar.tsx apps/web/app/globals.css
git commit -m "feat: replace alert() with toast notifications, add Generate spinner"
```

---

## TASK 3: Autosave — persist letter state to localStorage

**Files:**
- Modify: `apps/web/app/BuilderClient.tsx`

### Context

Currently all letter state is lost on page refresh. Only favorites/recently-used are persisted. This task adds debounced autosave (500ms) and restore-on-mount for: title, body content, placed blocks, pages, spreadsheet, placeholder map, mailing map, selected logo/return IDs.

Spreadsheet CSVs can exceed 4MB (localStorage limit is ~5MB). If the full draft exceeds 4MB, omit `spreadsheetContent` and set `spreadsheetNotSaved: true`.

### Step 1: Define the draft shape

Near the top of the `BuilderClient` function body (after all `useState` declarations), add this helper:

```tsx
const DRAFT_KEY = "adhoc_letter_draft";

interface LetterDraft {
  title: string;
  bodyContentByPage: Record<number, string>;
  blocksByPage: Record<number, Array<{
    id: string; label: string; type: string;
    content?: string; x: number; y: number; width: number;
    align: "left" | "center" | "right";
  }>>;
  pages: string[];
  activePage: number;
  spreadsheetName: string;
  spreadsheetContent: string;
  spreadsheetNotSaved?: boolean;
  placeholderMap: Record<string, string>;
  mailingMap: { mailing_name: string; mailing_addr1: string; mailing_addr2: string; mailing_addr3: string };
  selectedLogoId?: string;
  selectedReturnId?: string;
}
```

### Step 2: Add restore-on-mount

Find the existing `useEffect([], [])` mount effect (where localStorage favorites/recently-used are loaded — around line 568). At the **end** of this effect's callback, after all the existing `localStorage.getItem` calls, add:

```tsx
// Restore letter draft
try {
  const raw = localStorage.getItem(DRAFT_KEY);
  if (raw) {
    const draft: LetterDraft = JSON.parse(raw);
    if (draft.title) setLetterTitle(draft.title);
    if (draft.bodyContentByPage && Object.keys(draft.bodyContentByPage).length) {
      setBodyContentByPage(draft.bodyContentByPage);
    }
    if (draft.blocksByPage && Object.keys(draft.blocksByPage).length) {
      setBlocksByPage(draft.blocksByPage as Record<number, PlacedBlock[]>);
    }
    if (draft.pages?.length) {
      setPages(draft.pages);
      setActivePage(Math.min(draft.activePage ?? 0, draft.pages.length - 1));
    }
    if (draft.spreadsheetName) setSpreadsheetName(draft.spreadsheetName);
    if (!draft.spreadsheetNotSaved && draft.spreadsheetContent) {
      setSpreadsheetContent(draft.spreadsheetContent);
    }
    if (draft.placeholderMap) setPlaceholderMap(draft.placeholderMap);
    if (draft.mailingMap) setMailingMap(draft.mailingMap);
    if (draft.selectedLogoId) {
      // Defer until library is populated — library is already loaded at this point
      const logo = libraryRef.current?.Logos?.find((l) => l.id === draft.selectedLogoId);
      if (logo) setSelectedLogo(logo);
    }
    if (draft.selectedReturnId) {
      const ret = libraryRef.current?.["Return Address"]?.find((r) => r.id === draft.selectedReturnId);
      if (ret) setSelectedReturn(ret);
    }
  }
} catch {
  // Corrupted draft — ignore and start fresh
}
```

**Note on `libraryRef`:** The library is initialized from `useState` with seed data so it's always available at mount. If `libraryRef` doesn't exist, use `library` directly (the `useState` initial value is the seed, which is available synchronously). Check whether a `libraryRef` exists; if not, just use the `library` state variable directly in the restore effect.

### Step 3: Add debounced autosave effect

After the restore effect, add:

```tsx
// Autosave — debounced 500ms after any tracked value changes
useEffect(() => {
  const timer = setTimeout(() => {
    try {
      const draft: LetterDraft = {
        title: letterTitle,
        bodyContentByPage,
        blocksByPage,
        pages,
        activePage,
        spreadsheetName: spreadsheetName ?? "",
        spreadsheetContent: spreadsheetContent ?? "",
        placeholderMap,
        mailingMap,
        selectedLogoId: selectedLogo?.id,
        selectedReturnId: selectedReturn?.id,
      };
      const serialized = JSON.stringify(draft);
      if (serialized.length > 4 * 1024 * 1024) {
        // Over 4MB — omit spreadsheet CSV
        const slim = { ...draft, spreadsheetContent: "", spreadsheetNotSaved: true };
        localStorage.setItem(DRAFT_KEY, JSON.stringify(slim));
      } else {
        localStorage.setItem(DRAFT_KEY, serialized);
      }
      setSavedAgo("just now");
    } catch {
      // localStorage quota exceeded — skip silently
    }
  }, 500);
  return () => clearTimeout(timer);
}, [
  letterTitle, bodyContentByPage, blocksByPage, pages, activePage,
  spreadsheetName, spreadsheetContent, placeholderMap, mailingMap,
  selectedLogo?.id, selectedReturn?.id,
]);
```

**Finding state variable names:** The exact variable names may differ slightly from what's shown here. Read the `useState` declarations in BuilderClient to find:
- `letterTitle` / `setLetterTitle` — editable title in Topbar
- `spreadsheetName` / `setSpreadsheetName` — name of uploaded CSV
- `spreadsheetContent` / `setSpreadsheetContent` — raw CSV string
- `placeholderMap` / `setPlaceholderMap` — `Record<string, string>` mapping placeholder → column
- `mailingMap` / `setMailingMap` — 4-field object
- `selectedLogo` / `setSelectedLogo` — selected `LibraryItem`
- `selectedReturn` / `setSelectedReturn` — selected `LibraryItem`
- `setSavedAgo` — already exists, wired to the "Saved just now" badge

### Step 4: Add "spreadsheet not saved" hint in DataPanel

In `apps/web/app/components/DataPanel.tsx`, add an optional prop `spreadsheetNotPersisted?: boolean`. When true, show a small amber warning inside the panel:

```tsx
// In DataPanel props:
spreadsheetNotPersisted?: boolean;

// In DataPanel JSX, near the file input area:
{spreadsheetNotPersisted && (
  <p className="data-warn-small">
    Spreadsheet is too large to auto-save — re-upload after refresh.
  </p>
)}
```

Add CSS to globals.css:
```css
.data-warn-small {
  font-size: 0.75rem;
  color: var(--warn);
  margin-top: 6px;
}
```

In BuilderClient, track this state:
```tsx
const [spreadsheetNotPersisted, setSpreadsheetNotPersisted] = useState(false);
```

In the autosave effect, when the over-4MB branch executes, also call `setSpreadsheetNotPersisted(true)`. On a normal save, call `setSpreadsheetNotPersisted(false)`.

Pass `spreadsheetNotPersisted={spreadsheetNotPersisted}` when rendering `<DataPanel>`.

### Step 5: Verify (manual)

1. Start dev server. Type a letter body, set a title, upload a spreadsheet.
2. Refresh the page. Verify: title, body content, spreadsheet name all restore.
3. Open DevTools → Application → localStorage → confirm `adhoc_letter_draft` key exists with correct JSON.
4. "Saved just now" badge should update after each keystroke (with 500ms delay).

### Step 6: Commit

```bash
git add apps/web/app/BuilderClient.tsx apps/web/app/components/DataPanel.tsx apps/web/app/globals.css
git commit -m "feat: autosave letter state to localStorage with 500ms debounce"
```

---

## TASK 4: TaglineLibrary component extraction

**Files:**
- Create: `apps/web/app/components/TaglineLibrary.tsx`
- Modify: `apps/web/app/BuilderClient.tsx` (delete inline JSX, add import + `<TaglineLibrary>`)

### Context

The tagline flyout panel is the only sidebar panel that was NOT extracted to a component in Phases 1–3. It lives inline in `BuilderClient.tsx` between roughly lines 2399–2515 inside the `openMenuTab === "Taglines"` branch. This task extracts it using the same pattern as `VerbiageLibrary.tsx`.

### Step 1: Read the existing inline tagline flyout

Read `BuilderClient.tsx` lines 2399–2515 carefully. Identify all state/handlers it references:
- `recentlyUsedTaglines` — `string[]` of recently used IDs
- `flyoutQuery` — shared search string from the FlyoutPanel search input
- `taglineSortOrder` — `"recent" | "a-z" | "favorites"`, controlled by a `<select>`
- `setTaglineSortOrder` — setter
- `favoriteTaglines` — `string[]` of favorited IDs
- `hoverTaglineId` — `string | null`, which tagline is being hovered for preview
- `setHoverTaglineId` — setter
- `library.Taglines` — source of items
- `filterFlyoutItems("Taglines")` — filters items by `flyoutQuery`
- `addLibraryItemToCanvas(item)` — inserts on click
- `toggleTaglineFavorite(id, e)` — star/unstar
- `handleDragStart(event, item)` / `handleDragEnd` — drag to canvas
- `taglineListRef` — scroll ref

### Step 2: Create `TaglineLibrary.tsx`

Create `apps/web/app/components/TaglineLibrary.tsx`:

```tsx
"use client";

import { useRef } from "react";

export interface TaglineItem {
  id: string;
  label: string;
  content?: string;
}

interface TaglineLibraryProps {
  items: TaglineItem[];               // all taglines (from library.Taglines)
  query: string;                      // from shared flyoutQuery
  sortOrder: "recent" | "a-z" | "favorites";
  onSortChange: (order: "recent" | "a-z" | "favorites") => void;
  recentlyUsed: string[];
  favorites: string[];
  hoverTaglineId: string | null;
  onHoverChange: (id: string | null) => void;
  onToggleFavorite: (id: string, e: React.MouseEvent) => void;
  onSelect: (item: TaglineItem) => void;
  onDragStart: (event: React.DragEvent, item: TaglineItem) => void;
  onDragEnd: () => void;
}

export function TaglineLibrary({
  items,
  query,
  sortOrder,
  onSortChange,
  recentlyUsed,
  favorites,
  hoverTaglineId,
  onHoverChange,
  onToggleFavorite,
  onSelect,
  onDragStart,
  onDragEnd,
}: TaglineLibraryProps) {
  const listRef = useRef<HTMLDivElement | null>(null);

  const term = query.trim().toLowerCase();
  let filtered = term
    ? items.filter(
        (item) =>
          item.label.toLowerCase().includes(term) ||
          (item.content ?? "").toLowerCase().includes(term)
      )
    : [...items];

  if (!term) {
    if (sortOrder === "a-z") {
      filtered.sort((a, b) => a.label.localeCompare(b.label));
    } else if (sortOrder === "favorites") {
      filtered.sort((a, b) => {
        const aFav = favorites.includes(a.id) ? 0 : 1;
        const bFav = favorites.includes(b.id) ? 0 : 1;
        return aFav - bFav || a.label.localeCompare(b.label);
      });
    } else {
      // recent — sort by recentlyUsed order
      filtered.sort((a, b) => {
        const ai = recentlyUsed.indexOf(a.id);
        const bi = recentlyUsed.indexOf(b.id);
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi) || a.label.localeCompare(b.label);
      });
    }
  }

  const recentItems = recentlyUsed
    .map((id) => items.find((t) => t.id === id))
    .filter(Boolean) as TaglineItem[];

  const activePreview = hoverTaglineId
    ? items.find((t) => t.id === hoverTaglineId)
    : null;

  return (
    <div className="library-panel-enhanced">
      {/* Recently Used */}
      {recentItems.length > 0 && !term && (
        <div className="library-section">
          <div className="library-section-header">
            <span className="library-section-title">Recently Used</span>
          </div>
          <div className="library-recent-chips">
            {recentItems.map((item) => (
              <div
                key={item.id}
                className="library-chip"
                draggable
                onDragStart={(e) => onDragStart(e, item)}
                onDragEnd={onDragEnd}
                onClick={() => onSelect(item)}
                title={item.content ?? item.label}
              >
                {item.label}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main list + preview */}
      <div className="library-section">
        <div className="library-section-header">
          <span className="library-section-title">{term ? "Results" : "All Taglines"}</span>
          {!term && (
            <select
              className="library-sort-select"
              value={sortOrder}
              onChange={(e) => onSortChange(e.target.value as "recent" | "a-z" | "favorites")}
            >
              <option value="recent">Recent</option>
              <option value="a-z">A-Z</option>
              <option value="favorites">Favorites</option>
            </select>
          )}
        </div>

        <div className="tagline-two-column">
          <div className="tagline-list" ref={listRef}>
            {filtered.map((item) => (
              <div
                key={item.id}
                className={`tagline-list-item${favorites.includes(item.id) ? " favorited" : ""}`}
                draggable
                onDragStart={(e) => onDragStart(e, item)}
                onDragEnd={onDragEnd}
                onClick={() => onSelect(item)}
                onMouseEnter={() => onHoverChange(item.id)}
                onMouseLeave={() => onHoverChange(null)}
                onFocus={() => onHoverChange(item.id)}
                onBlur={() => onHoverChange(null)}
                tabIndex={0}
              >
                <span className="drag-handle-icon">⋮⋮</span>
                <span className="library-item-label">{item.label}</span>
                <button
                  type="button"
                  className={`library-favorite-btn${favorites.includes(item.id) ? " active" : ""}`}
                  onClick={(e) => onToggleFavorite(item.id, e)}
                  title={favorites.includes(item.id) ? "Remove from favorites" : "Add to favorites"}
                >
                  {favorites.includes(item.id) ? "★" : "☆"}
                </button>
              </div>
            ))}
          </div>

          <div className="tagline-preview-panel">
            {activePreview ? (
              <>
                <div className="tagline-preview-title">{activePreview.label}</div>
                <p>{activePreview.content ?? activePreview.label}</p>
              </>
            ) : (
              <p className="hint">Hover a tagline to preview.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

### Step 3: Wire TaglineLibrary in BuilderClient

Add import to `BuilderClient.tsx`:
```tsx
import { TaglineLibrary, type TaglineItem } from "./components/TaglineLibrary";
```

Find the `openMenuTab === "Taglines"` branch in the flyout JSX (around line 2399). Delete the entire inline JSX block (from `<div className="library-panel-enhanced">` to its closing `</div>`) and replace with:

```tsx
<TaglineLibrary
  items={(library.Taglines ?? []).map((t) => ({
    id: t.id,
    label: t.label,
    content: t.content ?? undefined,
  }))}
  query={flyoutQuery}
  sortOrder={taglineSortOrder}
  onSortChange={setTaglineSortOrder}
  recentlyUsed={recentlyUsedTaglines}
  favorites={favoriteTaglines}
  hoverTaglineId={hoverTaglineId}
  onHoverChange={setHoverTaglineId}
  onToggleFavorite={toggleTaglineFavorite}
  onSelect={addLibraryItemToCanvas}
  onDragStart={handleDragStart}
  onDragEnd={handleDragEnd}
/>
```

**Note on types:** `addLibraryItemToCanvas` takes a `LibraryItem` but `TaglineLibrary.onSelect` takes a `TaglineItem`. You may need a wrapper:
```tsx
onSelect={(item: TaglineItem) => {
  const full = (library.Taglines ?? []).find((t) => t.id === item.id);
  if (full) addLibraryItemToCanvas(full);
}}
```

Also remove any now-unused variables: `taglineListRef` (if only used by the inline JSX), `hoverTaglineId`/`setHoverTaglineId` (now passed to the component — keep these as they're still used here).

### Step 4: Verify (manual)

1. Click the Taglines tab in the sidebar — flyout opens.
2. Search for "proud" — list filters.
3. Sort A-Z — list re-orders.
4. Hover a tagline — preview panel shows content.
5. Star a tagline — it persists after re-opening the flyout.
6. Click a tagline — it inserts on the canvas.
7. Drag a tagline — it can be dropped on the canvas.

### Step 5: Commit

```bash
git add apps/web/app/components/TaglineLibrary.tsx apps/web/app/BuilderClient.tsx
git commit -m "feat: extract TaglineLibrary component from BuilderClient"
```

---

## TASK 5: Multi-page — page navigator strip + generate all pages

**Files:**
- Modify: `apps/web/app/BuilderClient.tsx`
- Modify: `apps/web/app/globals.css` (append page navigator styles)

### Context

`BuilderClient` already has `pages: string[]`, `activePage: number`, and `bodyContentByPage: Record<number, string>` state. However, there is no UI to add/remove/navigate pages. Generate currently hardcodes `bodyContentByPage[0]` — it ignores any content on pages beyond page 0. This task adds a page navigator strip and fixes Generate.

### Step 1: Add addPage and deletePage handlers

Find the handlers section of `BuilderClient` (around line 1000+). Add:

```tsx
const addPage = () => {
  const next = pages.length;
  setPages((prev) => [...prev, `Page ${next + 1}`]);
  setActivePage(next);
};

const deletePage = (index: number) => {
  if (pages.length <= 1) return;
  setPages((prev) => prev.filter((_, i) => i !== index));
  setBodyContentByPage((prev) => {
    const next: Record<number, string> = {};
    Object.entries(prev).forEach(([k, v]) => {
      const ki = parseInt(k);
      if (ki < index) next[ki] = v;
      else if (ki > index) next[ki - 1] = v;
    });
    return next;
  });
  setBlocksByPage((prev) => {
    const next: Record<number, PlacedBlock[]> = {};
    Object.entries(prev).forEach(([k, v]) => {
      const ki = parseInt(k);
      if (ki < index) next[ki] = v;
      else if (ki > index) next[ki - 1] = v;
    });
    return next;
  });
  setActivePage((prev) => Math.max(0, prev >= index ? prev - 1 : prev));
};
```

### Step 2: Add page navigator JSX

Find the `<main className="canvas-panel">` in BuilderClient's return (around line 2587). After `<div className="workspace">` and before `<div className="canvas-area">`, add the page navigator:

```tsx
{/* Page navigator strip */}
<div className="page-navigator">
  {pages.map((label, i) => (
    <div key={i} className={`page-tab${activePage === i ? " active" : ""}`}>
      <button
        type="button"
        className="page-tab-label"
        onClick={() => setActivePage(i)}
      >
        {label}
      </button>
      {pages.length > 1 && (
        <button
          type="button"
          className="page-tab-delete"
          aria-label={`Delete ${label}`}
          onClick={() => deletePage(i)}
        >
          ×
        </button>
      )}
    </div>
  ))}
  <button type="button" className="page-add-btn" onClick={addPage}>
    + Add page
  </button>
</div>
```

### Step 3: Add page navigator CSS

Append to the end of `apps/web/app/globals.css`:

```css
/* ── Page Navigator ── */
.page-navigator {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 0 12px;
  height: 36px;
  background: var(--ink-50);
  border-bottom: 1px solid var(--outline);
  overflow-x: auto;
  flex-shrink: 0;
}
.page-tab {
  display: flex;
  align-items: center;
  border-radius: 6px 6px 0 0;
}
.page-tab.active .page-tab-label {
  color: var(--accent);
  border-bottom: 2px solid var(--accent);
  font-weight: 600;
}
.page-tab-label {
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  padding: 0 8px;
  height: 36px;
  font-size: 0.8rem;
  color: var(--ink-500);
  cursor: pointer;
  white-space: nowrap;
}
.page-tab-label:hover { color: var(--ink-900); }
.page-tab-delete {
  background: none;
  border: none;
  color: var(--ink-300);
  cursor: pointer;
  font-size: 1rem;
  padding: 0 4px;
  line-height: 1;
}
.page-tab-delete:hover { color: var(--danger); }
.page-add-btn {
  background: none;
  border: none;
  color: var(--ink-500);
  cursor: pointer;
  font-size: 0.8rem;
  padding: 0 8px;
  white-space: nowrap;
  margin-left: 4px;
}
.page-add-btn:hover { color: var(--accent); }
```

### Step 4: Fix Generate to send all pages

Find `handleGenerate` (around line 1817). Change the `template_html` line in the fetch payload:

```tsx
// BEFORE:
template_html: stripInlineControls(bodyContentByPage[0] ?? ""),

// AFTER:
template_html: pages
  .map((_, i) => stripInlineControls(bodyContentByPage[i] ?? ""))
  .map((html, i) => i === 0 ? html : `<div style="page-break-before:always">${html}</div>`)
  .join(""),
```

### Step 5: Verify (manual)

1. Start dev server. Confirm a single page tab "Page 1" is visible below the Topbar.
2. Click "+ Add page" → "Page 2" tab appears, canvas switches to blank page 2.
3. Type content on page 2. Switch to page 1 → original content preserved.
4. Click × on page 2 → tab removed, back to page 1.
5. With API running, add page 2, type some content, Generate → confirm the downloaded file has two pages (open in a PDF viewer or check file size is larger than single-page).
6. Verify autosave (Task 3) saves both pages — refresh, confirm both pages restore.

### Step 6: Commit

```bash
git add apps/web/app/BuilderClient.tsx apps/web/app/globals.css
git commit -m "feat: multi-page support — page navigator strip, add/delete pages, generate all pages"
```

---

## Final Verification

After all 5 tasks are complete, run through this checklist:

| Feature | Test |
|---|---|
| Toast — info | Click Generate with no spreadsheet → toast appears, no alert() |
| Toast — success | Generate successfully → "AFP downloaded — N letters generated" toast |
| Toast — error | Generate with API offline → error toast with message |
| Topbar spinner | Generate in-flight → button shows spinner + "Generating…" |
| Autosave | Edit title + body + upload CSV → refresh → all restored |
| Autosave badge | Edit content → "Saved just now" badge updates |
| TaglineLibrary | Tagline tab → search, sort, hover preview, click insert, drag, star all work |
| Multi-page | Add page → edit → switch → content preserved per page |
| Multi-page delete | Delete non-active page → other pages unaffected |
| Generate all pages | 2-page letter → Generate → file has page break |

**TypeScript check:**
```bash
cd apps/web && npx tsc --noEmit 2>&1 | grep -v "node_modules\|\.next" | head -20
```
Expected: no errors from `app/` source files.

**Production build:**
```bash
cd apps/web && npm run build 2>&1 | tail -10
```
Expected: `✓ Generating static pages` with no errors.
