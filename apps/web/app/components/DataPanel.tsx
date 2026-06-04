"use client";

import { useRef, useState } from "react";
import { Upload, CheckCircle2, AlertTriangle } from "lucide-react";

export type PlaceholderMapping = Record<string, string>; // placeholder → column name (empty = unmapped)

type DataPanelProps = {
  spreadsheetName: string | null;
  columns: string[];
  rows: Record<string, string>[];
  placeholders: string[]; // detected in letter, format: "[FirstName]"
  placeholderMap: PlaceholderMapping;
  onPlaceholderMapChange: (map: PlaceholderMapping) => void;
  onUploadFile: (file: File) => void;
  // TLE / mailing fields (4 slots used by the TLE engine)
  mailingMap: Record<string, string>;
  onMailingMapChange: (map: Record<string, string>) => void;
};

const TLE_FIELDS: { key: string; label: string }[] = [
  { key: "mailing_name", label: "Recipient Name" },
  { key: "mailing_addr1", label: "Address Line 1" },
  { key: "mailing_addr2", label: "Address Line 2" },
  { key: "mailing_addr3", label: "City / State / ZIP" },
];

export function DataPanel({
  spreadsheetName,
  columns,
  rows,
  placeholders,
  placeholderMap,
  onPlaceholderMapChange,
  onUploadFile,
  mailingMap,
  onMailingMapChange,
}: DataPanelProps) {
  const [activeSection, setActiveSection] = useState<"placeholders" | "tle" | "preview">(
    "placeholders"
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const allMapped =
    placeholders.length > 0 && placeholders.every((p) => placeholderMap[p]);
  const mappedCount = placeholders.filter((p) => placeholderMap[p]).length;

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
                  ? "TLE Fields"
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

          {/* TLE field mapping */}
          {activeSection === "tle" && (
            <div className="data-section">
              <p className="data-section-hint">
                Map CSV columns to mailing address fields used by the TLE engine.
              </p>
              <div className="mapping-table">
                {TLE_FIELDS.map(({ key, label }) => (
                  <div key={key} className="mapping-row">
                    <span className="mapping-placeholder">{label}</span>
                    <select
                      aria-label={`TLE field: ${label}`}
                      className="mapping-select"
                      value={mailingMap[key] ?? ""}
                      onChange={(e) =>
                        onMailingMapChange({ ...mailingMap, [key]: e.target.value })
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
