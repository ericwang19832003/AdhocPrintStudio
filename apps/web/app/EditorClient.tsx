"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { Extension, Node as TiptapNode } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import TextStyle from "@tiptap/extension-text-style";
import FontFamily from "@tiptap/extension-font-family";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (size: string) => ReturnType;
    };
    lineHeight: {
      setLineHeight: (height: string) => ReturnType;
    };
  }
}

type DroppedItem = {
  id?: string;
  label?: string;
  type?: string;
  content?: string;
  imageUrl?: string;
};

import type { Editor } from "@tiptap/react";

export type EditorClientHandle = {
  insertText: (text: string) => void;
  insertLibraryItem: (
    item: { id?: string; label?: string; type?: string; content?: string },
    options?: { standardFormat?: boolean }
  ) => void;
  focusAtPoint: (x: number, y: number) => void;
  focusEnd: () => void;
  getEditor: () => Editor | null;
};

type EditorClientProps = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  onDropItem?: (item: DroppedItem, coords: { x: number; y: number }) => void;
  columns?: string[];
};

const FontSize = Extension.create({
  name: "fontSize",
  addGlobalAttributes() {
    return [
      {
        types: ["textStyle"],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize || null,
            renderHTML: (attributes) =>
              attributes.fontSize ? { style: `font-size: ${attributes.fontSize}` } : {},
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setFontSize:
        (size: string) =>
        ({ commands }) => {
          return commands.setMark("textStyle", { fontSize: size });
        },
    };
  },
});

const LineHeight = Extension.create({
  name: "lineHeight",
  addGlobalAttributes() {
    return [
      {
        types: ["paragraph"],
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: (element) => element.style.lineHeight || null,
            renderHTML: (attributes) =>
              attributes.lineHeight ? { style: `line-height: ${attributes.lineHeight}` } : {},
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setLineHeight:
        (value: string) =>
        ({ commands }) => {
          return commands.updateAttributes("paragraph", { lineHeight: value });
        },
    };
  },
});

const VerbiageBlock = TiptapNode.create({
  name: "verbiageBlock",
  group: "block",
  content: "block+",
  isolating: true,
  addAttributes() {
    return {
      verbiageId: { default: null },
      label: { default: null },
      sourceType: { default: "verbiage" },
    };
  },
  parseHTML() {
    return [{ tag: "div[data-verbiage-id]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      {
        ...HTMLAttributes,
        "data-verbiage-id": HTMLAttributes.verbiageId,
        "data-verbiage-label": HTMLAttributes.label,
        "data-source-type": HTMLAttributes.sourceType,
        class: "verbiage-block",
      },
      0,
    ];
  },
});

const EditorClient = forwardRef<EditorClientHandle, EditorClientProps>(
  ({ value, onChange, placeholder, onDropItem, columns = [] }, ref) => {
  // Placeholder picker state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const [pickerPosition, setPickerPosition] = useState<{ top: number; left: number; flipped: boolean }>({ top: 0, left: 0, flipped: false });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const bracketStartPosRef = useRef<number | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Constants for picker positioning
  const PICKER_HEIGHT = 260; // max-height (240) + padding (20)
  const PICKER_MARGIN = 8;

  // Filter columns based on query
  const filteredColumns = useMemo(() => {
    if (!pickerQuery) return columns;
    const query = pickerQuery.toLowerCase();
    return columns.filter((col) => col.toLowerCase().includes(query));
  }, [columns, pickerQuery]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false, // We don't need headings in letters
      }),
      Underline,
      TextStyle,
      FontFamily,
      FontSize,
      LineHeight,
      VerbiageBlock,
      Color,
      Highlight.configure({ multicolor: true }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "editor-link",
        },
      }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({ placeholder: placeholder ?? "Start typing your letter..." }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      handleDrop: (view, event) => {
        // Check if this is a library item drop - prevent ProseMirror's native text drop
        const payload = event.dataTransfer?.getData("text/plain");
        if (payload) {
          try {
            const item = JSON.parse(payload);
            // For library items, prevent ProseMirror's native drop (which would insert raw JSON)
            // The actual insertion is handled by editor-shell's onDrop
            if (item && item.type && ["verbiage", "full-letter", "tagline", "logo", "return"].includes(item.type)) {
              return true; // Prevent ProseMirror's native handling
            }
          } catch {
            // Not JSON, let ProseMirror handle it
          }
        }
        return false;
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (editor.getHTML() !== value) {
      editor.commands.setContent(value, false);
    }
  }, [editor, value]);

  // Listen for text changes to detect [ character and track query
  useEffect(() => {
    if (!editor) return;

    const handleUpdate = () => {
      const { state } = editor;
      const { from } = state.selection;
      const textBefore = state.doc.textBetween(Math.max(0, from - 50), from, "");

      // Find the last unmatched [ bracket
      const lastBracketIndex = textBefore.lastIndexOf("[");
      const hasClosingBracket = lastBracketIndex >= 0 && textBefore.slice(lastBracketIndex).includes("]");

      if (lastBracketIndex >= 0 && !hasClosingBracket && columns.length > 0) {
        // We have an open bracket - show picker
        const query = textBefore.slice(lastBracketIndex + 1);
        const bracketPos = from - textBefore.length + lastBracketIndex;

        if (!pickerOpen || bracketStartPosRef.current !== bracketPos) {
          // Get cursor coordinates for positioning
          const coords = editor.view.coordsAtPos(from);
          const viewportHeight = window.innerHeight;
          const viewportWidth = window.innerWidth;

          // Check if there's enough space below the cursor
          const spaceBelow = viewportHeight - coords.bottom;
          const spaceAbove = coords.top;
          const shouldFlip = spaceBelow < PICKER_HEIGHT && spaceAbove > spaceBelow;

          // Calculate position
          let top: number;
          if (shouldFlip) {
            // Position above cursor
            top = coords.top - PICKER_HEIGHT - PICKER_MARGIN;
          } else {
            // Position below cursor
            top = coords.bottom + PICKER_MARGIN;
          }

          // Ensure picker doesn't go off-screen horizontally
          let left = coords.left;
          const pickerWidth = 300; // max-width from CSS
          if (left + pickerWidth > viewportWidth - PICKER_MARGIN) {
            left = viewportWidth - pickerWidth - PICKER_MARGIN;
          }
          if (left < PICKER_MARGIN) {
            left = PICKER_MARGIN;
          }

          setPickerPosition({ top, left, flipped: shouldFlip });
          bracketStartPosRef.current = bracketPos;
        }

        setPickerQuery(query);
        setPickerOpen(true);
        setSelectedIndex(0);
      } else if (pickerOpen) {
        // Close picker if no open bracket
        setPickerOpen(false);
        setPickerQuery("");
        bracketStartPosRef.current = null;
      }
    };

    editor.on("update", handleUpdate);
    editor.on("selectionUpdate", handleUpdate);

    return () => {
      editor.off("update", handleUpdate);
      editor.off("selectionUpdate", handleUpdate);
    };
  }, [editor, columns.length, pickerOpen]);

  // Handle keyboard navigation for picker
  useEffect(() => {
    if (!pickerOpen || !editor) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!pickerOpen) return;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, filteredColumns.length - 1));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (event.key === "Enter" && filteredColumns.length > 0) {
        event.preventDefault();
        const selectedColumn = filteredColumns[selectedIndex];
        if (selectedColumn && bracketStartPosRef.current !== null) {
          // Delete from bracket start to current position and insert [columnName]
          const from = bracketStartPosRef.current;
          const to = editor.state.selection.from;
          editor
            .chain()
            .focus()
            .deleteRange({ from, to })
            .insertContent(`[${selectedColumn}]`)
            .run();
        }
        setPickerOpen(false);
        setPickerQuery("");
        bracketStartPosRef.current = null;
      } else if (event.key === "Escape") {
        event.preventDefault();
        setPickerOpen(false);
        setPickerQuery("");
        bracketStartPosRef.current = null;
      } else if (event.key === "Tab" && filteredColumns.length > 0) {
        event.preventDefault();
        const selectedColumn = filteredColumns[selectedIndex];
        if (selectedColumn && bracketStartPosRef.current !== null) {
          const from = bracketStartPosRef.current;
          const to = editor.state.selection.from;
          editor
            .chain()
            .focus()
            .deleteRange({ from, to })
            .insertContent(`[${selectedColumn}]`)
            .run();
        }
        setPickerOpen(false);
        setPickerQuery("");
        bracketStartPosRef.current = null;
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [pickerOpen, editor, filteredColumns, selectedIndex]);

  // Select placeholder column from picker
  const selectColumn = useCallback(
    (column: string) => {
      if (!editor || bracketStartPosRef.current === null) return;
      const from = bracketStartPosRef.current;
      const to = editor.state.selection.from;
      editor
        .chain()
        .focus()
        .deleteRange({ from, to })
        .insertContent(`[${column}]`)
        .run();
      setPickerOpen(false);
      setPickerQuery("");
      bracketStartPosRef.current = null;
    },
    [editor]
  );

  useImperativeHandle(
    ref,
    () => ({
      insertText: (text: string) => {
        if (!editor) return;
        editor.chain().focus().insertContent(text).run();
      },
      insertLibraryItem: (item, options) => {
        if (!editor || !item.content) return;
        const lines = item.content
          .split(/\n+/)
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => ({
            type: "paragraph",
            content: [{ type: "text", text: line }],
          }));

        // Check if editor is empty (only has empty paragraph with placeholder)
        const isEmpty = editor.state.doc.textContent.trim() === "";

        // Build the content to insert
        const contentToInsert = item.type === "verbiage"
          ? {
              type: "verbiageBlock",
              attrs: {
                verbiageId: item.id ?? null,
                label: item.label ?? null,
                sourceType: "verbiage",
              },
              content: lines.length > 0 ? lines : [{ type: "paragraph" }],
            }
          : lines.length > 0 ? lines : [{ type: "paragraph" }];

        // If editor is empty, replace all content; otherwise insert at cursor
        if (isEmpty) {
          const chain = editor.chain().focus().clearContent();
          if (options?.standardFormat) {
            chain.setFontFamily("Times New Roman").setFontSize("12pt").setLineHeight("1.5").setTextAlign("left");
          }
          chain.insertContent(contentToInsert).run();
        } else {
          const chain = editor.chain().focus();
          if (options?.standardFormat) {
            chain.setFontFamily("Times New Roman").setFontSize("12pt").setLineHeight("1.5").setTextAlign("left");
          }
          chain.insertContent(contentToInsert).run();
        }
      },
      focusAtPoint: (x, y) => {
        if (!editor) return;
        const coords = editor.view.posAtCoords({ left: x, top: y });
        if (coords) {
          editor.chain().focus().setTextSelection(coords.pos).run();
          return;
        }
        editor.chain().focus("end").run();
      },
      focusEnd: () => {
        if (!editor) return;
        editor.chain().focus("end").run();
      },
      getEditor: () => editor,
    }),
    [editor]
  );

  const handleShellDrop = (event: React.DragEvent<HTMLDivElement>) => {
    const payload = event.dataTransfer.getData("text/plain");
    if (!payload || !editor) return;

    try {
      const item = JSON.parse(payload) as DroppedItem;
      if (item && item.type && ["verbiage", "full-letter"].includes(item.type) && item.content) {
        event.preventDefault();
        event.stopPropagation();

        // Try to get drop position from coordinates
        const coords = { left: event.clientX, top: event.clientY };
        const posAtCoords = editor.view.posAtCoords(coords);

        // Parse content into paragraphs
        const lines = item.content
          .split(/\n+/)
          .map((line: string) => line.trim())
          .filter(Boolean)
          .map((line: string) => ({
            type: "paragraph",
            content: [{ type: "text", text: line }],
          }));

        // Check if editor is empty (only has empty paragraph with placeholder)
        const isEmpty = editor.state.doc.textContent.trim() === "";

        // Build the content to insert
        const contentToInsert = item.type === "verbiage"
          ? {
              type: "verbiageBlock",
              attrs: {
                verbiageId: item.id ?? null,
                label: item.label ?? null,
                sourceType: "verbiage",
              },
              content: lines.length > 0 ? lines : [{ type: "paragraph" }],
            }
          : lines.length > 0 ? lines : [{ type: "paragraph" }];

        // If editor is empty, clear and insert; otherwise insert at drop position
        if (isEmpty) {
          editor.chain().focus().clearContent().insertContent(contentToInsert).run();
        } else {
          if (posAtCoords?.pos !== undefined) {
            editor.chain().focus().setTextSelection(posAtCoords.pos).insertContent(contentToInsert).run();
          } else {
            editor.chain().focus("end").insertContent(contentToInsert).run();
          }
        }
        return;
      }
      // For other types (tagline, logo, return), just prevent default
      if (item && item.type && ["tagline", "logo", "return"].includes(item.type)) {
        event.preventDefault();
        return;
      }
    } catch {
      // Not JSON, let native drop handle it
    }
  };

  return (
    <div
      className="editor-shell"
      onDragOver={(event) => {
        // Always allow drop
        event.preventDefault();
      }}
      onDrop={handleShellDrop}
    >
      <EditorContent editor={editor} className="body-editor" />

      {/* Placeholder Picker Dropdown */}
      {pickerOpen && columns.length > 0 && (
        <div
          ref={pickerRef}
          className={`placeholder-picker${pickerPosition.flipped ? " flipped" : ""}`}
          style={{ top: pickerPosition.top, left: pickerPosition.left }}
        >
          {filteredColumns.length > 0 ? (
            filteredColumns.slice(0, 10).map((column, index) => (
              <div
                key={column}
                className={`placeholder-picker-item${index === selectedIndex ? " selected" : ""}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectColumn(column);
                }}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                {column}
              </div>
            ))
          ) : (
            <div className="placeholder-picker-empty">No matching columns</div>
          )}
          {filteredColumns.length > 10 && (
            <div className="placeholder-picker-more">
              +{filteredColumns.length - 10} more
            </div>
          )}
        </div>
      )}
    </div>
  );
  }
);

EditorClient.displayName = "EditorClient";

// Separate toolbar component that can be rendered outside the canvas
export function EditorToolbar({ editor }: { editor: Editor | null }) {
  const [showTextColorPicker, setShowTextColorPicker] = useState(false);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);

  const textColors = [
    { name: "Black", value: "#000000" },
    { name: "Dark Gray", value: "#4b5563" },
    { name: "Gray", value: "#6b7280" },
    { name: "Red", value: "#dc2626" },
    { name: "Orange", value: "#ea580c" },
    { name: "Yellow", value: "#ca8a04" },
    { name: "Green", value: "#16a34a" },
    { name: "Blue", value: "#2563eb" },
    { name: "Purple", value: "#9333ea" },
    { name: "Pink", value: "#db2777" },
  ];

  const highlightColors = [
    { name: "None", value: "" },
    { name: "Yellow", value: "#fef08a" },
    { name: "Green", value: "#bbf7d0" },
    { name: "Cyan", value: "#a5f3fc" },
    { name: "Pink", value: "#fbcfe8" },
    { name: "Purple", value: "#e9d5ff" },
    { name: "Orange", value: "#fed7aa" },
    { name: "Gray", value: "#e5e7eb" },
  ];

  const setLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt("Enter URL:", previousUrl || "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  // Show loading state if editor not ready
  if (!editor) {
    return (
      <div className="editor-toolbar-bar editor-toolbar-loading">
        <div className="toolbar-group">
          <button disabled className="disabled">↩</button>
          <button disabled className="disabled">↪</button>
        </div>
        <div className="toolbar-group">
          <select disabled><option>Font</option></select>
          <select disabled><option>Size</option></select>
        </div>
        <div className="toolbar-group">
          <button disabled className="disabled"><strong>B</strong></button>
          <button disabled className="disabled"><em>I</em></button>
          <button disabled className="disabled"><span style={{ textDecoration: "underline" }}>U</span></button>
          <button disabled className="disabled"><span style={{ textDecoration: "line-through" }}>S</span></button>
        </div>
        <div className="toolbar-group">
          <button disabled className="disabled">A</button>
          <button disabled className="disabled">H</button>
        </div>
        <div className="toolbar-group">
          <button disabled className="disabled">•≡</button>
          <button disabled className="disabled">1.</button>
        </div>
        <div className="toolbar-group">
          <button disabled className="disabled">≡</button>
          <button disabled className="disabled">≡</button>
          <button disabled className="disabled">≡</button>
        </div>
      </div>
    );
  }

  return (
    <div className="editor-toolbar-bar" onMouseDown={(e) => e.preventDefault()}>
      {/* Undo/Redo */}
      <div className="toolbar-group">
        <button
          onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().undo().run(); }}
          disabled={!editor.can().undo()}
          className={!editor.can().undo() ? "disabled" : ""}
          title="Undo (⌘Z)"
        >
          ↩
        </button>
        <button
          onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().redo().run(); }}
          disabled={!editor.can().redo()}
          className={!editor.can().redo() ? "disabled" : ""}
          title="Redo (⌘⇧Z)"
        >
          ↪
        </button>
      </div>

      {/* Font & Size */}
      <div className="toolbar-group">
        <select
          onMouseDown={(e) => e.stopPropagation()}
          onChange={(event) => {
            const value = event.target.value;
            if (value) {
              editor.chain().focus().setFontFamily(value).run();
              event.target.value = "";
            }
          }}
          title="Font Family"
        >
          <option value="">Font</option>
          <option value="Times New Roman">Times New Roman</option>
          <option value="Georgia">Georgia</option>
          <option value="Garamond">Garamond</option>
          <option value="Arial">Arial</option>
          <option value="Helvetica">Helvetica</option>
          <option value="Verdana">Verdana</option>
          <option value="Courier New">Courier New</option>
        </select>
        <select
          onMouseDown={(e) => e.stopPropagation()}
          onChange={(event) => {
            const value = event.target.value;
            if (value) {
              editor.chain().focus().setFontSize(value).run();
              event.target.value = "";
            }
          }}
          title="Font Size"
        >
          <option value="">Size</option>
          <option value="9pt">9</option>
          <option value="10pt">10</option>
          <option value="11pt">11</option>
          <option value="12pt">12</option>
          <option value="14pt">14</option>
          <option value="16pt">16</option>
          <option value="18pt">18</option>
          <option value="24pt">24</option>
          <option value="36pt">36</option>
        </select>
      </div>

      {/* Text Formatting */}
      <div className="toolbar-group">
        <button
          className={editor.isActive("bold") ? "active" : ""}
          onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBold().run(); }}
          title="Bold (⌘B)"
        >
          <strong>B</strong>
        </button>
        <button
          className={editor.isActive("italic") ? "active" : ""}
          onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleItalic().run(); }}
          title="Italic (⌘I)"
        >
          <em>I</em>
        </button>
        <button
          className={editor.isActive("underline") ? "active" : ""}
          onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleUnderline().run(); }}
          title="Underline (⌘U)"
        >
          <span style={{ textDecoration: "underline" }}>U</span>
        </button>
        <button
          className={editor.isActive("strike") ? "active" : ""}
          onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleStrike().run(); }}
          title="Strikethrough"
        >
          <span style={{ textDecoration: "line-through" }}>S</span>
        </button>
      </div>

      {/* Colors */}
      <div className="toolbar-group">
        <div className="color-picker-wrapper">
          <button
            className={showTextColorPicker ? "active" : ""}
            onMouseDown={(e) => {
              e.preventDefault();
              setShowTextColorPicker(!showTextColorPicker);
              setShowHighlightPicker(false);
            }}
            title="Text Color"
          >
            <span style={{ borderBottom: "2px solid currentColor" }}>A</span>
          </button>
          {showTextColorPicker && (
            <div className="color-picker-dropdown">
              {textColors.map((color) => (
                <button
                  key={color.value}
                  className="color-swatch"
                  style={{ backgroundColor: color.value }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    editor.chain().focus().setColor(color.value).run();
                    setShowTextColorPicker(false);
                  }}
                  title={color.name}
                />
              ))}
            </div>
          )}
        </div>
        <div className="color-picker-wrapper">
          <button
            className={showHighlightPicker ? "active" : ""}
            onMouseDown={(e) => {
              e.preventDefault();
              setShowHighlightPicker(!showHighlightPicker);
              setShowTextColorPicker(false);
            }}
            title="Highlight Color"
          >
            <span style={{ backgroundColor: "#fef08a", padding: "0 2px" }}>H</span>
          </button>
          {showHighlightPicker && (
            <div className="color-picker-dropdown">
              {highlightColors.map((color) => (
                <button
                  key={color.value || "none"}
                  className="color-swatch"
                  style={{ backgroundColor: color.value || "#ffffff", border: color.value ? "none" : "1px dashed #d1d5db" }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    if (color.value) {
                      editor.chain().focus().toggleHighlight({ color: color.value }).run();
                    } else {
                      editor.chain().focus().unsetHighlight().run();
                    }
                    setShowHighlightPicker(false);
                  }}
                  title={color.name}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Lists */}
      <div className="toolbar-group">
        <button
          className={editor.isActive("bulletList") ? "active" : ""}
          onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBulletList().run(); }}
          title="Bullet List"
        >
          •≡
        </button>
        <button
          className={editor.isActive("orderedList") ? "active" : ""}
          onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleOrderedList().run(); }}
          title="Numbered List"
        >
          1.
        </button>
        <button
          onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().liftListItem("listItem").run(); }}
          disabled={!editor.can().liftListItem("listItem")}
          className={!editor.can().liftListItem("listItem") ? "disabled" : ""}
          title="Decrease Indent"
        >
          ⇤
        </button>
        <button
          onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().sinkListItem("listItem").run(); }}
          disabled={!editor.can().sinkListItem("listItem")}
          className={!editor.can().sinkListItem("listItem") ? "disabled" : ""}
          title="Increase Indent"
        >
          ⇥
        </button>
      </div>

      {/* Alignment */}
      <div className="toolbar-group">
        <button
          className={editor.isActive({ textAlign: "left" }) ? "active" : ""}
          onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().setTextAlign("left").run(); }}
          title="Align Left"
        >
          ≡
        </button>
        <button
          className={editor.isActive({ textAlign: "center" }) ? "active" : ""}
          onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().setTextAlign("center").run(); }}
          title="Align Center"
        >
          ≡
        </button>
        <button
          className={editor.isActive({ textAlign: "right" }) ? "active" : ""}
          onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().setTextAlign("right").run(); }}
          title="Align Right"
        >
          ≡
        </button>
      </div>

      {/* Line Spacing */}
      <div className="toolbar-group">
        <select
          onMouseDown={(e) => e.stopPropagation()}
          onChange={(event) => {
            const value = event.target.value;
            if (value) {
              editor.chain().focus().setLineHeight(value).run();
              event.target.value = "";
            }
          }}
          title="Line Spacing"
        >
          <option value="">↕</option>
          <option value="1">1.0</option>
          <option value="1.15">1.15</option>
          <option value="1.5">1.5</option>
          <option value="2">2.0</option>
        </select>
      </div>

      {/* Insert */}
      <div className="toolbar-group">
        <button
          className={editor.isActive("link") ? "active" : ""}
          onMouseDown={(e) => { e.preventDefault(); setLink(); }}
          title="Insert Link"
        >
          🔗
        </button>
        <button
          onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().setHorizontalRule().run(); }}
          title="Insert Horizontal Rule"
        >
          ―
        </button>
        <button
          onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().unsetAllMarks().clearNodes().run(); }}
          title="Clear Formatting"
        >
          ⌫
        </button>
      </div>
    </div>
  );
}

export default EditorClient;
