# Word Template Upload — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a sidebar "Upload" tab that lets users import a .docx Word template into the canvas, replacing existing content.

**Architecture:** Client-side only. mammoth.js converts DOCX→HTML in the browser. HTML is sanitized with DOMPurify (already a dependency) and loaded into the Tiptap editor via `editor.commands.setContent()`. No API or backend changes needed.

**Tech Stack:** mammoth.js (new dependency), existing Tiptap editor, DOMPurify, React FileReader API

---

### Task 1: Add mammoth.js dependency

**Files:**
- Modify: `apps/web/package.json`

**Step 1: Install mammoth**

Run: `cd /Users/minwang/AdhocPrintStudio/apps/web && npm install mammoth`

**Step 2: Verify installation**

Run: `cd /Users/minwang/AdhocPrintStudio/apps/web && node -e "require('mammoth'); console.log('mammoth OK')"`
Expected: `mammoth OK`

**Step 3: Commit**

```bash
cd /Users/minwang/AdhocPrintStudio
git add apps/web/package.json apps/web/package-lock.json
git commit -m "feat: add mammoth.js for DOCX import"
```

---

### Task 2: Add "Upload" sidebar tab button

**Files:**
- Modify: `apps/web/app/BuilderClient.tsx`

**Step 1: Add the Upload button to the sidebar nav**

In `BuilderClient.tsx`, find the `libraryButtons` array (line ~436):

```typescript
const libraryButtons = [
  { label: "Logo", tab: "Logos", icon: "🏷️" },
  { label: "Return Address", tab: "Return Address", icon: "📍" },
  { label: "Verbiage", tab: "Verbiage", icon: "💬" },
  { label: "Tagline", tab: "Taglines", icon: "✨" },
  { label: "Letter Template", tab: "Full Letters", icon: "📄" },
] as const;
```

Change to (add Upload entry):

```typescript
const libraryButtons = [
  { label: "Logo", tab: "Logos", icon: "🏷️" },
  { label: "Return Address", tab: "Return Address", icon: "📍" },
  { label: "Verbiage", tab: "Verbiage", icon: "💬" },
  { label: "Tagline", tab: "Taglines", icon: "✨" },
  { label: "Letter Template", tab: "Full Letters", icon: "📄" },
  { label: "Upload Word", tab: "Upload", icon: "📂" },
] as const;
```

**Step 2: Verify the tab renders**

Run: `cd /Users/minwang/AdhocPrintStudio/apps/web && npm run build`
Expected: Build succeeds. The "Upload Word" button should appear in the sidebar.

**Step 3: Commit**

```bash
cd /Users/minwang/AdhocPrintStudio
git add apps/web/app/BuilderClient.tsx
git commit -m "feat: add Upload Word sidebar tab button"
```

---

### Task 3: Add DOCX upload handler and dropzone UI

**Files:**
- Modify: `apps/web/app/BuilderClient.tsx`

**Step 1: Add mammoth import and state variables**

At the top of `BuilderClient.tsx`, after the existing imports (around line 9-10), add:

```typescript
import mammoth from "mammoth";
```

Inside the `BuilderPage` component function (after existing state declarations, around line ~590), add:

```typescript
const [docxError, setDocxError] = useState<string | null>(null);
const [docxWarning, setDocxWarning] = useState<string | null>(null);
const [docxLoading, setDocxLoading] = useState(false);
const docxInputRef = useRef<HTMLInputElement | null>(null);
```

**Step 2: Add the handleDocxUpload handler**

Add this function inside the component (after the existing handler functions, around line ~1220):

```typescript
const handleDocxUpload = async (file: File) => {
  setDocxError(null);
  setDocxWarning(null);

  if (!file.name.toLowerCase().endsWith(".docx")) {
    setDocxError("Please upload a .docx file");
    return;
  }

  setDocxLoading(true);
  try {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.convertToHtml(arrayBuffer, {
      convertImage: mammoth.images.imgElement((image) =>
        image.read("base64").then((imageBuffer) => ({
          src: `data:${image.contentType};base64,${imageBuffer}`,
        }))
      ),
    });

    const html = result.value;
    if (!html || !html.trim()) {
      setDocxError("This document appears to be empty");
      setDocxLoading(false);
      return;
    }

    // Check for table warnings
    const hasTableWarning = result.messages.some(
      (msg) => msg.type === "warning" && msg.message.toLowerCase().includes("table")
    );
    // Also check if the HTML itself contains table tags
    const hasTableTags = /<table[\s>]/i.test(html);

    if (hasTableWarning || hasTableTags) {
      setDocxWarning(
        "Tables detected. For best results, convert tables to images in Word first " +
        "(select table → Copy → Paste as Picture), then re-upload."
      );
    }

    // Sanitize HTML
    const cleanHtml = DOMPurify.sanitize(html, {
      ADD_TAGS: ["img"],
      ADD_ATTR: ["src", "alt", "style"],
    });

    // Replace canvas content
    const editor = editorRef.current?.getEditor();
    if (editor) {
      editor.commands.setContent(cleanHtml);
    }

    // Reset blocks on the current page since we replaced the body
    setBlocksByPage((prev) => ({ ...prev, [activePage]: [] }));

  } catch (err) {
    setDocxError("Could not read this file. Please check it opens correctly in Word.");
  } finally {
    setDocxLoading(false);
  }
};
```

**Step 3: Add the Upload tab UI in the flyout/sidebar rendering section**

Find where the `FlyoutPanel` is rendered with `openMenuTab` (around line ~2150). After the existing `FlyoutPanel` block's closing tag, add a conditional for the Upload tab.

Alternatively, inside the `FlyoutPanel` content area, add a condition for when `openMenuTab === "Upload"`. Find the `BlockMenu` component rendering section inside the FlyoutPanel (around lines 2200+). Before or alongside the `BlockMenu`, add:

```typescript
{openMenuTab === "Upload" && (
  <div className="upload-docx-panel" style={{ padding: "16px" }}>
    <p style={{ marginBottom: "12px", fontSize: "14px", color: "#666" }}>
      Upload a Word document (.docx) to replace the canvas content.
    </p>

    <div
      style={{
        border: "2px dashed #ccc",
        borderRadius: "8px",
        padding: "32px 16px",
        textAlign: "center",
        cursor: "pointer",
        background: docxLoading ? "#f9f9f9" : "#fff",
      }}
      onClick={() => docxInputRef.current?.click()}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        if (file) handleDocxUpload(file);
      }}
    >
      {docxLoading ? (
        <p>Converting document...</p>
      ) : (
        <>
          <p style={{ fontWeight: 600, marginBottom: "4px" }}>
            Drag and drop a .docx file here
          </p>
          <p style={{ fontSize: "13px", color: "#999" }}>or click to browse</p>
        </>
      )}
      <input
        ref={docxInputRef}
        type="file"
        accept=".docx"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleDocxUpload(file);
          e.target.value = "";
        }}
      />
    </div>

    {docxError && (
      <p style={{
        marginTop: "12px", padding: "8px 12px", background: "#FEE2E2",
        color: "#DC2626", borderRadius: "6px", fontSize: "13px",
      }}>
        {docxError}
      </p>
    )}

    {docxWarning && (
      <p style={{
        marginTop: "12px", padding: "8px 12px", background: "#FEF3C7",
        color: "#92400E", borderRadius: "6px", fontSize: "13px",
      }}>
        ⚠️ {docxWarning}
      </p>
    )}
  </div>
)}
```

**Important placement note:** The Upload tab doesn't use the `BlockMenu` or `FlyoutPanel` search/create pattern. It needs its own content. Find where the `openMenuTab` conditions render content. The simplest approach: when `openMenuTab === "Upload"`, render a custom panel instead of the standard `FlyoutPanel + BlockMenu` combo. Or render the Upload content inside the FlyoutPanel's `children` area conditionally.

Look for the section where `BlockMenu` is rendered inside the FlyoutPanel (around lines 2200-2210):

```tsx
<BlockMenu
  items={currentItems}
  onInsert={handleInsertFromMenu}
  onDragStart={handleDragStart}
  query={flyoutQuery}
/>
```

Before this `<BlockMenu ...>`, add the conditional:

```tsx
{openMenuTab === "Upload" ? (
  <div className="upload-docx-panel" style={{ padding: "16px" }}>
    {/* ... the upload UI from above ... */}
  </div>
) : (
  <BlockMenu
    items={currentItems}
    onInsert={handleInsertFromMenu}
    onDragStart={handleDragStart}
    query={flyoutQuery}
  />
)}
```

Also update the `FlyoutPanel` search placeholder to handle the Upload tab. Find the `searchPlaceholder` ternary chain (~line 2156-2167) and add before the final default:

```typescript
: openMenuTab === "Upload"
  ? "Upload a .docx file..."
```

And hide the search input + "Add your own" footer for the Upload tab by adding conditions to `FlyoutPanel`. The simplest way: pass `searchValue=""` and make the footer invisible. OR just leave the search bar visible (it won't affect anything).

**Step 4: Build and verify**

Run: `cd /Users/minwang/AdhocPrintStudio/apps/web && npm run build`
Expected: Build succeeds without errors.

**Step 5: Commit**

```bash
cd /Users/minwang/AdhocPrintStudio
git add apps/web/app/BuilderClient.tsx
git commit -m "feat: add Word document upload handler with mammoth.js conversion"
```

---

### Task 4: Build and test the Windows distribution

**Step 1: Rebuild Windows zip**

Run: `cd /Users/minwang/AdhocPrintStudio && bash scripts/build-windows.sh 2>&1 | tail -10`

Verify: Build succeeds and mammoth is included in the frontend bundle.

**Step 2: Verify mammoth is bundled in the static export**

Run: `grep -l "mammoth" /Users/minwang/AdhocPrintStudio/build/windows-stage/web/_next/static/chunks/*.js 2>/dev/null | head -3`
Expected: At least one JS chunk file contains mammoth code.

**Step 3: Commit and push**

```bash
cd /Users/minwang/AdhocPrintStudio
git push
```

---

### Task 5: Manual QA Testing

**Test cases (manual, in browser at localhost:8000):**

1. **Simple .docx** — Upload a Word file with just formatted text (bold, italic, colors). Verify text appears in canvas with formatting preserved.

2. **DOCX with images** — Upload a Word file containing a logo image. Verify image appears inline in the canvas.

3. **DOCX with tables** — Upload a Word file containing a table. Verify yellow warning banner appears: "Tables detected..."

4. **Non-docx file** — Try uploading a .pdf or .txt file. Verify red error: "Please upload a .docx file"

5. **Empty document** — Upload an empty Word file. Verify error: "This document appears to be empty"

6. **Drag and drop** — Drag a .docx file onto the dropzone. Verify it imports correctly.

7. **After import, merge/preview** — Import a Word template, upload a spreadsheet, run Merge/Preview. Verify the merged output uses the imported Word content.

---

## Summary of All Changes

| File | Change |
|------|--------|
| `apps/web/package.json` | Add `mammoth` dependency |
| `apps/web/app/BuilderClient.tsx` | Add "Upload Word" sidebar tab, mammoth import, upload handler, dropzone UI |
| No API changes | — |
| No backend changes | — |
