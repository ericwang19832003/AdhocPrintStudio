# AdhocPrintStudio UI Redesign — Phase 1–3 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the "Redesign v2" PDF in three phases: design tokens + shell, library panels + data flow, and advanced features.

**Architecture:** All UI lives in `apps/web/app/`. BuilderClient.tsx is split into focused component files under `apps/web/app/components/`. State stays in BuilderClient.tsx as the root orchestrator. CSS variables in globals.css drive the entire color/font system — no Tailwind added.

**Tech Stack:** Next.js 14, React 18, Tiptap editor, plain CSS variables, Google Fonts (Inter + Source Serif 4 + JetBrains Mono), xlsx (CSV parsing, already installed), mammoth (Word import, already installed).

**Dev server:** `cd apps/web && npm run dev` → http://localhost:3000  
**No backend changes needed for Phase 1 or Phase 2** (CSV parsing is client-side, data is in-memory).  
**Phase 3 manage library is UI-only** (reads from existing seed data).

---

## PHASE 1: Design Foundation

### Task 1: Design tokens + font imports

**Files:**
- Modify: `apps/web/app/layout.tsx`
- Modify: `apps/web/app/globals.css` (top section only — replace `:root` block)

**Step 1: Add Google Fonts to layout.tsx**

Replace entire `apps/web/app/layout.tsx`:

```tsx
import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Adhoc Print Studio",
  description: "Compose and generate print-ready letters",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Source+Serif+4:ital,wght@0,400;0,600;1,400&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="app-body">{children}</body>
    </html>
  );
}
```

**Step 2: Replace `:root` in globals.css**

Find the existing `:root { ... }` block (lines 1–13 currently) and replace it with:

```css
:root {
  /* Neutrals */
  --ink-900: #0b1220;
  --ink-700: #1f2937;
  --ink-500: #4b5563;
  --ink-300: #9ca3af;
  --ink-150: #e5e7eb;
  --ink-50:  #f8fafc;

  /* Accent — warm rust */
  --accent:       #b3502f;
  --accent-hover: #9a4326;
  --accent-ink:   #7a3318;
  --accent-soft:  #fdeee6;

  /* Status */
  --success: #0f7a55;
  --warn:    #b45309;
  --danger:  #b42318;
  --info:    #1d5fbe;

  /* Aliases for existing code */
  --bg:      var(--ink-50);
  --panel:   #ffffff;
  --ink:     var(--ink-900);
  --muted:   var(--ink-500);
  --outline: var(--ink-150);
  --shadow:  0 4px 16px rgba(11, 18, 32, 0.10);
  --radius:  10px;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--bg);
  color: var(--ink);
  font-family: "Inter", "Helvetica Neue", Arial, sans-serif;
  font-size: 14px;
  line-height: 1.5;
}

/* Letter body uses serif — matches what will actually print */
.letter-body,
.letter-canvas .tiptap,
.letter-canvas [contenteditable] {
  font-family: "Source Serif 4", Georgia, serif;
}

/* Data / placeholder tokens use mono */
.mono, .placeholder-token, .col-name, code {
  font-family: "JetBrains Mono", "Courier New", monospace;
  font-size: 0.85em;
}
```

**Step 3: Update accent color references in globals.css**

Run a find-replace for the old hard-coded values so existing components pick up the new accent:

```bash
cd apps/web
# Replace old button.primary background with accent
sed -i '' 's/#0f172a/var(--ink-900)/g' app/globals.css
sed -i '' 's/#0b1220/var(--ink-900)/g' app/globals.css
```

Then manually update `button.primary` rule in globals.css to use `--accent`:
```css
button.primary {
  background: var(--accent);
  color: white;
}
button.primary:hover {
  background: var(--accent-hover);
}
```

**Step 4: Verify font loads**

Run `cd apps/web && npm run dev`, open http://localhost:3000, check DevTools → Network for `fonts.googleapis.com` requests. Body text should render in Inter.

**Step 5: Commit**

```bash
cd apps/web
git add app/layout.tsx app/globals.css
git commit -m "feat: design tokens — warm rust accent, Inter/Source Serif 4/JetBrains Mono"
```

---

### Task 2: New topbar

**Files:**
- Create: `apps/web/app/components/Topbar.tsx`
- Modify: `apps/web/app/globals.css` (add `.topbar-v2` styles)
- Modify: `apps/web/app/BuilderClient.tsx` (swap in new topbar)

**Step 1: Create `apps/web/app/components/Topbar.tsx`**

```tsx
"use client";

import { CheckCircle } from "lucide-react";

type TopbarProps = {
  letterTitle: string;
  onTitleChange: (t: string) => void;
  savedAgo: string | null;          // e.g. "2m ago" or null while saving
  onExport: () => void;
  onPreview: () => void;
  onGenerate: () => void;
  generateDisabled?: boolean;
};

export function Topbar({
  letterTitle,
  onTitleChange,
  savedAgo,
  onExport,
  onPreview,
  onGenerate,
  generateDisabled,
}: TopbarProps) {
  return (
    <header className="topbar-v2">
      {/* Left: brand */}
      <div className="topbar-brand">
        <div className="topbar-brand-avatar">A</div>
        <span className="topbar-brand-name">Adhoc Print Studio</span>
        <span className="topbar-brand-divider">·</span>
        <span className="topbar-brand-suffix">By PSD</span>
      </div>

      {/* Center: title + save status */}
      <div className="topbar-center">
        <input
          className="topbar-title-input"
          value={letterTitle}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Untitled letter"
          spellCheck={false}
        />
        {savedAgo !== null && (
          <div className="topbar-save-status">
            <CheckCircle size={14} className="save-check" />
            <span>Saved</span>
            <span className="save-ago">{savedAgo}</span>
          </div>
        )}
      </div>

      {/* Right: actions */}
      <div className="topbar-actions-v2">
        <button className="btn-ghost-sm" onClick={onExport}>Export</button>
        <button className="btn-outline-sm" onClick={onPreview}>Preview</button>
        <button className="btn-accent" onClick={onGenerate} disabled={generateDisabled}>
          Generate
        </button>
      </div>
    </header>
  );
}
```

**Step 2: Add topbar styles to globals.css**

Append at the bottom of globals.css:

```css
/* ── Topbar v2 ─────────────────────────────────────────────────────── */
.topbar-v2 {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 52px;
  padding: 0 20px;
  border-bottom: 1px solid var(--outline);
  background: var(--panel);
  position: sticky;
  top: 0;
  z-index: 30;
  gap: 16px;
}

.topbar-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
}

.topbar-brand-avatar {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: var(--accent);
  color: white;
  font-weight: 700;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.topbar-brand-name {
  font-weight: 600;
  font-size: 14px;
  color: var(--ink-900);
}

.topbar-brand-divider,
.topbar-brand-suffix {
  color: var(--ink-300);
  font-size: 13px;
}

.topbar-center {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  justify-content: center;
}

.topbar-title-input {
  border: none !important;
  background: transparent !important;
  font-size: 14px;
  font-weight: 500;
  color: var(--ink-900);
  text-align: center;
  width: 200px;
  padding: 4px 8px !important;
  border-radius: 6px !important;
  transition: background 0.15s;
}
.topbar-title-input:hover { background: var(--ink-50) !important; }
.topbar-title-input:focus { background: var(--ink-50) !important; outline: none; }

.topbar-save-status {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--success);
  font-size: 12px;
}
.save-check { color: var(--success); }
.save-ago { color: var(--ink-500); }

.topbar-actions-v2 {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
}

.btn-ghost-sm {
  background: transparent;
  border: 1px solid var(--outline);
  color: var(--ink-700);
  padding: 6px 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}
.btn-ghost-sm:hover { background: var(--ink-50); }

.btn-outline-sm {
  background: var(--panel);
  border: 1px solid var(--outline);
  color: var(--ink-700);
  padding: 6px 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}
.btn-outline-sm:hover { background: var(--ink-50); }

.btn-accent {
  background: var(--accent);
  color: white;
  border: none;
  padding: 6px 18px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.btn-accent:hover:not(:disabled) { background: var(--accent-hover); }
.btn-accent:disabled { opacity: 0.45; cursor: not-allowed; }
```

**Step 3: Wire Topbar into BuilderClient.tsx**

Near the top of BuilderClient.tsx imports add:
```tsx
import { Topbar } from "./components/Topbar";
```

Add state for letter title and save status:
```tsx
const [letterTitle, setLetterTitle] = useState("Untitled letter");
const [savedAgo, setSavedAgo] = useState<string | null>("just now");
```

Replace the existing `<div className="topbar">` block with:
```tsx
<Topbar
  letterTitle={letterTitle}
  onTitleChange={setLetterTitle}
  savedAgo={savedAgo}
  onExport={() => { /* existing export logic */ }}
  onPreview={() => setShowPreview(true)}
  onGenerate={() => { /* existing generate logic */ }}
  generateDisabled={generating || !columns.length}
/>
```

**Step 4: Install lucide-react (needed for CheckCircle icon)**

```bash
cd apps/web && npm install lucide-react
```

**Step 5: Verify topbar renders**

`npm run dev` → confirm topbar shows brand, editable title, save indicator, 3 buttons.

**Step 6: Commit**

```bash
git add apps/web/app/components/Topbar.tsx apps/web/app/globals.css apps/web/app/BuilderClient.tsx apps/web/app/layout.tsx apps/web/package.json apps/web/package-lock.json
git commit -m "feat: new topbar with brand, editable title, save status, accent Generate button"
```

---

### Task 3: Sidebar icon nav (72px strip)

The current sidebar is already 72px wide. This task makes it match the design — icon-only buttons with labels below, active indicator on the left edge.

**Files:**
- Create: `apps/web/app/components/SidebarNav.tsx`
- Modify: `apps/web/app/globals.css`
- Modify: `apps/web/app/BuilderClient.tsx`

**Step 1: Create `apps/web/app/components/SidebarNav.tsx`**

```tsx
"use client";

import {
  ImageIcon,
  MapPin,
  MessageSquare,
  Tag,
  FileText,
  Upload,
  Database,
} from "lucide-react";

export type SidebarTab = "Logo" | "Return" | "Verbiage" | "Tagline" | "Templates" | "Import" | "Data";

const NAV_ITEMS: { id: SidebarTab; label: string; Icon: React.FC<any> }[] = [
  { id: "Logo",      label: "Logo",      Icon: ImageIcon },
  { id: "Return",    label: "Return",    Icon: MapPin },
  { id: "Verbiage",  label: "Verbiage",  Icon: MessageSquare },
  { id: "Tagline",   label: "Tagline",   Icon: Tag },
  { id: "Templates", label: "Templates", Icon: FileText },
  { id: "Import",    label: "Import",    Icon: Upload },
  { id: "Data",      label: "Data",      Icon: Database },
];

type SidebarNavProps = {
  active: SidebarTab | null;
  onSelect: (tab: SidebarTab) => void;
};

export function SidebarNav({ active, onSelect }: SidebarNavProps) {
  return (
    <nav className="sidebar-nav">
      {NAV_ITEMS.map(({ id, label, Icon }) => (
        <button
          key={id}
          className={`sidebar-nav-btn${active === id ? " active" : ""}`}
          onClick={() => onSelect(id)}
          title={label}
        >
          <Icon size={20} strokeWidth={1.8} />
          <span className="sidebar-nav-label">{label}</span>
        </button>
      ))}
    </nav>
  );
}
```

**Step 2: Add sidebar nav styles to globals.css**

```css
/* ── Sidebar nav v2 ──────────────────────────────────────────────── */
.sidebar-nav {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 72px;
  flex: 0 0 72px;
  border-right: 1px solid var(--outline);
  background: var(--panel);
  padding: 8px 0;
  gap: 2px;
}

.sidebar-nav-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  width: 60px;
  padding: 8px 4px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--ink-500);
  cursor: pointer;
  position: relative;
  transition: color 0.15s, background 0.15s;
  font-size: 11px;
  font-weight: 500;
}

.sidebar-nav-btn:hover {
  color: var(--ink-900);
  background: var(--ink-50);
}

.sidebar-nav-btn.active {
  color: var(--accent);
  background: var(--accent-soft);
}

/* Left-edge accent bar on active */
.sidebar-nav-btn.active::before {
  content: "";
  position: absolute;
  left: -6px;
  top: 8px;
  bottom: 8px;
  width: 3px;
  background: var(--accent);
  border-radius: 0 2px 2px 0;
}

.sidebar-nav-label {
  font-size: 10px;
  line-height: 1;
  text-align: center;
}
```

**Step 3: Wire into BuilderClient.tsx**

Import at top:
```tsx
import { SidebarNav, type SidebarTab } from "./components/SidebarNav";
```

Change `openMenuTab` type to `SidebarTab | null` and replace the `<div className="library">` + existing sidebar buttons with:
```tsx
<SidebarNav
  active={openMenuTab as SidebarTab | null}
  onSelect={(tab) => setOpenMenuTab(openMenuTab === tab ? null : tab)}
/>
```

**Step 4: Verify sidebar renders with icons**

`npm run dev` → sidebar should show 7 icon buttons, active one gets rust highlight.

**Step 5: Commit**

```bash
git add apps/web/app/components/SidebarNav.tsx apps/web/app/globals.css apps/web/app/BuilderClient.tsx
git commit -m "feat: icon sidebar nav with active accent indicator"
```

---

### Task 4: Right inspector panel (Block / Document / Merge tabs)

**Files:**
- Create: `apps/web/app/components/InspectorPanel.tsx`
- Modify: `apps/web/app/globals.css`
- Modify: `apps/web/app/BuilderClient.tsx`

**Step 1: Create `apps/web/app/components/InspectorPanel.tsx`**

```tsx
"use client";

import { CheckCircle2, AlertTriangle } from "lucide-react";

export type ReadinessItem = {
  label: string;
  status: "ok" | "warn" | "error";
  detail?: string;
};

type SelectedBlock = {
  label: string;
  type: string;
  x: number;
  y: number;
  align: "left" | "center" | "right";
  content?: string;
} | null;

type InspectorPanelProps = {
  selectedBlock: SelectedBlock;
  onAlignChange: (align: "left" | "center" | "right") => void;
  onXChange: (x: number) => void;
  onYChange: (y: number) => void;
  readiness: ReadinessItem[];
  onOpenMerge: () => void;
};

export function InspectorPanel({
  selectedBlock,
  onAlignChange,
  onXChange,
  onYChange,
  readiness,
  onOpenMerge,
}: InspectorPanelProps) {
  const [activeTab, setActiveTab] = useState<"block" | "document" | "merge">("block");

  return (
    <aside className="inspector-panel">
      {/* Tab strip */}
      <div className="inspector-tabs">
        {(["block", "document", "merge"] as const).map((tab) => (
          <button
            key={tab}
            className={`inspector-tab${activeTab === tab ? " active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <div className="inspector-body">
        {/* Block tab */}
        {activeTab === "block" && (
          <div className="inspector-section">
            {selectedBlock ? (
              <>
                <div className="inspector-block-header">
                  <span className="inspector-type-chip">{selectedBlock.type.toUpperCase()}</span>
                  <span className="inspector-block-label">{selectedBlock.label}</span>
                </div>

                <div className="inspector-field-group">
                  <label className="inspector-label">POSITION</label>
                  <div className="inspector-xy-row">
                    <div className="inspector-xy-field">
                      <span>X</span>
                      <input
                        type="number"
                        value={selectedBlock.x}
                        onChange={(e) => onXChange(Number(e.target.value))}
                      />
                    </div>
                    <div className="inspector-xy-field">
                      <span>Y</span>
                      <input
                        type="number"
                        value={selectedBlock.y}
                        onChange={(e) => onYChange(Number(e.target.value))}
                      />
                    </div>
                  </div>
                </div>

                <div className="inspector-field-group">
                  <label className="inspector-label">ALIGNMENT</label>
                  <div className="inspector-align-row">
                    {(["left", "center", "right"] as const).map((a) => (
                      <button
                        key={a}
                        className={`inspector-align-btn${selectedBlock.align === a ? " active" : ""}`}
                        onClick={() => onAlignChange(a)}
                      >
                        {a === "left" ? "⬛▭▭" : a === "center" ? "▭⬛▭" : "▭▭⬛"}
                      </button>
                    ))}
                  </div>
                </div>

                {selectedBlock.content && (
                  <div className="inspector-field-group">
                    <label className="inspector-label">CONTENT</label>
                    <p className="inspector-content-preview">{selectedBlock.content.slice(0, 120)}{selectedBlock.content.length > 120 ? "…" : ""}</p>
                  </div>
                )}
              </>
            ) : (
              <p className="inspector-empty">Select a block on the canvas to see its properties.</p>
            )}
          </div>
        )}

        {/* Document tab — placeholder */}
        {activeTab === "document" && (
          <div className="inspector-section">
            <p className="inspector-empty">Document-level settings coming soon.</p>
          </div>
        )}

        {/* Merge tab — always shows readiness */}
        {activeTab === "merge" && (
          <div className="inspector-section">
            <label className="inspector-label">MERGE READINESS</label>
            <div className="readiness-list">
              {readiness.map((item) => (
                <div key={item.label} className={`readiness-row readiness-${item.status}`}>
                  {item.status === "ok"
                    ? <CheckCircle2 size={14} />
                    : <AlertTriangle size={14} />}
                  <span className="readiness-label">{item.label}</span>
                  {item.detail && <span className="readiness-detail">{item.detail}</span>}
                </div>
              ))}
            </div>
            <button className="btn-accent readiness-merge-btn" onClick={onOpenMerge}>
              Open merge panel →
            </button>
          </div>
        )}
      </div>

      {/* Always-visible readiness summary at bottom of Block/Document tabs */}
      {activeTab !== "merge" && (
        <div className="inspector-readiness-footer">
          <label className="inspector-label">MERGE READINESS</label>
          <div className="readiness-list">
            {readiness.map((item) => (
              <div key={item.label} className={`readiness-row readiness-${item.status}`}>
                {item.status === "ok"
                  ? <CheckCircle2 size={14} />
                  : <AlertTriangle size={14} />}
                <span className="readiness-label">{item.label}</span>
                {item.detail && <span className="readiness-detail">{item.detail}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}
```

Note: add `import { useState } from "react";` at the top of InspectorPanel.tsx.

**Step 2: Add inspector styles to globals.css**

```css
/* ── Inspector panel ─────────────────────────────────────────────── */
.inspector-panel {
  width: 260px;
  flex: 0 0 260px;
  border-left: 1px solid var(--outline);
  background: var(--panel);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.inspector-tabs {
  display: flex;
  border-bottom: 1px solid var(--outline);
}

.inspector-tab {
  flex: 1;
  padding: 10px 4px;
  border: none;
  background: transparent;
  font-size: 12px;
  font-weight: 600;
  color: var(--ink-500);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  text-transform: none;
}

.inspector-tab.active {
  color: var(--ink-900);
  border-bottom-color: var(--ink-900);
}

.inspector-body {
  flex: 1;
  overflow-y: auto;
  padding: 14px;
}

.inspector-section { display: flex; flex-direction: column; gap: 14px; }

.inspector-block-header {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.inspector-type-chip {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--accent);
  background: var(--accent-soft);
  padding: 2px 6px;
  border-radius: 4px;
  align-self: flex-start;
}

.inspector-block-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--ink-900);
}

.inspector-field-group { display: flex; flex-direction: column; gap: 6px; }

.inspector-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--ink-500);
  text-transform: uppercase;
}

.inspector-xy-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.inspector-xy-field {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--ink-500);
}
.inspector-xy-field input {
  flex: 1;
  padding: 5px 8px !important;
  font-size: 13px;
  border-radius: 6px !important;
}

.inspector-align-row {
  display: flex;
  gap: 4px;
}
.inspector-align-btn {
  flex: 1;
  padding: 6px 4px;
  border: 1px solid var(--outline);
  border-radius: 6px;
  background: white;
  font-size: 10px;
  cursor: pointer;
  color: var(--ink-500);
}
.inspector-align-btn.active {
  border-color: var(--ink-900);
  background: var(--ink-50);
  color: var(--ink-900);
}

.inspector-content-preview {
  font-size: 12px;
  color: var(--ink-700);
  line-height: 1.6;
  margin: 0;
  background: var(--ink-50);
  padding: 8px;
  border-radius: 6px;
}

.inspector-empty {
  font-size: 12px;
  color: var(--ink-300);
  text-align: center;
  padding: 24px 0;
  margin: 0;
}

/* Readiness */
.readiness-list { display: flex; flex-direction: column; gap: 6px; }

.readiness-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  padding: 6px 8px;
  border-radius: 6px;
}

.readiness-ok   { color: var(--success); background: #f0fdf4; }
.readiness-warn { color: var(--warn);    background: #fffbeb; }
.readiness-error { color: var(--danger); background: #fef2f2; }

.readiness-label { flex: 1; font-weight: 500; }
.readiness-detail { font-size: 11px; color: inherit; opacity: 0.7; }

.readiness-merge-btn {
  width: 100%;
  margin-top: 8px;
  text-align: left;
}

.inspector-readiness-footer {
  border-top: 1px solid var(--outline);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
```

**Step 3: Wire into BuilderClient.tsx**

Import:
```tsx
import { InspectorPanel, type ReadinessItem } from "./components/InspectorPanel";
```

Add a computed `readiness` array (near the bottom of the component, before return):
```tsx
const readiness: ReadinessItem[] = [
  {
    label: "Logo set",
    status: selectedLogo ? "ok" : "warn",
    detail: selectedLogo?.label,
  },
  {
    label: "Return address",
    status: selectedReturn ? "ok" : "warn",
    detail: selectedReturn?.label,
  },
  {
    label: "Data file",
    status: columns.length > 0 ? "ok" : "warn",
    detail: columns.length > 0 ? `${spreadsheetName}` : undefined,
  },
  {
    label: "Placeholders mapped",
    status: Object.values(placeholderMap).every(Boolean) ? "ok" : "warn",
    detail: Object.values(placeholderMap).every(Boolean) ? "All mapped" : "Some unmapped",
  },
];
```

Find the selected block to pass to inspector:
```tsx
const selectedBlockData = selectedBlockId
  ? (blocksByPage[activePage] ?? []).find((b) => b.id === selectedBlockId) ?? null
  : null;
const inspectorBlock = selectedBlockData
  ? {
      label: selectedBlockData.label,
      type: selectedBlockData.type,
      x: selectedBlockData.x,
      y: selectedBlockData.y,
      align: selectedBlockData.align,
      content: selectedBlockData.content,
    }
  : null;
```

Replace the existing `.properties` panel div with:
```tsx
<InspectorPanel
  selectedBlock={inspectorBlock}
  onAlignChange={(align) => {
    setBlocksByPage((prev) => ({
      ...prev,
      [activePage]: (prev[activePage] ?? []).map((b) =>
        b.id === selectedBlockId ? { ...b, align } : b
      ),
    }));
  }}
  onXChange={(x) => {
    setBlocksByPage((prev) => ({
      ...prev,
      [activePage]: (prev[activePage] ?? []).map((b) =>
        b.id === selectedBlockId ? { ...b, x } : b
      ),
    }));
  }}
  onYChange={(y) => {
    setBlocksByPage((prev) => ({
      ...prev,
      [activePage]: (prev[activePage] ?? []).map((b) =>
        b.id === selectedBlockId ? { ...b, y } : b
      ),
    }));
  }}
  readiness={readiness}
  onOpenMerge={() => setOpenMenuTab("Data")}
/>
```

**Step 4: Commit**

```bash
git add apps/web/app/components/InspectorPanel.tsx apps/web/app/globals.css apps/web/app/BuilderClient.tsx
git commit -m "feat: right inspector panel with Block/Document/Merge tabs and readiness checklist"
```

---

### Task 5: Empty / first-run state

**Files:**
- Create: `apps/web/app/components/EmptyState.tsx`
- Modify: `apps/web/app/globals.css`
- Modify: `apps/web/app/BuilderClient.tsx`

**Step 1: Create `apps/web/app/components/EmptyState.tsx`**

```tsx
"use client";

import { FileText, Layers, Upload } from "lucide-react";

type EmptyStateProps = {
  onBlank: () => void;
  onTemplate: () => void;
  onImportWord: () => void;
  templateCount: number;
};

export function EmptyState({ onBlank, onTemplate, onImportWord, templateCount }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        <FileText size={40} strokeWidth={1.2} />
      </div>
      <h2 className="empty-state-title">Start a new letter</h2>
      <p className="empty-state-sub">
        Pick a starter below, or build from scratch by dragging blocks from the sidebar.
      </p>
      <div className="empty-state-cards">
        <button className="empty-card" onClick={onBlank}>
          <FileText size={24} strokeWidth={1.4} />
          <span className="empty-card-title">Blank letter</span>
          <span className="empty-card-sub">Start fresh</span>
        </button>
        <button className="empty-card" onClick={onTemplate}>
          <Layers size={24} strokeWidth={1.4} />
          <span className="empty-card-title">From template</span>
          <span className="empty-card-sub">{templateCount} available</span>
        </button>
        <button className="empty-card" onClick={onImportWord}>
          <Upload size={24} strokeWidth={1.4} />
          <span className="empty-card-title">Import Word</span>
          <span className="empty-card-sub">.docx files</span>
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Add empty state styles**

```css
/* ── Empty state ─────────────────────────────────────────────────── */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 60px 40px;
  text-align: center;
  color: var(--ink-500);
}

.empty-state-icon { color: var(--accent); opacity: 0.6; }

.empty-state-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--ink-900);
  margin: 0;
}

.empty-state-sub {
  font-size: 14px;
  color: var(--ink-500);
  max-width: 320px;
  margin: 0;
}

.empty-state-cards {
  display: flex;
  gap: 12px;
  margin-top: 8px;
  flex-wrap: wrap;
  justify-content: center;
}

.empty-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 20px 24px;
  border: 1px solid var(--outline);
  border-radius: 12px;
  background: white;
  cursor: pointer;
  width: 140px;
  transition: border-color 0.15s, box-shadow 0.15s;
  color: var(--ink-700);
}

.empty-card:hover {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

.empty-card-title { font-size: 13px; font-weight: 600; color: var(--ink-900); }
.empty-card-sub { font-size: 11px; color: var(--ink-500); }
```

**Step 3: Wire into BuilderClient.tsx**

Import:
```tsx
import { EmptyState } from "./components/EmptyState";
```

Inside the canvas area (where `bodyZoneRef` div is), wrap with a conditional:
```tsx
{/* Show empty state when canvas is empty and no blocks placed */}
{(blocksByPage[activePage] ?? []).length === 0 && !bodyContentByPage[activePage] ? (
  <EmptyState
    onBlank={() => {/* no-op — canvas is already blank */}}
    onTemplate={() => setOpenMenuTab("Templates")}
    onImportWord={() => setShowCreateModal(true) /* or open docx modal */}
    templateCount={librarySeed["Full Letters"].length}
  />
) : (
  /* existing canvas content */
)}
```

**Step 4: Commit**

```bash
git add apps/web/app/components/EmptyState.tsx apps/web/app/globals.css apps/web/app/BuilderClient.tsx
git commit -m "feat: empty/first-run state with blank, template, import Word options"
```

---

## PHASE 2: Library panels + data flow

### Task 6: Logo library flyout (search, tabs, recently used, grid)

**Files:**
- Create: `apps/web/app/components/LogoLibrary.tsx`
- Modify: `apps/web/app/globals.css`
- Modify: `apps/web/app/BuilderClient.tsx`

**Step 1: Create `apps/web/app/components/LogoLibrary.tsx`**

```tsx
"use client";

import { useState, useMemo } from "react";
import { Star, Search, X } from "lucide-react";

export type LogoItem = {
  id: string;
  label: string;
  imageUrl: string;
  isCustom?: boolean;
};

type LogoLibraryProps = {
  isOpen: boolean;
  onClose: () => void;
  logos: LogoItem[];
  selectedId: string | null;
  onSelect: (logo: LogoItem) => void;
  favorites: string[];
  onToggleFavorite: (id: string) => void;
  recentIds: string[];
  onUpload: () => void;
};

export function LogoLibrary({
  isOpen,
  onClose,
  logos,
  selectedId,
  onSelect,
  favorites,
  onToggleFavorite,
  recentIds,
  onUpload,
}: LogoLibraryProps) {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"all" | "favorites" | "custom">("all");

  const filtered = useMemo(() => {
    let list = logos;
    if (tab === "favorites") list = list.filter((l) => favorites.includes(l.id));
    if (tab === "custom") list = list.filter((l) => l.isCustom);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((l) => l.label.toLowerCase().includes(q));
    }
    return list;
  }, [logos, tab, query, favorites]);

  const recent = useMemo(
    () => recentIds.map((id) => logos.find((l) => l.id === id)).filter(Boolean) as LogoItem[],
    [recentIds, logos]
  );

  if (!isOpen) return null;

  return (
    <div className="flyout-v2">
      {/* Header */}
      <div className="flyout-v2-header">
        <div className="flyout-v2-title-row">
          <span className="flyout-v2-title">Logos <span className="flyout-count">{logos.length}</span></span>
          <button className="flyout-close-btn" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="flyout-search-bar">
          <Search size={14} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search logos by name or brand..."
          />
        </div>
        <div className="flyout-tabs">
          {(["all", "favorites", "custom"] as const).map((t) => (
            <button
              key={t}
              className={`flyout-tab${tab === t ? " active" : ""}`}
              onClick={() => setTab(t)}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
              {t === "all" && <span className="flyout-tab-count">{logos.length}</span>}
              {t === "favorites" && <span className="flyout-tab-count">{favorites.length}</span>}
              {t === "custom" && <span className="flyout-tab-count">{logos.filter(l => l.isCustom).length}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="flyout-v2-body">
        {/* Recently used */}
        {tab === "all" && recent.length > 0 && (
          <div className="flyout-section">
            <span className="flyout-section-label">RECENTLY USED</span>
            <div className="logo-grid-compact">
              {recent.slice(0, 3).map((logo) => (
                <button
                  key={logo.id}
                  className={`logo-card-compact${selectedId === logo.id ? " selected" : ""}`}
                  onClick={() => onSelect(logo)}
                  title={logo.label}
                >
                  <img src={logo.imageUrl} alt={logo.label} />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* All logos grid */}
        <div className="flyout-section">
          {tab === "all" && <span className="flyout-section-label">ALL LOGOS</span>}
          <div className="logo-grid">
            {filtered.map((logo) => (
              <div key={logo.id} className={`logo-card${selectedId === logo.id ? " selected" : ""}`}>
                <button className="logo-card-img" onClick={() => onSelect(logo)}>
                  <img src={logo.imageUrl} alt={logo.label} />
                </button>
                <div className="logo-card-footer">
                  <span className="logo-card-name">{logo.label}</span>
                  <button
                    className={`logo-star-btn${favorites.includes(logo.id) ? " starred" : ""}`}
                    onClick={() => onToggleFavorite(logo.id)}
                  >
                    <Star size={12} fill={favorites.includes(logo.id) ? "currentColor" : "none"} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          {filtered.length === 0 && <p className="flyout-empty">No logos match your search.</p>}
        </div>
      </div>

      {/* Footer */}
      <div className="flyout-v2-footer">
        <button className="btn-outline-sm" onClick={onUpload}>Upload custom logo</button>
      </div>
    </div>
  );
}
```

**Step 2: Add logo library styles to globals.css**

```css
/* ── Flyout v2 ───────────────────────────────────────────────────── */
.flyout-v2 {
  width: 320px;
  flex: 0 0 320px;
  border-right: 1px solid var(--outline);
  background: var(--panel);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.flyout-v2-header {
  padding: 14px 14px 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  border-bottom: 1px solid var(--outline);
  padding-bottom: 10px;
}

.flyout-v2-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.flyout-v2-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--ink-900);
  display: flex;
  align-items: center;
  gap: 6px;
}

.flyout-count {
  font-size: 12px;
  font-weight: 500;
  color: var(--ink-500);
  background: var(--ink-50);
  border-radius: 10px;
  padding: 1px 7px;
}

.flyout-close-btn {
  background: none;
  border: none;
  color: var(--ink-500);
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  display: flex;
  align-items: center;
}
.flyout-close-btn:hover { background: var(--ink-50); color: var(--ink-900); }

.flyout-search-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--outline);
  border-radius: 8px;
  padding: 6px 10px;
  background: var(--ink-50);
  color: var(--ink-500);
}
.flyout-search-bar input {
  border: none !important;
  background: transparent !important;
  font-size: 13px;
  flex: 1;
  color: var(--ink-900);
  padding: 0 !important;
}
.flyout-search-bar input::placeholder { color: var(--ink-300); }

.flyout-tabs {
  display: flex;
  gap: 2px;
}
.flyout-tab {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  border: none;
  background: transparent;
  font-size: 13px;
  font-weight: 500;
  color: var(--ink-500);
  border-radius: 6px;
  cursor: pointer;
}
.flyout-tab.active {
  background: var(--ink-900);
  color: white;
}
.flyout-tab-count {
  font-size: 11px;
  background: rgba(255,255,255,0.2);
  border-radius: 8px;
  padding: 0 5px;
}
.flyout-tab:not(.active) .flyout-tab-count {
  background: var(--ink-150);
  color: var(--ink-700);
}

.flyout-v2-body {
  flex: 1;
  overflow-y: auto;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.flyout-section { display: flex; flex-direction: column; gap: 8px; }

.flyout-section-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--ink-500);
  text-transform: uppercase;
}

.flyout-v2-footer {
  padding: 12px 14px;
  border-top: 1px solid var(--outline);
}

.flyout-empty {
  font-size: 12px;
  color: var(--ink-300);
  text-align: center;
  padding: 16px 0;
  margin: 0;
}

/* Logo grid */
.logo-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.logo-card {
  border: 1px solid var(--outline);
  border-radius: 8px;
  overflow: hidden;
  background: white;
  transition: border-color 0.15s;
}
.logo-card.selected { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent-soft); }
.logo-card:hover { border-color: var(--ink-300); }

.logo-card-img {
  width: 100%;
  border: none;
  background: var(--ink-50);
  padding: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 60px;
}
.logo-card-img img { max-width: 100%; max-height: 44px; object-fit: contain; }

.logo-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 5px 8px;
  border-top: 1px solid var(--outline);
}
.logo-card-name { font-size: 11px; color: var(--ink-700); font-weight: 500; }

.logo-star-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--ink-300);
  padding: 2px;
  display: flex;
}
.logo-star-btn.starred { color: var(--warn); }

/* Compact recently-used row */
.logo-grid-compact { display: flex; gap: 8px; }
.logo-card-compact {
  border: 1px solid var(--outline);
  border-radius: 8px;
  background: var(--ink-50);
  padding: 6px;
  cursor: pointer;
  flex: 0 0 80px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.logo-card-compact.selected { border-color: var(--accent); }
.logo-card-compact img { max-width: 100%; max-height: 36px; object-fit: contain; }
```

**Step 3: Wire into BuilderClient.tsx**

Import:
```tsx
import { LogoLibrary, type LogoItem } from "./components/LogoLibrary";
```

Replace the existing logo flyout (the `<FlyoutPanel>` when `openMenuTab === "Logos"`) with:
```tsx
{openMenuTab === "Logo" && (
  <LogoLibrary
    isOpen={true}
    onClose={() => setOpenMenuTab(null)}
    logos={library["Logos"].map((l) => ({ id: l.id, label: l.label, imageUrl: l.imageUrl!, isCustom: l.isCustom }))}
    selectedId={selectedLogo?.id ?? null}
    onSelect={(logo) => {
      setSelectedLogo({ id: logo.id, label: logo.label, type: "logo", imageUrl: logo.imageUrl });
      setRecentlyUsedLogos((prev) => [logo.id, ...prev.filter((id) => id !== logo.id)].slice(0, 5));
      localStorage.setItem("recentlyUsedLogos", JSON.stringify([logo.id, ...recentlyUsedLogos.filter((id) => id !== logo.id)].slice(0, 5)));
    }}
    favorites={favoriteLogos}
    onToggleFavorite={(id) => {
      const next = favoriteLogos.includes(id) ? favoriteLogos.filter((f) => f !== id) : [...favoriteLogos, id];
      setFavoriteLogos(next);
      localStorage.setItem("favoriteLogos", JSON.stringify(next));
    }}
    recentIds={recentlyUsedLogos}
    onUpload={() => setShowLogoModal(true)}
  />
)}
```

**Step 4: Commit**

```bash
git add apps/web/app/components/LogoLibrary.tsx apps/web/app/globals.css apps/web/app/BuilderClient.tsx
git commit -m "feat: logo library flyout with search, tabs, favorites, recently-used grid"
```

---

### Task 7: Verbiage library (dense list with tag filters)

**Files:**
- Create: `apps/web/app/components/VerbiageLibrary.tsx`
- Modify: `apps/web/app/globals.css`
- Modify: `apps/web/app/BuilderClient.tsx`

**Step 1: Add tags to verbiage seed data in BuilderClient.tsx**

In `verbiageSeed`, add a `tags` field. Update the `LibraryItem` type to include `tags?: string[]`, and annotate each block:

```tsx
// At the top of the file, update LibraryItem type:
type LibraryItem = {
  id: string;
  label: string;
  type: "logo" | "tagline" | "return" | "verbiage" | "full-letter";
  content?: string;
  imageUrl?: string;
  isCustom?: boolean;
  tags?: string[];  // ADD THIS
};
```

Update key verbiage items with tags:
```tsx
// verb-1: add tags: ["#Legal", "#Privacy"]
// verb-2: add tags: ["#Billing"]
// verb-3: add tags: ["#Support", "#Billing"]
// verb-8: add tags: ["#Legal"]
// verb-13: add tags: ["#Security", "#Legal"]
// verb-16: add tags: ["#Legal"]
// verb-19: add tags: ["#Legal"]
// verb-20: add tags: ["#Security"]
// verb-25: add tags: ["#Legal", "#HIPAA"]
```

Apply these tags in verbiageSeed (just add `tags: ["#Legal"]` etc. to each entry).

**Step 2: Create `apps/web/app/components/VerbiageLibrary.tsx`**

```tsx
"use client";

import { useState, useMemo } from "react";
import { Search, Star, GripVertical, X } from "lucide-react";

type VerbiageItem = {
  id: string;
  label: string;
  content: string;
  tags?: string[];
};

type VerbiageLibraryProps = {
  isOpen: boolean;
  onClose: () => void;
  items: VerbiageItem[];
  selectedId: string | null;
  onSelect: (item: VerbiageItem) => void;
  onInsert: (item: VerbiageItem) => void;
  favorites: string[];
  onToggleFavorite: (id: string) => void;
};

const ALL_TAGS = ["#Legal", "#Billing", "#Support", "#Security", "#HIPAA"];

export function VerbiageLibrary({
  isOpen,
  onClose,
  items,
  selectedId,
  onSelect,
  onInsert,
  favorites,
  onToggleFavorite,
}: VerbiageLibraryProps) {
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = items;
    if (activeTag) list = list.filter((i) => i.tags?.includes(activeTag));
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (i) => i.label.toLowerCase().includes(q) || i.content.toLowerCase().includes(q)
      );
    }
    return list;
  }, [items, activeTag, query]);

  // Count items per tag
  const tagCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    ALL_TAGS.forEach((tag) => {
      counts[tag] = items.filter((i) => i.tags?.includes(tag)).length;
    });
    return counts;
  }, [items]);

  if (!isOpen) return null;

  return (
    <div className="flyout-v2">
      <div className="flyout-v2-header">
        <div className="flyout-v2-title-row">
          <span className="flyout-v2-title">Verbiage <span className="flyout-count">{items.length}</span></span>
          <button className="flyout-close-btn" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="flyout-search-bar">
          <Search size={14} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search..."
          />
        </div>
        {/* Tag filter chips */}
        <div className="flyout-tag-chips">
          <button
            className={`tag-chip${!activeTag ? " active" : ""}`}
            onClick={() => setActiveTag(null)}
          >
            All <span className="tag-chip-count">{items.length}</span>
          </button>
          {ALL_TAGS.filter((t) => tagCounts[t] > 0).map((tag) => (
            <button
              key={tag}
              className={`tag-chip${activeTag === tag ? " active" : ""}`}
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
            >
              {tag.replace("#", "")} <span className="tag-chip-count">{tagCounts[tag]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flyout-v2-body">
        <div className="verbiage-list">
          {filtered.map((item) => (
            <div
              key={item.id}
              className={`verbiage-row${selectedId === item.id ? " selected" : ""}`}
              onClick={() => onSelect(item)}
              onDoubleClick={() => onInsert(item)}
            >
              <GripVertical size={14} className="verbiage-drag-handle" />
              <div className="verbiage-row-body">
                <div className="verbiage-row-title">{item.label}</div>
                <div className="verbiage-row-preview">{item.content.slice(0, 80)}…</div>
                <div className="verbiage-row-meta">
                  <span className="verbiage-chars">{item.content.length} chars</span>
                  {item.tags?.map((tag) => (
                    <span key={tag} className="verbiage-tag">{tag}</span>
                  ))}
                </div>
              </div>
              <button
                className={`logo-star-btn${favorites.includes(item.id) ? " starred" : ""}`}
                onClick={(e) => { e.stopPropagation(); onToggleFavorite(item.id); }}
              >
                <Star size={12} fill={favorites.includes(item.id) ? "currentColor" : "none"} />
              </button>
            </div>
          ))}
          {filtered.length === 0 && <p className="flyout-empty">No verbiage blocks match.</p>}
        </div>
      </div>
    </div>
  );
}
```

**Step 3: Add verbiage list styles to globals.css**

```css
/* ── Verbiage library ─────────────────────────────────────────────── */
.flyout-tag-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.tag-chip {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: 20px;
  border: 1px solid var(--outline);
  background: transparent;
  font-size: 12px;
  font-weight: 500;
  color: var(--ink-700);
  cursor: pointer;
}
.tag-chip.active {
  background: var(--ink-900);
  color: white;
  border-color: var(--ink-900);
}
.tag-chip-count {
  font-size: 10px;
  opacity: 0.7;
}

.verbiage-list { display: flex; flex-direction: column; gap: 0; }

.verbiage-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 8px;
  border-radius: 8px;
  cursor: pointer;
  border-left: 3px solid transparent;
  transition: background 0.12s, border-color 0.12s;
}
.verbiage-row:hover { background: var(--ink-50); }
.verbiage-row.selected {
  background: var(--accent-soft);
  border-left-color: var(--accent);
}

.verbiage-drag-handle {
  color: var(--ink-300);
  flex: 0 0 14px;
  margin-top: 2px;
  cursor: grab;
}

.verbiage-row-body { flex: 1; min-width: 0; }
.verbiage-row-title { font-size: 13px; font-weight: 600; color: var(--ink-900); }
.verbiage-row-preview {
  font-size: 11px;
  color: var(--ink-500);
  line-height: 1.4;
  margin-top: 2px;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.verbiage-row-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
  flex-wrap: wrap;
}
.verbiage-chars { font-size: 10px; color: var(--ink-300); }
.verbiage-tag {
  font-size: 10px;
  color: var(--ink-700);
  background: var(--ink-50);
  border: 1px solid var(--outline);
  border-radius: 10px;
  padding: 0 6px;
}
```

**Step 4: Wire into BuilderClient.tsx**

Replace the existing verbiage flyout block with:
```tsx
{openMenuTab === "Verbiage" && (
  <VerbiageLibrary
    isOpen={true}
    onClose={() => setOpenMenuTab(null)}
    items={library["Verbiage"].map((v) => ({ id: v.id, label: v.label, content: v.content ?? "", tags: v.tags }))}
    selectedId={selectedVerbiageId}
    onSelect={(item) => setSelectedVerbiageId(item.id)}
    onInsert={(item) => {
      editorRef.current?.insertLibraryItem({ ...item, type: "verbiage" });
    }}
    favorites={favoriteVerbiage}
    onToggleFavorite={(id) => {
      const next = favoriteVerbiage.includes(id)
        ? favoriteVerbiage.filter((f) => f !== id)
        : [...favoriteVerbiage, id];
      setFavoriteVerbiage(next);
      localStorage.setItem("favoriteVerbiage", JSON.stringify(next));
    }}
  />
)}
```

Import at top:
```tsx
import { VerbiageLibrary } from "./components/VerbiageLibrary";
```

**Step 5: Commit**

```bash
git add apps/web/app/components/VerbiageLibrary.tsx apps/web/app/globals.css apps/web/app/BuilderClient.tsx
git commit -m "feat: verbiage library with dense list, tag filters, favorites, and drag handles"
```

---

### Task 8: Letter templates library (card grid with categories)

**Files:**
- Create: `apps/web/app/components/TemplateLibrary.tsx`
- Modify: `apps/web/app/globals.css`
- Modify: `apps/web/app/BuilderClient.tsx`

**Step 1: Create `apps/web/app/components/TemplateLibrary.tsx`**

```tsx
"use client";

import { useState, useMemo } from "react";
import { Search, Star, X } from "lucide-react";

type TemplateItem = {
  id: string;
  label: string;
  content: string;
  category?: string;
};

type TemplateLibraryProps = {
  isOpen: boolean;
  onClose: () => void;
  templates: TemplateItem[];
  favorites: string[];
  onToggleFavorite: (id: string) => void;
  onInsert: (item: TemplateItem) => void;
};

const CATEGORIES = ["Collections", "Onboarding", "Notifications"];

export function TemplateLibrary({
  isOpen, onClose, templates, favorites, onToggleFavorite, onInsert,
}: TemplateLibraryProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = templates;
    if (category) list = list.filter((t) => t.category === category);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((t) => t.label.toLowerCase().includes(q) || t.content.toLowerCase().includes(q));
    }
    return list;
  }, [templates, category, query]);

  if (!isOpen) return null;

  return (
    <div className="flyout-v2">
      <div className="flyout-v2-header">
        <div className="flyout-v2-title-row">
          <span className="flyout-v2-title">Letter templates <span className="flyout-count">{templates.length}</span></span>
          <button className="flyout-close-btn" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="flyout-search-bar">
          <Search size={14} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search templates..." />
        </div>
        <div className="flyout-tabs">
          <button className={`flyout-tab${!category ? " active" : ""}`} onClick={() => setCategory(null)}>
            All <span className="flyout-tab-count">{templates.length}</span>
          </button>
          {CATEGORIES.map((cat) => (
            <button key={cat} className={`flyout-tab${category === cat ? " active" : ""}`} onClick={() => setCategory(category === cat ? null : cat)}>
              {cat}
            </button>
          ))}
        </div>
      </div>
      <div className="flyout-v2-body">
        <div className="template-list">
          {filtered.map((t) => (
            <div key={t.id} className="template-card" onClick={() => onInsert(t)}>
              <div className="template-card-preview">
                {t.content.slice(0, 160)}...
              </div>
              <div className="template-card-footer">
                <div>
                  <div className="template-card-title">{t.label}</div>
                  {t.category && <div className="template-card-category">{t.category.toUpperCase()}</div>}
                </div>
                <button
                  className={`logo-star-btn${favorites.includes(t.id) ? " starred" : ""}`}
                  onClick={(e) => { e.stopPropagation(); onToggleFavorite(t.id); }}
                >
                  <Star size={12} fill={favorites.includes(t.id) ? "currentColor" : "none"} />
                </button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <p className="flyout-empty">No templates match.</p>}
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Add category data to fullLetterSeed in BuilderClient.tsx**

Add `category` to the `LibraryItem` type:
```tsx
category?: string;
```

Update fullLetterSeed entries with categories:
- `full-1`, `full-10`: `category: "Collections"`
- `full-2`, `full-9`, `full-13`: `category: "Onboarding"`
- `full-3`, `full-11`, `full-16`: `category: "Notifications"`

**Step 3: Add template styles to globals.css**

```css
/* ── Template library ─────────────────────────────────────────────── */
.template-list { display: flex; flex-direction: column; gap: 8px; }

.template-card {
  border: 1px solid var(--outline);
  border-radius: 10px;
  background: white;
  cursor: pointer;
  overflow: hidden;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.template-card:hover {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-soft);
}

.template-card-preview {
  padding: 12px;
  font-size: 12px;
  color: var(--ink-700);
  line-height: 1.6;
  font-family: "Source Serif 4", Georgia, serif;
  border-bottom: 1px solid var(--outline);
  max-height: 120px;
  overflow: hidden;
}

.template-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
}

.template-card-title { font-size: 13px; font-weight: 600; color: var(--ink-900); }
.template-card-category { font-size: 10px; font-weight: 700; letter-spacing: 0.06em; color: var(--ink-500); text-transform: uppercase; margin-top: 2px; }
```

**Step 4: Wire into BuilderClient.tsx**

```tsx
import { TemplateLibrary } from "./components/TemplateLibrary";
```

Replace the existing "Full Letters" flyout:
```tsx
{openMenuTab === "Templates" && (
  <TemplateLibrary
    isOpen={true}
    onClose={() => setOpenMenuTab(null)}
    templates={library["Full Letters"].map((t) => ({ id: t.id, label: t.label, content: t.content ?? "", category: t.category }))}
    favorites={favoriteTemplates}
    onToggleFavorite={(id) => {
      const next = favoriteTemplates.includes(id) ? favoriteTemplates.filter((f) => f !== id) : [...favoriteTemplates, id];
      setFavoriteTemplates(next);
      localStorage.setItem("favoriteTemplates", JSON.stringify(next));
    }}
    onInsert={(t) => {
      editorRef.current?.insertLibraryItem({ id: t.id, label: t.label, type: "full-letter", content: t.content });
      setOpenMenuTab(null);
    }}
  />
)}
```

**Step 5: Commit**

```bash
git add apps/web/app/components/TemplateLibrary.tsx apps/web/app/globals.css apps/web/app/BuilderClient.tsx
git commit -m "feat: letter templates library with card previews and category filters"
```

---

### Task 9: Data & placeholder mapping panel

**Files:**
- Create: `apps/web/app/components/DataPanel.tsx`
- Modify: `apps/web/app/globals.css`
- Modify: `apps/web/app/BuilderClient.tsx`

**Step 1: Create `apps/web/app/components/DataPanel.tsx`**

This replaces the existing inline Data tab content. It shows:
- File info chip (filename, row count, col count, size)
- Placeholder mapping table with auto-match indicators
- Data preview table (first 6 rows)
- Readiness checklist
- TLE address mapping

```tsx
"use client";

import { useState } from "react";
import { CheckCircle2, AlertTriangle, Upload } from "lucide-react";

type Row = Record<string, string>;

type DataPanelProps = {
  isOpen: boolean;
  onClose: () => void;
  // File info
  spreadsheetName: string | null;
  rowCount: number;
  columns: string[];
  previewRows: Row[];
  // Placeholder mapping
  placeholders: string[];       // all [Placeholder] tokens found in the letter
  placeholderMap: Record<string, string>; // placeholder -> column name
  onMapChange: (placeholder: string, column: string) => void;
  // TLE
  mailingMap: Record<string, string>;
  onMailingChange: (field: string, value: string) => void;
  // Actions
  onUploadFile: () => void;
};

export function DataPanel({
  isOpen, onClose, spreadsheetName, rowCount, columns, previewRows,
  placeholders, placeholderMap, onMapChange,
  mailingMap, onMailingChange, onUploadFile,
}: DataPanelProps) {
  const [previewMode, setPreviewMode] = useState<"table" | "single">("table");

  if (!isOpen) return null;

  const unmappedCount = placeholders.filter((p) => !placeholderMap[p]).length;
  const allMapped = unmappedCount === 0 && placeholders.length > 0;

  // Auto-detect matching columns for a placeholder
  const autoMatch = (placeholder: string): string | null => {
    const p = placeholder.toLowerCase().replace(/[\[\] ]/g, "");
    return columns.find((c) => c.toLowerCase().replace(/_/g, "").includes(p)) ?? null;
  };

  return (
    <div className="flyout-v2 data-panel">
      {/* File chip */}
      {!spreadsheetName ? (
        <div className="data-upload-zone" onClick={onUploadFile}>
          <Upload size={24} />
          <span>Upload a CSV or Excel file</span>
          <span className="data-upload-hint">Drag & drop or click to browse</span>
        </div>
      ) : (
        <div className="data-file-chip" onClick={onUploadFile} title="Click to replace file">
          <span className="data-file-icon">CSV</span>
          <div>
            <div className="data-file-name">{spreadsheetName}</div>
            <div className="data-file-meta">{rowCount.toLocaleString()} rows · {columns.length} cols</div>
          </div>
        </div>
      )}

      {columns.length > 0 && (
        <>
          {/* Placeholder mapping */}
          <div className="data-section">
            <div className="data-section-header">
              <span className="inspector-label">PLACEHOLDER MAPPING</span>
              {unmappedCount > 0 && (
                <span className="data-auto-hint">
                  Auto-matched {placeholders.length - unmappedCount} of {placeholders.length}
                </span>
              )}
            </div>
            <div className="data-mapping-list">
              {placeholders.length === 0 && (
                <p className="flyout-empty">No [Placeholder] tokens found in the letter.</p>
              )}
              {placeholders.map((p) => (
                <div key={p} className={`data-mapping-row${!placeholderMap[p] ? " unmapped" : ""}`}>
                  <span className="mono data-placeholder-label">{p}</span>
                  <select
                    value={placeholderMap[p] ?? ""}
                    onChange={(e) => onMapChange(p, e.target.value)}
                  >
                    <option value="">— Choose column</option>
                    {columns.map((col) => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Data preview */}
          <div className="data-section">
            <div className="data-section-header">
              <span className="inspector-label">DATA PREVIEW</span>
              <div className="data-preview-toggle">
                <button className={previewMode === "table" ? "active" : ""} onClick={() => setPreviewMode("table")}>Table</button>
                <button className={previewMode === "single" ? "active" : ""} onClick={() => setPreviewMode("single")}>Single row</button>
              </div>
            </div>
            {previewMode === "table" && (
              <div className="data-preview-table-wrap">
                <table className="data-preview-table">
                  <thead>
                    <tr>
                      {columns.slice(0, 6).map((col) => (
                        <th key={col} className={Object.values(placeholderMap).includes(col) ? "col-highlighted" : ""}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.slice(0, 6).map((row, i) => (
                      <tr key={i}>
                        {columns.slice(0, 6).map((col) => (
                          <td key={col}>{row[col] ?? ""}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {previewMode === "single" && previewRows[0] && (
              <div className="data-single-row">
                {columns.map((col) => (
                  <div key={col} className="data-single-field">
                    <span className="data-single-label">{col}</span>
                    <span className="data-single-value">{previewRows[0][col] ?? "—"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Readiness */}
          <div className="data-section">
            <span className="inspector-label">READY TO GENERATE</span>
            <div className={`data-readiness-row ${allMapped ? "ok" : "warn"}`}>
              {allMapped ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
              <span>{allMapped ? "All placeholders mapped" : `${unmappedCount} placeholder(s) unmapped`}</span>
            </div>
          </div>

          {/* TLE Mailing address */}
          <div className="data-section">
            <span className="inspector-label">MAILING ADDRESS (TLE)</span>
            {(["mailing_name", "mailing_addr1", "mailing_addr2", "mailing_addr3"] as const).map((field) => (
              <div key={field} className="data-mapping-row">
                <span className="mono data-placeholder-label">{field}</span>
                <select
                  value={mailingMap[field] ?? ""}
                  onChange={(e) => onMailingChange(field, e.target.value)}
                >
                  <option value="">— Choose column</option>
                  {columns.map((col) => <option key={col} value={col}>{col}</option>)}
                </select>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
```

**Step 2: Add data panel styles to globals.css**

```css
/* ── Data panel ──────────────────────────────────────────────────── */
.data-panel { width: 360px; flex: 0 0 360px; padding: 14px; gap: 16px; overflow-y: auto; display: flex; flex-direction: column; }

.data-upload-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 32px 20px;
  border: 2px dashed var(--outline);
  border-radius: 10px;
  background: var(--ink-50);
  cursor: pointer;
  color: var(--ink-500);
  font-size: 14px;
  font-weight: 500;
  text-align: center;
  transition: border-color 0.15s;
}
.data-upload-zone:hover { border-color: var(--accent); color: var(--accent); }
.data-upload-hint { font-size: 11px; color: var(--ink-300); font-weight: 400; }

.data-file-chip {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border: 1px solid var(--outline);
  border-radius: 10px;
  background: white;
  cursor: pointer;
}
.data-file-chip:hover { border-color: var(--ink-300); }
.data-file-icon {
  font-size: 10px;
  font-weight: 700;
  background: var(--info);
  color: white;
  border-radius: 4px;
  padding: 3px 6px;
  font-family: "JetBrains Mono", monospace;
}
.data-file-name { font-size: 13px; font-weight: 600; color: var(--ink-900); }
.data-file-meta { font-size: 11px; color: var(--ink-500); }

.data-section { display: flex; flex-direction: column; gap: 8px; }

.data-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.data-auto-hint {
  font-size: 11px;
  color: var(--info);
  font-weight: 500;
}

.data-mapping-list { display: flex; flex-direction: column; gap: 6px; }

.data-mapping-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  align-items: center;
  padding: 4px 0;
}
.data-mapping-row.unmapped .data-placeholder-label { color: var(--warn); }

.data-placeholder-label {
  font-size: 12px;
  color: var(--ink-700);
  background: var(--accent-soft);
  border: 1px solid rgba(179, 80, 47, 0.2);
  border-radius: 4px;
  padding: 3px 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.data-preview-toggle {
  display: flex;
  border: 1px solid var(--outline);
  border-radius: 6px;
  overflow: hidden;
}
.data-preview-toggle button {
  border: none;
  background: transparent;
  font-size: 11px;
  padding: 3px 8px;
  color: var(--ink-500);
  cursor: pointer;
  border-radius: 0;
}
.data-preview-toggle button.active { background: var(--ink-900); color: white; }

.data-preview-table-wrap { overflow-x: auto; border: 1px solid var(--outline); border-radius: 8px; }
.data-preview-table { width: 100%; border-collapse: collapse; font-size: 11px; }
.data-preview-table th {
  padding: 5px 8px;
  text-align: left;
  font-weight: 600;
  font-size: 10px;
  letter-spacing: 0.04em;
  background: var(--ink-50);
  color: var(--ink-700);
  border-bottom: 1px solid var(--outline);
  white-space: nowrap;
}
.data-preview-table th.col-highlighted { color: var(--accent); }
.data-preview-table td {
  padding: 5px 8px;
  color: var(--ink-700);
  border-bottom: 1px solid var(--outline);
  white-space: nowrap;
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.data-readiness-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
}
.data-readiness-row.ok { color: var(--success); background: #f0fdf4; }
.data-readiness-row.warn { color: var(--warn); background: #fffbeb; }

.data-single-row { display: flex; flex-direction: column; gap: 4px; }
.data-single-field { display: flex; justify-content: space-between; font-size: 12px; padding: 4px 0; border-bottom: 1px solid var(--outline); }
.data-single-label { color: var(--ink-500); font-weight: 500; }
.data-single-value { color: var(--ink-900); max-width: 180px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; }
```

**Step 3: Extract placeholder tokens from letter content**

In BuilderClient.tsx, add a computed `placeholders` list:
```tsx
const placeholders = useMemo(() => {
  const content = Object.values(bodyContentByPage).join(" ");
  const matches = content.match(/\[([^\]]+)\]/g) ?? [];
  return [...new Set(matches)];
}, [bodyContentByPage]);
```

**Step 4: Wire DataPanel into BuilderClient.tsx**

Import:
```tsx
import { DataPanel } from "./components/DataPanel";
```

Replace the existing "Data" flyout content with:
```tsx
{openMenuTab === "Data" && (
  <DataPanel
    isOpen={true}
    onClose={() => setOpenMenuTab(null)}
    spreadsheetName={spreadsheetName}
    rowCount={/* parse from spreadsheetContent */ 0}
    columns={columns}
    previewRows={/* first 6 rows parsed from spreadsheet */ []}
    placeholders={placeholders}
    placeholderMap={placeholderMap}
    onMapChange={(p, col) => setPlaceholderMap((prev) => ({ ...prev, [p]: col }))}
    mailingMap={mailingMap}
    onMailingChange={(field, val) => setMailingMap((prev) => ({ ...prev, [field]: val }))}
    onUploadFile={() => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".csv,.xlsx,.xls";
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) { /* existing spreadsheet upload logic */ }
      };
      input.click();
    }}
  />
)}
```

**Step 5: Commit**

```bash
git add apps/web/app/components/DataPanel.tsx apps/web/app/globals.css apps/web/app/BuilderClient.tsx
git commit -m "feat: data & placeholder mapping panel with CSV preview and readiness indicator"
```

---

### Task 10: Preview & generate (row-by-row merge preview)

**Files:**
- Create: `apps/web/app/components/MergePreview.tsx`
- Modify: `apps/web/app/globals.css`
- Modify: `apps/web/app/BuilderClient.tsx`

**Step 1: Create `apps/web/app/components/MergePreview.tsx`**

```tsx
"use client";

import { useState, useMemo } from "react";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";

type Row = Record<string, string>;

type MergePreviewProps = {
  isOpen: boolean;
  onClose: () => void;
  rows: Row[];
  letterHtml: string;            // HTML with [Placeholder] tokens
  placeholderMap: Record<string, string>;  // [Placeholder] -> column name
  outputFormat: "pdf" | "afp";
  onFormatChange: (f: "pdf" | "afp") => void;
  onGenerate: () => void;
  generating: boolean;
};

function mergeRow(html: string, row: Row, map: Record<string, string>): string {
  let result = html;
  for (const [placeholder, column] of Object.entries(map)) {
    const value = row[column] ?? placeholder;
    // Escape the placeholder for regex use
    const escaped = placeholder.replace(/[[\]]/g, "\\$&");
    result = result.replace(new RegExp(escaped, "g"), `<strong>${value}</strong>`);
  }
  return result;
}

export function MergePreview({
  isOpen, onClose, rows, letterHtml, placeholderMap,
  outputFormat, onFormatChange, onGenerate, generating,
}: MergePreviewProps) {
  const [query, setQuery] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);

  const filteredRows = useMemo(() => {
    if (!query.trim()) return rows;
    const q = query.toLowerCase();
    return rows.filter((r) =>
      Object.values(r).some((v) => v.toLowerCase().includes(q))
    );
  }, [rows, query]);

  const activeRow = filteredRows[currentIndex] ?? null;

  const mergedHtml = useMemo(() => {
    if (!activeRow) return letterHtml;
    return mergeRow(letterHtml, activeRow, placeholderMap);
  }, [activeRow, letterHtml, placeholderMap]);

  if (!isOpen) return null;

  return (
    <div className="merge-preview-overlay">
      <div className="merge-preview-shell">
        {/* Top bar */}
        <div className="merge-preview-topbar">
          <div>
            <div className="merge-preview-title">Merge preview</div>
            <div className="merge-preview-sub">Reviewing row {currentIndex + 1} of {filteredRows.length.toLocaleString()}</div>
          </div>
          <div className="merge-preview-nav">
            <button className="btn-ghost-sm" onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))} disabled={currentIndex === 0}>
              <ChevronLeft size={16} />
            </button>
            <span className="merge-nav-label">{currentIndex + 1} / {filteredRows.length}</span>
            <button className="btn-ghost-sm" onClick={() => setCurrentIndex((i) => Math.min(filteredRows.length - 1, i + 1))} disabled={currentIndex >= filteredRows.length - 1}>
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="merge-format-toggle">
            {(["pdf", "afp"] as const).map((f) => (
              <button key={f} className={outputFormat === f ? "active" : ""} onClick={() => onFormatChange(f)}>
                {f.toUpperCase()}
              </button>
            ))}
          </div>
          <button className="btn-accent" onClick={onGenerate} disabled={generating || rows.length === 0}>
            {generating ? "Generating…" : `Generate ${rows.length.toLocaleString()} letters`}
          </button>
          <button className="btn-ghost-sm" onClick={onClose}>Close</button>
        </div>

        <div className="merge-preview-body">
          {/* Recipient list */}
          <div className="merge-recipient-list">
            <div className="merge-recipient-search">
              <Search size={13} />
              <input value={query} onChange={(e) => { setQuery(e.target.value); setCurrentIndex(0); }} placeholder="Find recipient..." />
            </div>
            <div className="merge-recipient-rows">
              {filteredRows.slice(0, 50).map((row, i) => {
                const name = row[placeholderMap["[Customer Name]"] ?? ""] ?? row[Object.keys(row)[0]] ?? `Row ${i + 1}`;
                const addr = row[placeholderMap["[Address]"] ?? ""] ?? "";
                return (
                  <div
                    key={i}
                    className={`merge-recipient-row${currentIndex === i ? " active" : ""}`}
                    onClick={() => setCurrentIndex(i)}
                  >
                    <span className="merge-row-num">{String(i + 1).padStart(4, "0")}</span>
                    <div>
                      <div className="merge-row-name">{name}</div>
                      {addr && <div className="merge-row-addr">{addr}</div>}
                    </div>
                  </div>
                );
              })}
              {filteredRows.length > 50 && (
                <div className="merge-row-more">+{(filteredRows.length - 50).toLocaleString()} more rows</div>
              )}
            </div>
          </div>

          {/* Letter preview */}
          <div className="merge-letter-area">
            <div className="merge-letter-page">
              {activeRow ? (
                <div
                  className="letter-body"
                  dangerouslySetInnerHTML={{ __html: mergedHtml }}
                />
              ) : (
                <div className="merge-no-rows">No rows match your search.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Add merge preview styles to globals.css**

```css
/* ── Merge preview ───────────────────────────────────────────────── */
.merge-preview-overlay {
  position: fixed;
  inset: 0;
  background: var(--bg);
  z-index: 100;
  display: flex;
  flex-direction: column;
}

.merge-preview-shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.merge-preview-topbar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 24px;
  border-bottom: 1px solid var(--outline);
  background: var(--panel);
}

.merge-preview-title { font-size: 16px; font-weight: 700; color: var(--ink-900); }
.merge-preview-sub { font-size: 12px; color: var(--ink-500); }

.merge-preview-nav {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}
.merge-nav-label { font-size: 13px; color: var(--ink-700); min-width: 60px; text-align: center; }

.merge-format-toggle {
  display: flex;
  border: 1px solid var(--outline);
  border-radius: 8px;
  overflow: hidden;
}
.merge-format-toggle button {
  border: none;
  background: transparent;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  color: var(--ink-500);
  border-radius: 0;
}
.merge-format-toggle button.active { background: var(--ink-900); color: white; }

.merge-preview-body {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.merge-recipient-list {
  width: 240px;
  flex: 0 0 240px;
  border-right: 1px solid var(--outline);
  display: flex;
  flex-direction: column;
  background: var(--panel);
}

.merge-recipient-search {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--outline);
  color: var(--ink-500);
}
.merge-recipient-search input {
  border: none !important;
  background: transparent !important;
  font-size: 13px;
  flex: 1;
  padding: 0 !important;
}

.merge-recipient-rows { flex: 1; overflow-y: auto; }

.merge-recipient-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  border-left: 3px solid transparent;
}
.merge-recipient-row:hover { background: var(--ink-50); }
.merge-recipient-row.active {
  background: var(--accent-soft);
  border-left-color: var(--accent);
}

.merge-row-num { font-size: 10px; color: var(--ink-300); font-family: "JetBrains Mono", monospace; flex: 0 0 28px; margin-top: 2px; }
.merge-row-name { font-size: 13px; font-weight: 500; color: var(--ink-900); }
.merge-row-addr { font-size: 11px; color: var(--ink-500); }
.merge-row-more { padding: 8px 12px; font-size: 11px; color: var(--ink-300); }

.merge-letter-area {
  flex: 1;
  overflow-y: auto;
  display: flex;
  justify-content: center;
  padding: 40px 24px;
  background: var(--bg);
}

.merge-letter-page {
  width: 680px;
  min-height: 880px;
  background: white;
  border-radius: 4px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.10);
  padding: 60px 64px;
}

.merge-no-rows {
  text-align: center;
  color: var(--ink-300);
  font-size: 14px;
  padding: 40px;
}
```

**Step 3: Wire into BuilderClient.tsx**

Import:
```tsx
import { MergePreview } from "./components/MergePreview";
```

Add state for preview rows:
```tsx
const [previewRows, setPreviewRows] = useState<Record<string, string>[]>([]);
```

When the spreadsheet loads (in the existing xlsx parsing logic), also set `previewRows`:
```tsx
// after parsing the xlsx sheet into data:
setPreviewRows(data.slice(0, 100) as Record<string, string>[]);
```

Add the MergePreview overlay at the end of the JSX (before closing `</div>`):
```tsx
{showPreview && (
  <MergePreview
    isOpen={showPreview}
    onClose={() => setShowPreview(false)}
    rows={previewRows}
    letterHtml={bodyContentByPage[activePage] ?? ""}
    placeholderMap={placeholderMap}
    outputFormat={outputFormat}
    onFormatChange={setOutputFormat}
    onGenerate={() => { setShowPreview(false); /* trigger existing generate */ }}
    generating={generating}
  />
)}
```

**Step 4: Commit**

```bash
git add apps/web/app/components/MergePreview.tsx apps/web/app/globals.css apps/web/app/BuilderClient.tsx
git commit -m "feat: merge preview with recipient list, row-by-row letter preview, PDF/AFP toggle"
```

---

## PHASE 3: Advanced features

### Task 11: Upload logo modal (redesigned)

**Files:**
- Create: `apps/web/app/components/UploadLogoModal.tsx`
- Modify: `apps/web/app/globals.css`
- Modify: `apps/web/app/BuilderClient.tsx`

**Step 1: Create `apps/web/app/components/UploadLogoModal.tsx`**

```tsx
"use client";

import { Upload, X } from "lucide-react";

type UploadLogoModalProps = {
  isOpen: boolean;
  onClose: () => void;
  previewUrl: string;
  fileName: string;
  displayName: string;
  onDisplayNameChange: (name: string) => void;
  errorMessage: string;
  isUploading: boolean;
  onFileSelect: (file: File) => void;
  onConfirm: () => void;
};

export function UploadLogoModal({
  isOpen, onClose, previewUrl, fileName, displayName, onDisplayNameChange,
  errorMessage, isUploading, onFileSelect, onConfirm,
}: UploadLogoModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-card-header">
          <div>
            <div className="modal-card-title">Upload logo</div>
            <div className="modal-card-sub">Supported formats: PNG, JPG, SVG · Max 5 MB</div>
          </div>
          <button className="flyout-close-btn" onClick={onClose}><X size={16} /></button>
        </div>

        {/* Drop zone */}
        <div
          className={`logo-upload-zone${previewUrl ? " has-preview" : ""}`}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) onFileSelect(f); }}
        >
          {previewUrl ? (
            <img src={previewUrl} alt="Preview" className="logo-upload-preview-img" />
          ) : (
            <>
              <Upload size={24} />
              <span className="logo-upload-label">Drop your logo here</span>
              <label className="logo-upload-browse">
                or <span>browse files</span>
                <input type="file" accept=".png,.jpg,.jpeg,.svg" className="hidden-input"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) onFileSelect(f); }} />
              </label>
              <span className="logo-upload-hint">Transparent backgrounds recommended</span>
            </>
          )}
        </div>

        {/* File info + display name */}
        {previewUrl && (
          <div className="logo-upload-info-card">
            <img src={previewUrl} alt="" className="logo-upload-thumb" />
            <div className="logo-upload-details">
              <div className="logo-upload-filename">{fileName} <span className="logo-upload-badge">UPLOADED</span></div>
              <label className="inspector-label" style={{ marginTop: 6 }}>Display name</label>
              <input
                value={displayName}
                onChange={(e) => onDisplayNameChange(e.target.value)}
                placeholder="e.g. APS Primary"
              />
            </div>
          </div>
        )}

        {errorMessage && <div className="modal-error">{errorMessage}</div>}

        <div className="modal-card-footer">
          <a href="#" className="logo-guidelines-link">Need help? Logo guidelines</a>
          <div className="modal-card-actions">
            <button className="btn-outline-sm" onClick={onClose}>Cancel</button>
            <button
              className="btn-accent"
              disabled={!previewUrl || isUploading}
              onClick={onConfirm}
            >
              {isUploading ? "Uploading…" : "Add to library"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Add modal styles to globals.css**

```css
/* ── Modal v2 ─────────────────────────────────────────────────────── */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(11, 18, 32, 0.45);
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-card {
  background: white;
  border-radius: 14px;
  width: 560px;
  max-width: 95vw;
  box-shadow: 0 20px 60px rgba(0,0,0,0.2);
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 24px;
}

.modal-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}
.modal-card-title { font-size: 16px; font-weight: 700; color: var(--ink-900); }
.modal-card-sub { font-size: 12px; color: var(--ink-500); margin-top: 2px; }

.logo-upload-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 2px dashed var(--accent);
  border-radius: 10px;
  background: var(--accent-soft);
  padding: 32px;
  color: var(--accent-ink);
  text-align: center;
  cursor: pointer;
  min-height: 160px;
}
.logo-upload-zone.has-preview {
  padding: 16px;
  border-style: solid;
}

.logo-upload-preview-img { max-height: 80px; max-width: 100%; object-fit: contain; }
.logo-upload-label { font-size: 14px; font-weight: 600; }

.logo-upload-browse {
  font-size: 13px;
  cursor: pointer;
}
.logo-upload-browse span { color: var(--accent); text-decoration: underline; }
.logo-upload-browse input { display: none; }
.logo-upload-hint { font-size: 11px; color: var(--accent-ink); opacity: 0.6; }

.logo-upload-info-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--outline);
  border-radius: 10px;
}
.logo-upload-thumb { width: 56px; height: 40px; object-fit: contain; border-radius: 4px; border: 1px solid var(--outline); }
.logo-upload-details { flex: 1; display: flex; flex-direction: column; gap: 4px; }
.logo-upload-filename { font-size: 12px; font-weight: 600; color: var(--ink-900); display: flex; align-items: center; gap: 6px; }
.logo-upload-badge { font-size: 10px; background: var(--success); color: white; border-radius: 4px; padding: 1px 6px; }

.modal-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.logo-guidelines-link { font-size: 12px; color: var(--info); text-decoration: underline; }
.modal-card-actions { display: flex; gap: 8px; }

.modal-error {
  padding: 8px 12px;
  background: #fef2f2;
  border: 1px solid var(--danger);
  border-radius: 8px;
  font-size: 12px;
  color: var(--danger);
}

.hidden-input { display: none; }
```

**Step 3: Wire UploadLogoModal into BuilderClient.tsx**

Add `displayName` state:
```tsx
const [logoDisplayName, setLogoDisplayName] = useState("");
```

Import and replace existing `<UploadLogoModal>`:
```tsx
import { UploadLogoModal } from "./components/UploadLogoModal";
```

```tsx
<UploadLogoModal
  isOpen={showLogoModal}
  onClose={() => { setShowLogoModal(false); setLogoUploadPreview(""); setLogoUploadName(""); setLogoDisplayName(""); }}
  previewUrl={logoUploadPreview}
  fileName={logoUploadName}
  displayName={logoDisplayName}
  onDisplayNameChange={setLogoDisplayName}
  errorMessage={logoUploadError}
  isUploading={logoUploadLoading}
  onFileSelect={(file) => {
    setLogoUploadName(file.name);
    setLogoDisplayName(file.name.replace(/\.[^.]+$/, ""));
    const reader = new FileReader();
    reader.onload = (e) => setLogoUploadPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }}
  onConfirm={() => {
    /* existing upload logic, use logoDisplayName as label */
    const newLogo: LibraryItem = {
      id: `custom-${Date.now()}`,
      label: logoDisplayName || logoUploadName,
      type: "logo",
      imageUrl: logoUploadPreview,
      isCustom: true,
    };
    setLibrary((prev) => ({ ...prev, Logos: [newLogo, ...prev["Logos"]] }));
    setSelectedLogo(newLogo);
    setShowLogoModal(false);
    setLogoUploadPreview("");
    setLogoUploadName("");
    setLogoDisplayName("");
  }}
/>
```

**Step 4: Commit**

```bash
git add apps/web/app/components/UploadLogoModal.tsx apps/web/app/globals.css apps/web/app/BuilderClient.tsx
git commit -m "feat: redesigned upload logo modal with display name, drop zone, UPLOADED badge"
```

---

### Task 12: Return address modal (redesigned with USPS hint)

**Files:**
- Create: `apps/web/app/components/ReturnAddressModal.tsx`
- Modify: `apps/web/app/globals.css`
- Modify: `apps/web/app/BuilderClient.tsx`

**Step 1: Create `apps/web/app/components/ReturnAddressModal.tsx`**

```tsx
"use client";

import { useState } from "react";
import { X } from "lucide-react";

type ReturnAddressModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (label: string, address: string, category: string) => void;
};

const CATEGORIES = ["Corporate HQ", "Regional office", "P.O. Box", "Other"];

function detectUsps(address: string): { ok: boolean; message: string } {
  const lines = address.trim().split("\n").filter(Boolean);
  if (lines.length < 2) return { ok: false, message: "Add at least 2 address lines." };
  const lastLine = lines[lines.length - 1];
  const uspsPattern = /[A-Z]{2}\s+\d{5}(-\d{4})?$/i;
  if (!uspsPattern.test(lastLine)) {
    return { ok: false, message: "Last line should be City, State ZIP (e.g. Seattle, WA 98104)." };
  }
  return { ok: true, message: "USPS formatting looks good. City, state, and ZIP all detected." };
}

export function ReturnAddressModal({ isOpen, onClose, onSave }: ReturnAddressModalProps) {
  const [label, setLabel] = useState("");
  const [address, setAddress] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);

  const usps = detectUsps(address);

  const handleSave = () => {
    if (!label.trim() || !address.trim()) return;
    onSave(label, address, category);
    setLabel(""); setAddress(""); setCategory(CATEGORIES[0]);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card return-addr-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-card-header">
          <div>
            <div className="modal-card-title">New return address</div>
            <div className="modal-card-sub">Appears in the top-left of every letter.</div>
          </div>
          <button className="flyout-close-btn" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="return-addr-body">
          <div className="return-addr-left">
            <div className="inspector-field-group">
              <label className="inspector-label">Label</label>
              <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Pacific NW Office" />
              <span className="modal-hint">Visible only to you in the library.</span>
            </div>

            <div className="inspector-field-group">
              <label className="inspector-label">Address lines</label>
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={4}
                placeholder={"APS Pacific NW\n900 Rainier Blvd\nSeattle, WA 98104"}
                style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 12, resize: "vertical" }}
              />
              <span className="modal-hint">One line per address line. Max 4 lines recommended.</span>
            </div>

            <div className="inspector-field-group">
              <label className="inspector-label">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>

            {address.trim() && (
              <div className={`usps-hint ${usps.ok ? "ok" : "warn"}`}>
                {usps.message}
              </div>
            )}
          </div>

          <div className="return-addr-preview">
            <div className="return-addr-preview-label">PREVIEW</div>
            <div className="return-addr-preview-address">
              {address.trim() ? (
                address.split("\n").map((line, i) => <div key={i}>{line}</div>)
              ) : (
                <span style={{ color: "var(--ink-300)" }}>Address will appear here</span>
              )}
            </div>
          </div>
        </div>

        <div className="modal-card-footer">
          <span className="modal-hint">Press ⌘ Enter to save</span>
          <div className="modal-card-actions">
            <button className="btn-outline-sm" onClick={onClose}>Cancel</button>
            <button className="btn-accent" onClick={handleSave} disabled={!label.trim() || !address.trim()}>Save address</button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Add return address modal styles**

```css
/* ── Return address modal ─────────────────────────────────────────── */
.return-addr-modal { width: 600px; }

.return-addr-body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.return-addr-left { display: flex; flex-direction: column; gap: 14px; }

.return-addr-preview {
  background: var(--ink-50);
  border: 1px solid var(--outline);
  border-radius: 10px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.return-addr-preview-label {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: var(--ink-500);
}

.return-addr-preview-address {
  font-size: 13px;
  line-height: 1.7;
  color: var(--ink-900);
}

.usps-hint {
  font-size: 12px;
  padding: 8px 10px;
  border-radius: 8px;
  font-weight: 500;
}
.usps-hint.ok { background: #f0fdf4; color: var(--success); }
.usps-hint.warn { background: #eff6ff; color: var(--info); }

.modal-hint { font-size: 11px; color: var(--ink-300); }
```

**Step 3: Wire into BuilderClient.tsx**

```tsx
import { ReturnAddressModal } from "./components/ReturnAddressModal";
```

Replace existing address modal with:
```tsx
<ReturnAddressModal
  isOpen={showAddressModal}
  onClose={() => setShowAddressModal(false)}
  onSave={(label, address, _category) => {
    const newItem: LibraryItem = { id: `ret-custom-${Date.now()}`, label, type: "return", content: address, isCustom: true };
    setLibrary((prev) => ({ ...prev, "Return Address": [newItem, ...prev["Return Address"]] }));
    setSelectedReturn(newItem);
    setShowAddressModal(false);
  }}
/>
```

**Step 4: Commit**

```bash
git add apps/web/app/components/ReturnAddressModal.tsx apps/web/app/globals.css apps/web/app/BuilderClient.tsx
git commit -m "feat: return address modal with live preview and USPS format validation"
```

---

### Task 13: Import from Word modal (redesigned)

**Files:**
- Create: `apps/web/app/components/ImportWordModal.tsx`
- Modify: `apps/web/app/globals.css`
- Modify: `apps/web/app/BuilderClient.tsx`

**Step 1: Create `apps/web/app/components/ImportWordModal.tsx`**

```tsx
"use client";

import { FileText, X } from "lucide-react";

type ImportWordModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onFileSelect: (file: File) => void;
  isLoading: boolean;
  error: string | null;
  warning: string | null;
};

export function ImportWordModal({ isOpen, onClose, onFileSelect, isLoading, error, warning }: ImportWordModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-card-header">
          <div>
            <div className="modal-card-title">Import from Word (.docx)</div>
            <div className="modal-card-sub">Your document replaces the current letter body on the active page.</div>
          </div>
          <button className="flyout-close-btn" onClick={onClose}><X size={16} /></button>
        </div>

        <div
          className="word-import-zone"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) onFileSelect(f); }}
        >
          <FileText size={32} strokeWidth={1.2} />
          <span className="logo-upload-label">Drop a .docx file</span>
          <label className="logo-upload-browse">
            or <span>browse files</span>
            <input type="file" accept=".docx" className="hidden-input"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onFileSelect(f); }} />
          </label>
        </div>

        <div className="word-import-tip warn">
          <strong>Heads up about tables:</strong> convert any tables to images first (select table → Copy → Paste Special → Picture) for best fidelity.
        </div>

        <ul className="word-import-tips">
          <li>Keep placeholders like <code className="mono">[Customer Name]</code> exactly as written — they'll stay mappable.</li>
          <li>Embedded images are imported as inline pictures.</li>
          <li>Fonts fall back to Source Serif 4 if unavailable.</li>
        </ul>

        {error && <div className="modal-error">{error}</div>}
        {warning && <div className="usps-hint warn">{warning}</div>}

        <div className="modal-card-footer">
          <span className="modal-hint">Max file size: 20 MB</span>
          <div className="modal-card-actions">
            <button className="btn-outline-sm" onClick={onClose}>Cancel</button>
            <button className="btn-accent" disabled={true}>
              {isLoading ? "Importing…" : "Choose a file first"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Add import word styles**

```css
/* ── Import Word modal ───────────────────────────────────────────── */
.word-import-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  border: 2px dashed var(--outline);
  border-radius: 10px;
  background: var(--ink-50);
  padding: 40px;
  color: var(--ink-500);
  text-align: center;
  cursor: pointer;
}

.word-import-tip {
  font-size: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  line-height: 1.5;
}
.word-import-tip.warn { background: #fffbeb; color: var(--warn); border: 1px solid rgba(180, 83, 9, 0.2); }

.word-import-tips {
  font-size: 12px;
  color: var(--ink-700);
  padding-left: 18px;
  margin: 0;
  line-height: 1.8;
}
```

**Step 3: Wire into BuilderClient.tsx**

```tsx
import { ImportWordModal } from "./components/ImportWordModal";
```

Replace existing Import modal with:
```tsx
{openMenuTab === "Import" && (
  <ImportWordModal
    isOpen={true}
    onClose={() => setOpenMenuTab(null)}
    onFileSelect={(file) => {
      /* existing mammoth import logic */
    }}
    isLoading={docxLoading}
    error={docxError}
    warning={docxWarning}
  />
)}
```

Wait — the Import button in the sidebar should open the modal differently. Change the sidebar to open the modal directly (no flyout panel for Import — it's a modal trigger):
```tsx
// In SidebarNav onSelect handler:
onSelect={(tab) => {
  if (tab === "Import") {
    setShowCreateModal(true); // or whatever state triggers the word import modal
    return;
  }
  setOpenMenuTab(openMenuTab === tab ? null : tab);
}}
```

**Step 4: Commit**

```bash
git add apps/web/app/components/ImportWordModal.tsx apps/web/app/globals.css apps/web/app/BuilderClient.tsx
git commit -m "feat: Import Word modal redesign with drop zone, table warning, placeholder tips"
```

---

### Task 14: Manage library admin page

**Files:**
- Create: `apps/web/app/components/ManageLibrary.tsx`
- Modify: `apps/web/app/globals.css`
- Modify: `apps/web/app/BuilderClient.tsx`

**Step 1: Create `apps/web/app/components/ManageLibrary.tsx`**

```tsx
"use client";

import { useState } from "react";
import { Search, X } from "lucide-react";

type AssetRow = {
  id: string;
  thumbnail?: string;
  name: string;
  subtitle?: string;
  updatedAt?: string;
  source: "CUSTOM" | "SYSTEM";
};

type LibrarySection = {
  id: string;
  label: string;
  count: number;
};

type ManageLibraryProps = {
  isOpen: boolean;
  onClose: () => void;
  sections: LibrarySection[];
  assets: Record<string, AssetRow[]>;
};

const WORKSPACE_SECTIONS = [
  { id: "team", label: "Team members", count: 0 },
  { id: "approvals", label: "Approvals queue", count: 0 },
  { id: "activity", label: "Activity log", count: 0 },
  { id: "settings", label: "Settings", count: 0 },
];

export function ManageLibrary({ isOpen, onClose, sections, assets }: ManageLibraryProps) {
  const [activeSection, setActiveSection] = useState(sections[0]?.id ?? "");
  const [query, setQuery] = useState("");

  if (!isOpen) return null;

  const rows = (assets[activeSection] ?? []).filter((r) =>
    !query.trim() || r.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="manage-library-modal" onClick={(e) => e.stopPropagation()}>
        {/* Left sidebar */}
        <div className="manage-sidebar">
          <div className="manage-sidebar-group">
            <span className="manage-sidebar-group-label">ASSETS</span>
            {sections.map((s) => (
              <button
                key={s.id}
                className={`manage-sidebar-btn${activeSection === s.id ? " active" : ""}`}
                onClick={() => setActiveSection(s.id)}
              >
                {s.label}
                <span className="manage-sidebar-count">{s.count}</span>
              </button>
            ))}
          </div>
          <div className="manage-sidebar-group">
            <span className="manage-sidebar-group-label">WORKSPACE</span>
            {WORKSPACE_SECTIONS.map((s) => (
              <button key={s.id} className="manage-sidebar-btn">{s.label}</button>
            ))}
          </div>
        </div>

        {/* Main content */}
        <div className="manage-content">
          <div className="manage-content-header">
            <div>
              <div className="manage-content-title">{sections.find((s) => s.id === activeSection)?.label ?? activeSection}</div>
              <div className="manage-content-sub">{rows.length} assets</div>
            </div>
            <div className="manage-header-actions">
              <div className="flyout-search-bar" style={{ width: 200 }}>
                <Search size={13} />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search assets..." />
              </div>
              <button className="btn-outline-sm">Import</button>
              <button className="btn-accent">New logo</button>
            </div>
          </div>

          <table className="manage-table">
            <thead>
              <tr>
                <th style={{ width: 48 }}></th>
                <th>NAME</th>
                <th>UPDATED</th>
                <th>SOURCE</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    {row.thumbnail && (
                      <img src={row.thumbnail} alt="" style={{ width: 36, height: 28, objectFit: "contain", borderRadius: 4, border: "1px solid var(--outline)" }} />
                    )}
                  </td>
                  <td>
                    <div className="manage-row-name">{row.name}</div>
                    {row.subtitle && <div className="manage-row-sub">{row.subtitle}</div>}
                  </td>
                  <td className="manage-row-date">{row.updatedAt ?? "—"}</td>
                  <td>
                    <span className={`manage-source-badge ${row.source.toLowerCase()}`}>{row.source}</span>
                  </td>
                  <td></td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: "center", padding: 32, color: "var(--ink-300)", fontSize: 13 }}>No items found.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <button className="manage-close-btn" onClick={onClose}><X size={18} /></button>
      </div>
    </div>
  );
}
```

**Step 2: Add manage library styles**

```css
/* ── Manage library ──────────────────────────────────────────────── */
.manage-library-modal {
  background: white;
  border-radius: 14px;
  width: 900px;
  max-width: 95vw;
  height: 80vh;
  display: flex;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0,0,0,0.2);
  position: relative;
}

.manage-close-btn {
  position: absolute;
  top: 14px;
  right: 14px;
  background: none;
  border: none;
  color: var(--ink-500);
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
}
.manage-close-btn:hover { background: var(--ink-50); }

.manage-sidebar {
  width: 200px;
  flex: 0 0 200px;
  border-right: 1px solid var(--outline);
  padding: 20px 12px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  overflow-y: auto;
}

.manage-sidebar-group { display: flex; flex-direction: column; gap: 2px; }

.manage-sidebar-group-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--ink-500);
  text-transform: uppercase;
  padding: 0 8px;
  margin-bottom: 4px;
}

.manage-sidebar-btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 10px;
  border-radius: 8px;
  border: none;
  background: transparent;
  font-size: 13px;
  color: var(--ink-700);
  cursor: pointer;
  text-align: left;
  width: 100%;
}
.manage-sidebar-btn:hover { background: var(--ink-50); }
.manage-sidebar-btn.active { background: var(--ink-900); color: white; }
.manage-sidebar-count { font-size: 11px; opacity: 0.7; }

.manage-content { flex: 1; display: flex; flex-direction: column; overflow: hidden; }

.manage-content-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 20px 24px 14px;
  border-bottom: 1px solid var(--outline);
}
.manage-content-title { font-size: 18px; font-weight: 700; color: var(--ink-900); }
.manage-content-sub { font-size: 12px; color: var(--ink-500); margin-top: 2px; }

.manage-header-actions { display: flex; align-items: center; gap: 8px; }

.manage-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.manage-table th {
  text-align: left;
  padding: 8px 12px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--ink-500);
  background: var(--ink-50);
  border-bottom: 1px solid var(--outline);
}
.manage-table td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--outline);
  vertical-align: middle;
}

.manage-row-name { font-weight: 600; color: var(--ink-900); }
.manage-row-sub { font-size: 11px; color: var(--ink-500); margin-top: 2px; }
.manage-row-date { font-size: 12px; color: var(--ink-500); }

.manage-source-badge {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.05em;
  border-radius: 4px;
  padding: 2px 7px;
  border: 1px solid;
}
.manage-source-badge.custom { color: var(--accent); border-color: var(--accent); background: var(--accent-soft); }
.manage-source-badge.system { color: var(--ink-500); border-color: var(--ink-150); background: var(--ink-50); }
```

**Step 3: Wire into BuilderClient.tsx**

Import:
```tsx
import { ManageLibrary } from "./components/ManageLibrary";
```

Add state:
```tsx
const [showManageLibrary, setShowManageLibrary] = useState(false);
```

Add a "Manage library" button in the topbar (or at the bottom of the sidebar nav):
```tsx
// Inside SidebarNav or at bottom of .sidebar-nav:
<button className="sidebar-nav-btn" onClick={() => setShowManageLibrary(true)} title="Manage library">
  <Settings size={20} strokeWidth={1.8} />
  <span className="sidebar-nav-label">Manage</span>
</button>
```

Add the modal:
```tsx
{showManageLibrary && (
  <ManageLibrary
    isOpen={showManageLibrary}
    onClose={() => setShowManageLibrary(false)}
    sections={[
      { id: "Logos", label: "Logos", count: library["Logos"].length },
      { id: "Return Address", label: "Return addresses", count: library["Return Address"].length },
      { id: "Taglines", label: "Taglines", count: library["Taglines"].length },
      { id: "Verbiage", label: "Verbiage blocks", count: library["Verbiage"].length },
      { id: "Full Letters", label: "Letter templates", count: library["Full Letters"].length },
    ]}
    assets={Object.fromEntries(
      Object.entries(library).map(([key, items]) => [
        key,
        items.map((item) => ({
          id: item.id,
          thumbnail: item.imageUrl,
          name: item.label,
          subtitle: item.type,
          updatedAt: "Recently",
          source: item.isCustom ? "CUSTOM" : "SYSTEM",
        })),
      ])
    )}
  />
)}
```

**Step 4: Commit**

```bash
git add apps/web/app/components/ManageLibrary.tsx apps/web/app/globals.css apps/web/app/BuilderClient.tsx
git commit -m "feat: manage library admin modal with asset table, CUSTOM/SYSTEM badges, sidebar nav"
```

---

### Task 15: Final integration pass + build verification

**Files:**
- Modify: `apps/web/app/BuilderClient.tsx` (remove dead code, ensure all tabs are wired)
- Modify: `apps/web/app/globals.css` (remove obsolete CSS classes)

**Step 1: Audit tab wiring in BuilderClient.tsx**

Confirm all 7 sidebar tabs have handlers:
- `Logo` → `<LogoLibrary />`
- `Return` → existing return address flyout (update styling) or new `<ReturnAddressModal />`
- `Verbiage` → `<VerbiageLibrary />`
- `Tagline` → existing tagline flyout (keep or reuse FlyoutPanel with new styles)
- `Templates` → `<TemplateLibrary />`
- `Import` → `<ImportWordModal />`
- `Data` → `<DataPanel />`

**Step 2: Verify layout structure**

The builder layout should be:
```
<div class="builder">
  <Topbar />
  <div class="builder-body">
    <SidebarNav />
    {/* Conditional flyout based on openMenuTab */}
    {openMenuTab === "Logo" && <LogoLibrary />}
    {openMenuTab === "Verbiage" && <VerbiageLibrary />}
    {openMenuTab === "Templates" && <TemplateLibrary />}
    {openMenuTab === "Data" && <DataPanel />}
    {/* Canvas area */}
    <div class="canvas-area">
      {/* page thumbnails + editor */}
    </div>
    {/* Inspector */}
    <InspectorPanel />
  </div>
  {/* Modals */}
  <UploadLogoModal />
  <ReturnAddressModal />
  <ImportWordModal />
  <ManageLibrary />
  {showPreview && <MergePreview />}
</div>
```

**Step 3: Run build to verify no TypeScript errors**

```bash
cd apps/web && npm run build 2>&1 | tail -30
```

Fix any TypeScript errors before committing.

**Step 4: Run linter**

```bash
cd apps/web && npm run lint 2>&1 | tail -20
```

Fix any ESLint warnings.

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat: UI redesign v2 complete — all 3 phases integrated and building cleanly"
```

---

## Post-implementation checklist

Before calling this done, manually verify in the browser (`npm run dev`):

- [ ] Topbar shows brand, editable title, save status, Export/Preview/Generate
- [ ] Sidebar shows 7 icon buttons, active button gets rust highlight + left bar
- [ ] Clicking Logo opens the logo grid flyout with search, tabs, recently used
- [ ] Clicking Verbiage opens dense list with tag filter chips
- [ ] Clicking Templates opens card grid with category tabs
- [ ] Clicking Data opens the data/mapping panel
- [ ] Clicking Import opens the Word import modal
- [ ] Right inspector shows Block/Document/Merge tabs with readiness checklist
- [ ] Empty canvas shows the empty state with 3 starter cards
- [ ] Upload logo modal shows drop zone + display name input
- [ ] Return address modal shows live preview + USPS hint
- [ ] Preview button opens merge preview with recipient list
- [ ] Manage library modal shows sidebar + asset table
- [ ] Letter body text renders in Source Serif 4 serif font
- [ ] Placeholders like [Customer Name] render in JetBrains Mono
- [ ] All buttons and accents use warm rust (#b3502f), not the old slate black
