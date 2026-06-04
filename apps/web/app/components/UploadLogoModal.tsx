"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, X, CheckCircle } from "lucide-react";

type UploadLogoModalProps = {
  onUpload: (name: string, dataUrl: string) => void;
  onClose: () => void;
};

export function UploadLogoModal({ onUpload, onClose }: UploadLogoModalProps) {
  const [displayName, setDisplayName] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function processFile(file: File) {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setPreview(dataUrl);
      if (!displayName) {
        setDisplayName(file.name.replace(/\.[^.]+$/, ""));
      }
    };
    reader.readAsDataURL(file);
  }

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [displayName]
  );

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }

  function handleSubmit() {
    if (!preview || !displayName.trim()) return;
    onUpload(displayName.trim(), preview);
    setUploaded(true);
    setTimeout(onClose, 1200);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <h2 className="modal-title">Upload Logo</h2>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body">
          {uploaded ? (
            <div className="upload-success">
              <CheckCircle size={40} className="upload-success-icon" />
              <span className="upload-badge">UPLOADED</span>
              <p>Logo added to your library.</p>
            </div>
          ) : (
            <>
              {/* Drop zone */}
              <div
                className={`upload-drop-zone${dragging ? " dragging" : ""}${preview ? " has-preview" : ""}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
              >
                {preview ? (
                  <img
                    src={preview}
                    alt="Logo preview"
                    className="upload-preview-img"
                  />
                ) : (
                  <>
                    <Upload size={28} strokeWidth={1.4} />
                    <span className="upload-drop-label">
                      Drop an image here
                    </span>
                    <span className="upload-drop-sub">
                      PNG, SVG, JPG — or click to browse
                    </span>
                  </>
                )}
              </div>
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={handleInputChange}
              />

              {/* Display name */}
              <div className="modal-field">
                <label
                  className="modal-field-label"
                  htmlFor="logo-display-name"
                >
                  Display name
                </label>
                <input
                  id="logo-display-name"
                  type="text"
                  className="modal-field-input"
                  placeholder="e.g. Company Logo"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>

              {/* Actions */}
              <div className="modal-actions">
                <button type="button" className="btn-ghost-sm" onClick={onClose}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-accent"
                  disabled={!preview || !displayName.trim()}
                  onClick={handleSubmit}
                >
                  Add to library
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
