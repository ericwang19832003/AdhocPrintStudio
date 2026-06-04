"use client";

import { useState } from "react";
import { X, FileText, ChevronLeft, ChevronRight } from "lucide-react";

export type MergeRow = Record<string, string>;

type MergePreviewProps = {
  rows: MergeRow[];
  columns: string[];
  placeholderMap: Record<string, string>; // [Placeholder] → column name
  letterHtml: string; // the raw letter body HTML (with [Placeholder] tokens)
  outputFormat: "pdf" | "afp" | string;
  onFormatChange: (fmt: string) => void;
  onGenerate: () => void;
  onClose: () => void;
};

// placeholderMap keys are full "[Placeholder]" strings (with brackets)
function mergeLetter(
  html: string,
  row: MergeRow,
  placeholderMap: Record<string, string>
): string {
  let merged = html;
  for (const [ph, col] of Object.entries(placeholderMap)) {
    if (col && row[col] !== undefined) {
      // ph is already "[Placeholder]" so split on it directly
      merged = merged.split(ph).join(row[col]);
    }
  }
  return merged;
}

export function MergePreview({
  rows,
  columns,
  placeholderMap,
  letterHtml,
  outputFormat,
  onFormatChange,
  onGenerate,
  onClose,
}: MergePreviewProps) {
  const [selectedRow, setSelectedRow] = useState(0);

  const currentRow = rows[selectedRow] ?? {};
  const mergedHtml = mergeLetter(letterHtml, currentRow, placeholderMap);

  // Try to get a display name from the row using common name-related column mappings
  const nameCol =
    placeholderMap["[Name]"] ??
    placeholderMap["[FirstName]"] ??
    placeholderMap["[First Name]"] ??
    placeholderMap["[FIRST_NAME]"] ??
    columns[0] ??
    "";
  const recipientName = currentRow[nameCol] || `Row ${selectedRow + 1}`;

  return (
    <div className="merge-preview-overlay" role="dialog" aria-modal="true" aria-label="Merge preview">
      {/* Header */}
      <div className="merge-preview-header">
        <div className="merge-preview-title">
          <FileText size={16} />
          <span>Merge Preview</span>
          <span className="merge-preview-count">{rows.length} recipients</span>
        </div>
        <div className="merge-preview-header-actions">
          {/* Format toggle */}
          <div className="merge-format-toggle">
            {(["pdf", "afp"] as const).map((fmt) => (
              <button
                key={fmt}
                type="button"
                className={`merge-format-btn${outputFormat === fmt ? " active" : ""}`}
                onClick={() => onFormatChange(fmt)}
              >
                {fmt.toUpperCase()}
              </button>
            ))}
          </div>
          <button type="button" className="btn-accent" onClick={onGenerate}>
            Generate {rows.length} {rows.length === 1 ? "letter" : "letters"}
          </button>
          <button
            type="button"
            className="merge-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Body: recipient list + preview */}
      <div className="merge-preview-body">
        {/* Left: recipient list */}
        <div className="merge-recipient-list">
          <p className="merge-recipient-label">Recipients</p>
          <div className="merge-recipient-items">
            {rows.map((row, i) => {
              const name = row[nameCol] || `Row ${i + 1}`;
              return (
                <button
                  key={i}
                  type="button"
                  className={`merge-recipient-item${selectedRow === i ? " active" : ""}`}
                  onClick={() => setSelectedRow(i)}
                >
                  <span className="merge-recipient-num">{i + 1}</span>
                  <span className="merge-recipient-name">{name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: merged letter preview */}
        <div className="merge-letter-preview">
          <div className="merge-letter-nav">
            <button
              type="button"
              className="merge-nav-btn"
              disabled={selectedRow === 0}
              onClick={() => setSelectedRow((r) => Math.max(0, r - 1))}
              aria-label="Previous"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="merge-nav-label">{recipientName}</span>
            <button
              type="button"
              className="merge-nav-btn"
              disabled={selectedRow === rows.length - 1}
              onClick={() => setSelectedRow((r) => Math.min(rows.length - 1, r + 1))}
              aria-label="Next"
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <div
            className="merge-letter-body"
            dangerouslySetInnerHTML={{ __html: mergedHtml }}
          />
        </div>
      </div>
    </div>
  );
}
