"use client";

import { useState, useRef } from "react";
import { X, Upload, AlertTriangle, Info } from "lucide-react";

type ImportWordModalProps = {
  onImport: (file: File) => void;
  onClose: () => void;
};

export function ImportWordModal({ onImport, onClose }: ImportWordModalProps) {
  const [dragging, setDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function processFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".docx")) {
      setError("Only .docx files are supported.");
      setSelectedFile(null);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("File is too large (max 10 MB).");
      setSelectedFile(null);
      return;
    }
    setError(null);
    setSelectedFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }

  function handleImport() {
    if (!selectedFile) return;
    onImport(selectedFile);
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <h2 className="modal-title">Import Word Document</h2>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {/* Drop zone */}
          <div
            className={`upload-drop-zone${dragging ? " dragging" : ""}${selectedFile ? " has-preview" : ""}`}
            role="button"
            tabIndex={0}
            aria-label="Import Word document — drop a .docx file or press Enter to browse"
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); inputRef.current?.click(); } }}
          >
            {selectedFile ? (
              <div className="import-file-selected">
                <Upload size={20} />
                <span className="import-file-name">{selectedFile.name}</span>
                <span className="import-file-size">{(selectedFile.size / 1024).toFixed(0)} KB</span>
              </div>
            ) : (
              <>
                <Upload size={28} strokeWidth={1.4} />
                <span className="upload-drop-label">Drop a .docx file here</span>
                <span className="upload-drop-sub">or click to browse</span>
              </>
            )}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="sr-only"
            onChange={handleInputChange}
          />

          {/* Error */}
          {error && <p className="upload-size-error">{error}</p>}

          {/* Table lost warning */}
          <div className="import-warning">
            <AlertTriangle size={13} className="import-warning-icon" />
            <span>Tables will not be imported. Complex formatting may be simplified.</span>
          </div>

          {/* Placeholder tips */}
          <div className="import-tip">
            <Info size={13} className="import-tip-icon" />
            <span>
              Use <code>[PlaceholderName]</code> in your Word doc to create data merge fields.
              Example: <code>[FirstName]</code>, <code>[AccountBalance]</code>.
            </span>
          </div>

          {/* Actions */}
          <div className="modal-actions">
            <button type="button" className="btn-ghost-sm" onClick={onClose}>Cancel</button>
            <button
              type="button"
              className="btn-accent"
              disabled={!selectedFile}
              onClick={handleImport}
            >
              Import document
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
