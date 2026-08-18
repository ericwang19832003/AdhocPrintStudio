"use client";

import { useRef, useState } from "react";
import { Upload, CheckCircle2, AlertTriangle, Sparkles, Loader2 } from "lucide-react";
import type { MailingFields } from "@/lib/mailing";

export type PlaceholderMapping = Record<string, string>; // placeholder → column name (empty = unmapped)

type AiSuggestion = {
  placeholder: string;
  column: string;
  confidence: "high" | "low";
};

type DataPanelProps = {
  spreadsheetName: string | null;
  columns: string[];
  rows: Record<string, string>[];
  placeholders: string[]; // detected in letter, format: "[FirstName]"
  placeholderMap: PlaceholderMapping;
  onPlaceholderMapChange: (map: PlaceholderMapping) => void;
  onUploadFile: (file: File) => void;
  // Semantic mailing-address fields (composed into mailing lines/templates)
  mailingFields: MailingFields;
  onMailingFieldsChange: (fields: MailingFields) => void;
  spreadsheetNotPersisted?: boolean;
  // AI auto-map (all optional — omitted entirely when AI is disabled)
  onAiAutomap?: () => void;
  aiMapLoading?: boolean;
  aiSuggestions?: AiSuggestion[];
  onApplySuggestion?: (placeholder: string, column: string) => void;
  onApplyAllAiSuggestions?: () => void;
};

// The mailing-address form: each entry is one dropdown mapped to a data
// column. Grouping and captions communicate the split/combined cases.
const MAILING_FORM: Array<{
  field: keyof MailingFields;
  label: string;
  hint?: string;
}> = [
  { field: "first", label: "Name (or first name)" },
  { field: "last", label: "Last name", hint: "Only if first and last names are separate columns" },
  { field: "street", label: "Street address" },
  { field: "apt", label: "Apt / Suite", hint: "Optional — line is skipped when empty" },
  { field: "city", label: "City", hint: "If city, state and ZIP are combined in one column, map just City" },
  { field: "state", label: "State" },
  { field: "zip", label: "ZIP code" },
];

export function DataPanel({
  spreadsheetName,
  columns,
  rows,
  placeholders,
  placeholderMap,
  onPlaceholderMapChange,
  onUploadFile,
  mailingFields,
  onMailingFieldsChange,
  spreadsheetNotPersisted,
  onAiAutomap,
  aiMapLoading,
  aiSuggestions,
  onApplySuggestion,
  onApplyAllAiSuggestions,
}: DataPanelProps) {
  const [activeSection, setActiveSection] = useState<"placeholders" | "tle" | "preview">(
    "placeholders"
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const allMapped =
    placeholders.length > 0 && placeholders.every((p) => placeholderMap[p]);
  const mappedCount = placeholders.filter((p) => placeholderMap[p]).length;
  const hasUnmapped = placeholders.length > mappedCount;
  const pendingAiSuggestions = aiSuggestions ?? [];
  const highConfidenceAiCount = pendingAiSuggestions.filter(
    (s) => s.confidence === "high"
  ).length;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onUploadFile(file);
    e.target.value = "";
  };

  return (
    <div className="data-panel">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.xlsx,.xml,.json"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

      {/* Upload area */}
      {!spreadsheetName ? (
        <button
          type="button"
          className="data-upload-zone"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload size={24} strokeWidth={1.4} />
          <span className="data-upload-label">Upload data file</span>
          <span className="data-upload-sub">CSV, XLSX, XML, or JSON</span>
        </button>
      ) : (
        <div className="data-file-header">
          <div className="data-file-info">
            <span className="data-file-name">{spreadsheetName}</span>
            <span className="data-file-meta">
              {rows.length} rows · {columns.length} columns
            </span>
          </div>
          <button
            type="button"
            className="data-change-btn"
            onClick={() => fileInputRef.current?.click()}
          >
            Change
          </button>
        </div>
      )}

      {spreadsheetNotPersisted && (
        <p className="data-warn-small">
          Spreadsheet is too large to auto-save — re-upload after refresh.
        </p>
      )}

      {spreadsheetName && (
        <>
          {/* Section tabs */}
          <div className="data-section-tabs">
            {(["placeholders", "tle", "preview"] as const).map((s) => (
              <button
                key={s}
                type="button"
                className={`data-section-tab${activeSection === s ? " active" : ""}`}
                onClick={() => setActiveSection(s)}
              >
                {s === "placeholders"
                  ? "Placeholders"
                  : s === "tle"
                  ? "Mailing address"
                  : "Preview"}
              </button>
            ))}
          </div>

          {/* Placeholder mapping */}
          {activeSection === "placeholders" && (
            <div className="data-section">
              <div className="data-readiness-badge">
                {allMapped ? (
                  <>
                    <CheckCircle2 size={13} /> All {placeholders.length} mapped
                  </>
                ) : (
                  <>
                    <AlertTriangle size={13} /> {mappedCount}/{placeholders.length} mapped
                  </>
                )}
              </div>
              {onAiAutomap && hasUnmapped && (
                <button
                  type="button"
                  className="ai-automap-btn"
                  onClick={onAiAutomap}
                  disabled={aiMapLoading}
                >
                  {aiMapLoading ? (
                    <Loader2 size={13} className="ai-automap-spinner" />
                  ) : (
                    <Sparkles size={13} />
                  )}
                  {aiMapLoading ? "Mapping with AI…" : "Auto-map with AI"}
                </button>
              )}
              {pendingAiSuggestions.length > 0 && (
                <div className="ai-suggestions">
                  <div className="ai-suggestions-header">
                    <span className="ai-suggestions-title">
                      <Sparkles size={11} /> AI suggestions
                    </span>
                    {onApplyAllAiSuggestions && highConfidenceAiCount > 1 && (
                      <button
                        type="button"
                        className="ai-suggestion-apply"
                        onClick={onApplyAllAiSuggestions}
                      >
                        Apply all ({highConfidenceAiCount})
                      </button>
                    )}
                  </div>
                  {pendingAiSuggestions.map((s) => (
                    <div key={s.placeholder} className="ai-suggestion-row">
                      <span className="mapping-placeholder">{s.placeholder}</span>
                      <span className="ai-suggestion-arrow">→</span>
                      <span className="ai-suggestion-column">{s.column}</span>
                      {s.confidence === "low" && (
                        <span className="ai-suggestion-badge">low confidence</span>
                      )}
                      <button
                        type="button"
                        className="ai-suggestion-apply"
                        aria-label={`Apply ${s.placeholder} to ${s.column}`}
                        onClick={() => onApplySuggestion?.(s.placeholder, s.column)}
                      >
                        Apply
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {placeholders.length === 0 ? (
                <p className="lib-empty">No placeholders detected in the letter.</p>
              ) : (
                <div className="mapping-table">
                  {placeholders.map((ph) => (
                    <div key={ph} className="mapping-row">
                      <span className="mapping-placeholder">{ph}</span>
                      <select
                        aria-label={`Map placeholder ${ph}`}
                        className="mapping-select"
                        value={placeholderMap[ph] ?? ""}
                        onChange={(e) =>
                          onPlaceholderMapChange({ ...placeholderMap, [ph]: e.target.value })
                        }
                      >
                        <option value="">-- select column --</option>
                        {columns.map((col) => (
                          <option key={col} value={col}>
                            {col}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Mailing address mapping */}
          {activeSection === "tle" && (
            <div className="data-section">
              <p className="data-section-hint">
                Tell us which columns hold each part of the mailing address —
                the envelope lines are composed automatically.
              </p>
              <div className="mapping-table">
                {MAILING_FORM.map(({ field, label, hint }) => (
                  <div key={field} className="mapping-row mailing-form-row">
                    <span className="mapping-placeholder" title={hint}>{label}</span>
                    <div className="mailing-form-control">
                      <select
                        aria-label={`Mailing field: ${label}`}
                        className="mapping-select"
                        value={mailingFields[field]}
                        onChange={(e) =>
                          onMailingFieldsChange({ ...mailingFields, [field]: e.target.value })
                        }
                      >
                        <option value="">— not in my data —</option>
                        {columns.map((col) => (
                          <option key={col} value={col}>
                            {col}
                          </option>
                        ))}
                      </select>
                      {hint && <span className="mailing-form-hint">{hint}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Data preview */}
          {activeSection === "preview" && (
            <div className="data-section data-preview-section">
              {rows.length === 0 ? (
                <p className="lib-empty">No rows to preview.</p>
              ) : (
                rows.slice(0, 5).map((row, i) => (
                  <div key={i} className="data-preview-row">
                    <span className="data-preview-num">{i + 1}</span>
                    <div className="data-preview-fields">
                      {columns.slice(0, 4).map((col) => (
                        <span key={col} className="data-preview-field">
                          <span className="data-preview-col">{col}:</span>{" "}
                          {row[col] ?? "—"}
                        </span>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
