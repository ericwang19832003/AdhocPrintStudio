"use client";

import { CheckCircle } from "lucide-react";

type TopbarProps = {
  letterTitle: string;
  onTitleChange: (t: string) => void;
  savedAgo: string | null;
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
      <div className="topbar-brand">
        <div className="topbar-brand-avatar">A</div>
        <span className="topbar-brand-name">Adhoc Print Studio</span>
        <span className="topbar-brand-divider">·</span>
        <span className="topbar-brand-suffix">By PSD</span>
      </div>

      <div className="topbar-center">
        <input
          type="text"
          aria-label="Letter title"
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

      <div className="topbar-actions-v2">
        <button type="button" className="btn-ghost-sm" onClick={onExport}>Export</button>
        <button type="button" className="btn-outline-sm" onClick={onPreview}>Preview</button>
        <button type="button" className="btn-accent" onClick={onGenerate} disabled={generateDisabled}>
          Generate
        </button>
      </div>
    </header>
  );
}
