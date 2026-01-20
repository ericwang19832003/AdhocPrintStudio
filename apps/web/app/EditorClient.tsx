"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { Extension, Node as TiptapNode } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import TextStyle from "@tiptap/extension-text-style";
import FontFamily from "@tiptap/extension-font-family";

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
        ({ chain }) =>
          chain().setMark("textStyle", { fontSize: size }).run(),
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
        ({ chain }) =>
          chain().setNode("paragraph", { lineHeight: value }).run(),
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
      StarterKit,
      Underline,
      TextStyle,
      FontFamily,
      FontSize,
      LineHeight,
      VerbiageBlock,
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

  const toolbar = useMemo(() => {
    if (!editor) return null;
    return (
      <div className="body-toolbar">
        <div className="toolbar-group">
          <select
            value=""
            onChange={(event) => editor.chain().focus().setFontFamily(event.target.value).run()}
          >
            <option value="" disabled>
              Font
            </option>
            <option value="Times New Roman">Times New Roman</option>
            <option value="Georgia">Georgia</option>
            <option value="Garamond">Garamond</option>
            <option value="Arial">Arial</option>
            <option value="Helvetica">Helvetica</option>
          </select>
          <select
            value=""
            onChange={(event) => editor.chain().focus().setFontSize(event.target.value).run()}
          >
            <option value="" disabled>
              Size
            </option>
            <option value="10pt">10 pt</option>
            <option value="11pt">11 pt</option>
            <option value="12pt">12 pt</option>
            <option value="13pt">13 pt</option>
            <option value="14pt">14 pt</option>
            <option value="16pt">16 pt</option>
            <option value="18pt">18 pt</option>
            <option value="20pt">20 pt</option>
            <option value="24pt">24 pt</option>
          </select>
          <select
            value=""
            onChange={(event) => editor.chain().focus().setLineHeight(event.target.value).run()}
          >
            <option value="" disabled>
              Line spacing
            </option>
            <option value="1">1.0</option>
            <option value="1.15">1.15</option>
            <option value="1.3">1.3</option>
            <option value="1.5">1.5</option>
            <option value="2">2.0</option>
          </select>
        </div>
        <div className="toolbar-group">
          <button className="ghost" onClick={() => editor.chain().focus().toggleBold().run()}>
            Bold
          </button>
          <button className="ghost" onClick={() => editor.chain().focus().toggleItalic().run()}>
            Italic
          </button>
          <button className="ghost" onClick={() => editor.chain().focus().toggleUnderline().run()}>
            Underline
          </button>
        </div>
        <div className="toolbar-group">
          <button className="ghost" onClick={() => editor.chain().focus().setTextAlign("left").run()}>
            Left
          </button>
          <button className="ghost" onClick={() => editor.chain().focus().setTextAlign("center").run()}>
            Center
          </button>
          <button className="ghost" onClick={() => editor.chain().focus().setTextAlign("right").run()}>
            Right
          </button>
        </div>
      </div>
    );
  }, [editor]);

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
