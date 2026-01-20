"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from "react";
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

export type EditorClientHandle = {
  insertText: (text: string) => void;
  insertLibraryItem: (
    item: { id?: string; label?: string; type?: string; content?: string },
    options?: { standardFormat?: boolean }
  ) => void;
  focusAtPoint: (x: number, y: number) => void;
  focusEnd: () => void;
};

type EditorClientProps = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  onDropItem?: (item: DroppedItem, coords: { x: number; y: number }) => void;
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
  ({ value, onChange, placeholder, onDropItem }, ref) => {
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
        const chain = editor.chain().focus();
        if (options?.standardFormat) {
          chain.setFontFamily("Times New Roman").setFontSize("12pt").setLineHeight("1.5").setTextAlign("left");
        }
        if (item.type === "verbiage") {
          chain
            .insertContent({
              type: "verbiageBlock",
              attrs: {
                verbiageId: item.id ?? null,
                label: item.label ?? null,
                sourceType: "verbiage",
              },
              content: lines.length > 0 ? lines : [{ type: "paragraph" }],
            })
            .run();
          return;
        }
        chain.insertContent(lines.length > 0 ? lines : [{ type: "paragraph" }]).run();
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
    }),
    [editor]
  );

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

  const toolbar = useMemo(() => {
    if (!editor) return null;
    return (
      <div className="body-toolbar">
        {/* Undo/Redo */}
        <div className="toolbar-group">
          <button
            className={editor.can().undo() ? "" : "disabled"}
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            title="Undo (⌘Z)"
          >
            ↩
          </button>
          <button
            className={editor.can().redo() ? "" : "disabled"}
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            title="Redo (⌘⇧Z)"
          >
            ↪
          </button>
        </div>

        {/* Font & Size */}
        <div className="toolbar-group">
          <select
            onChange={(event) => {
              const value = event.target.value;
              if (value) {
                editor.chain().focus().setFontFamily(value).run();
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
            onChange={(event) => {
              const value = event.target.value;
              if (value) {
                editor.chain().focus().setFontSize(value).run();
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
            onClick={() => editor.chain().focus().toggleBold().run()}
            title="Bold (⌘B)"
          >
            <strong>B</strong>
          </button>
          <button
            className={editor.isActive("italic") ? "active" : ""}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            title="Italic (⌘I)"
          >
            <em>I</em>
          </button>
          <button
            className={editor.isActive("underline") ? "active" : ""}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            title="Underline (⌘U)"
          >
            <span style={{ textDecoration: "underline" }}>U</span>
          </button>
          <button
            className={editor.isActive("strike") ? "active" : ""}
            onClick={() => editor.chain().focus().toggleStrike().run()}
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
              onClick={() => {
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
                    onClick={() => {
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
              onClick={() => {
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
                    onClick={() => {
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
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            title="Bullet List"
          >
            •≡
          </button>
          <button
            className={editor.isActive("orderedList") ? "active" : ""}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            title="Numbered List"
          >
            1.
          </button>
          <button
            onClick={() => editor.chain().focus().liftListItem("listItem").run()}
            disabled={!editor.can().liftListItem("listItem")}
            className={!editor.can().liftListItem("listItem") ? "disabled" : ""}
            title="Decrease Indent"
          >
            ⇤
          </button>
          <button
            onClick={() => editor.chain().focus().sinkListItem("listItem").run()}
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
            onClick={() => editor.chain().focus().setTextAlign("left").run()}
            title="Align Left"
          >
            ≡
          </button>
          <button
            className={editor.isActive({ textAlign: "center" }) ? "active" : ""}
            onClick={() => editor.chain().focus().setTextAlign("center").run()}
            title="Align Center"
          >
            ≡
          </button>
          <button
            className={editor.isActive({ textAlign: "right" }) ? "active" : ""}
            onClick={() => editor.chain().focus().setTextAlign("right").run()}
            title="Align Right"
          >
            ≡
          </button>
        </div>

        {/* Line Spacing */}
        <div className="toolbar-group">
          <select
            onChange={(event) => {
              const value = event.target.value;
              if (value) {
                editor.chain().focus().setLineHeight(value).run();
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
            onClick={setLink}
            title="Insert Link"
          >
            🔗
          </button>
          <button
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            title="Insert Horizontal Rule"
          >
            ―
          </button>
          <button
            onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
            title="Clear Formatting"
          >
            ⌫
          </button>
        </div>
      </div>
    );
  }, [editor, showTextColorPicker, showHighlightPicker, setLink]);

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

        // Set cursor position if we got valid coords, otherwise go to end
        if (posAtCoords?.pos !== undefined) {
          editor.chain().focus().setTextSelection(posAtCoords.pos).run();
        } else {
          editor.chain().focus("end").run();
        }

        // Insert the content
        if (item.type === "verbiage") {
          editor
            .chain()
            .insertContent({
              type: "verbiageBlock",
              attrs: {
                verbiageId: item.id ?? null,
                label: item.label ?? null,
                sourceType: "verbiage",
              },
              content: lines.length > 0 ? lines : [{ type: "paragraph" }],
            })
            .run();
        } else {
          editor.chain().insertContent(lines.length > 0 ? lines : [{ type: "paragraph" }]).run();
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
      {toolbar}
      <EditorContent editor={editor} className="body-editor" />
    </div>
  );
  }
);

EditorClient.displayName = "EditorClient";

export default EditorClient;
