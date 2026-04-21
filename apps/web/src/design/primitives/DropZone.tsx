"use client";
import * as React from "react";

type ErrorReason = "type" | "size";

export interface DropZoneProps {
  accept?: string;
  maxSize?: number;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  onError?: (reason: ErrorReason, file: File) => void;
  className?: string;
  children?: React.ReactNode;
}

export function DropZone({
  accept,
  maxSize,
  multiple = false,
  onFiles,
  onError,
  className,
  children,
}: DropZoneProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = React.useState(false);

  function validate(files: File[]): File[] {
    const valid: File[] = [];
    for (const f of files) {
      if (accept) {
        const types = accept.split(",").map((t) => t.trim());
        const matches = types.some((t) => {
          if (t.startsWith(".")) return f.name.toLowerCase().endsWith(t.toLowerCase());
          if (t.endsWith("/*")) return f.type.startsWith(t.slice(0, -1));
          return f.type === t;
        });
        if (!matches) { onError?.("type", f); continue; }
      }
      if (maxSize && f.size > maxSize) { onError?.("size", f); continue; }
      valid.push(f);
    }
    return valid;
  }

  return (
    <div
      role="button"
      tabIndex={0}
      className={`psd-dropzone ${dragging ? "is-dragging" : ""} ${className ?? ""}`}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragEnter={(e) => { e.preventDefault(); setDragging(true); }}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const files = Array.from(e.dataTransfer.files);
        const valid = validate(files);
        if (valid.length) onFiles(multiple ? valid : valid.slice(0, 1));
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        style={{ display: "none" }}
        onChange={(e) => {
          const files = Array.from(e.currentTarget.files ?? []);
          const valid = validate(files);
          if (valid.length) onFiles(multiple ? valid : valid.slice(0, 1));
          e.currentTarget.value = "";
        }}
      />
      {children}
    </div>
  );
}
