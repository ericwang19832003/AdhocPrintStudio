"use client";

import { CheckCircle } from "lucide-react";

export type JourneyStep = {
  label: string;
  done: boolean;
  onClick: () => void;
};

type TopbarProps = {
  letterTitle: string;
  onTitleChange: (t: string) => void;
  savedAgo: string | null;
  onExport: () => void;
  onPreview: () => void;
  onGenerate: () => void;
  generateDisabled?: boolean;
  generating?: boolean;
  onManageLibrary?: () => void;
  onAiSettings?: () => void;
  /** The three-step journey: write letter → add recipients → preview & create. */
  steps?: JourneyStep[];
};

export function Topbar({
  letterTitle,
  onTitleChange,
  savedAgo,
  onExport,
  onPreview,
  onGenerate,
  generateDisabled,
  generating,
  onManageLibrary,
  onAiSettings,
  steps,
}: TopbarProps) {
  return (
    <header className="topbar-v2">
      <div className="topbar-brand">
        <div className="topbar-brand-avatar">A</div>
        <span className="topbar-brand-name">Adhoc Print Studio</span>
      </div>

      {steps && (
        <nav className="journey-strip" aria-label="Letter progress">
          {steps.map((step, i) => (
            <button
              key={step.label}
              type="button"
              className={`journey-step${step.done ? " done" : ""}`}
              onClick={step.onClick}
            >
              <span className="journey-step-num" aria-hidden="true">
                {step.done ? "✓" : i + 1}
              </span>
              {step.label}
            </button>
          ))}
        </nav>
      )}

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
        {onAiSettings && (
          <button type="button" className="btn-ghost-sm" onClick={onAiSettings}>
            AI settings
          </button>
        )}
        {onManageLibrary && (
          <button type="button" className="btn-ghost-sm" onClick={onManageLibrary}>
            Manage library
          </button>
        )}
        <button type="button" className="btn-ghost-sm" onClick={onExport}>Export Word</button>
        <button type="button" className="btn-accent" onClick={onPreview}>Preview</button>
        <button type="button" className="btn-outline-sm" onClick={onGenerate} disabled={generateDisabled || generating}>
          {generating ? (
            <><span className="topbar-spinner" aria-hidden="true" />Generating…</>
          ) : (
            "Generate"
          )}
        </button>
      </div>
    </header>
  );
}
