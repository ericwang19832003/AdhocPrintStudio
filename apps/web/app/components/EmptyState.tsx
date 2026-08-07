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
        Choose how to begin. You can add a logo, return address, and tagline
        from the left sidebar at any time.
      </p>
      <div className="empty-state-cards">
        <button type="button" className="empty-card" onClick={onBlank}>
          <FileText size={24} strokeWidth={1.4} />
          <span className="empty-card-title">Blank letter</span>
          <span className="empty-card-sub">Start fresh</span>
        </button>
        <button type="button" className="empty-card" onClick={onTemplate}>
          <Layers size={24} strokeWidth={1.4} />
          <span className="empty-card-title">From template</span>
          <span className="empty-card-sub">{templateCount} available</span>
        </button>
        <button type="button" className="empty-card" onClick={onImportWord}>
          <Upload size={24} strokeWidth={1.4} />
          <span className="empty-card-title">Import Word</span>
          <span className="empty-card-sub">.docx files</span>
        </button>
      </div>
    </div>
  );
}
