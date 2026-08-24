"use client";

import { useRef } from "react";
import { Upload, CheckCircle2, AlertTriangle, Sparkles, Loader2, Circle } from "lucide-react";
import { mailingTemplates, resolveMailingLine, type MailingFields } from "@/lib/mailing";
import { buildReadinessItems, type DataSection } from "@/lib/ux";

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
  onConfigureAi?: () => void;
  activeSection: DataSection;
  onSectionChange: (section: DataSection) => void;
};

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
  onConfigureAi,
  activeSection,
  onSectionChange,
}: DataPanelProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const allMapped =
    placeholders.length > 0 && placeholders.every((p) => placeholderMap[p]);
  const mappedCount = placeholders.filter((p) => placeholderMap[p]).length;
  const hasUnmapped = placeholders.length > mappedCount;
  const pendingAiSuggestions = aiSuggestions ?? [];
  const highConfidenceAiCount = pendingAiSuggestions.filter(
    (s) => s.confidence === "high"
  ).length;
  const templates = mailingTemplates(mailingFields);
  const mailingComplete = Boolean(
    templates.mailing_name && templates.mailing_addr1 && templates.mailing_addr3
  );
  const readinessItems = buildReadinessItems({
    recipientCount: rows.length,
    mappedFieldCount: mappedCount,
    totalFieldCount: placeholders.length,
    mailingComplete,
  });
  const ready = readinessItems.every((item) => item.complete);

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
          <div className={`readiness-summary${ready ? " ready" : ""}`}>
            <div className="readiness-summary-title">
              {ready ? "Ready to create" : "Finish setup"}
            </div>
            {readinessItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`readiness-item${item.complete ? " complete" : ""}`}
                onClick={() => onSectionChange(item.target)}
              >
                {item.complete ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                <span>{item.label}</span>
              </button>
            ))}
          </div>

          {/* Section tabs */}
          <div className="data-section-tabs">
            {(["placeholders", "tle", "preview"] as const).map((s) => (
              <button
                key={s}
                type="button"
                className={`data-section-tab${activeSection === s ? " active" : ""}`}
                onClick={() => onSectionChange(s)}
              >
                {s === "placeholders"
                  ? "Fill-in fields"
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
              {!onAiAutomap && onConfigureAi && hasUnmapped && (
                <button type="button" className="ai-automap-btn" onClick={onConfigureAi}>
                  <Sparkles size={13} /> Improve mapping with AI
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
                <p className="lib-empty">No fill-in fields in the letter yet. Use “Insert field” in the toolbar to add spots that fill from your data.</p>
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
                        <option value="">Choose column…</option>
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
          {activeSection === "tle" && (() => {
            const fieldSelect = (field: keyof MailingFields, label: string) => (
              <label className="addr-field">
                <span className="addr-field-label">{label}</span>
                <select
                  aria-label={`Mailing field: ${label}`}
                  value={mailingFields[field]}
                  onChange={(e) =>
                    onMailingFieldsChange({ ...mailingFields, [field]: e.target.value })
                  }
                >
                  <option value="">—</option>
                  {columns.map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </select>
              </label>
            );
            const previewRow = rows[0];
            const previewLines = previewRow
              ? [
                  templates.mailing_name,
                  templates.mailing_addr1,
                  templates.mailing_addr2,
                  templates.mailing_addr3,
                ]
                  .map((template) => resolveMailingLine(template, previewRow))
                  .filter(Boolean)
              : [];
            return (
              <div className="data-section addr-form">
                <p className="data-section-hint">
                  Match each part of the address to a column — the envelope is
                  composed for you.
                </p>

                <div className="addr-group">
                  <div className="addr-row addr-row-name">
                    {fieldSelect("first", "First or full name")}
                    {fieldSelect("last", "Last name")}
                  </div>
                  <p className="addr-hint">
                    One column with the whole name? Map it as “First or full name”.
                  </p>
                </div>

                <div className="addr-group">
                  <div className="addr-row addr-row-street">
                    {fieldSelect("street", "Street address")}
                    {fieldSelect("apt", "Apt / Suite")}
                  </div>
                </div>

                <div className="addr-group">
                  <div className="addr-row addr-row-city">
                    {fieldSelect("city", "City")}
                    {fieldSelect("state", "State")}
                    {fieldSelect("zip", "ZIP")}
                  </div>
                  <p className="addr-hint">City, state and ZIP in one column? Map just City.</p>
                </div>

                <div className="addr-envelope">
                  <span className="addr-envelope-title">Envelope preview</span>
                  <div className="addr-envelope-card">
                    {previewLines.length > 0 ? (
                      previewLines.map((line, i) => <div key={i}>{line}</div>)
                    ) : (
                      <span className="addr-envelope-empty">
                        Map columns above to see the first recipient&apos;s address.
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Data preview — every column, scrollable table */}
          {activeSection === "preview" && (
            <div className="data-section data-preview-section">
              {rows.length === 0 ? (
                <p className="lib-empty">No rows to preview.</p>
              ) : (
                <>
                  <div className="data-preview-table-wrap">
                    <table className="data-preview-table">
                      <thead>
                        <tr>
                          <th aria-label="Row number">#</th>
                          {columns.map((col) => (
                            <th key={col} title={col}>{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.slice(0, 5).map((row, i) => (
                          <tr key={i}>
                            <td className="data-preview-num">{i + 1}</td>
                            {columns.map((col) => (
                              <td key={col} title={row[col] ?? ""}>
                                {row[col] ?? "—"}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {rows.length > 5 && (
                    <p className="data-preview-note">
                      Showing the first 5 of {rows.length} rows · scroll sideways
                      for more columns
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
