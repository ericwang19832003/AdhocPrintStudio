"use client";

import { useMemo, useState } from "react";
import { Shuffle, AlertTriangle } from "lucide-react";

export type VaryItem = {
  id: string;
  label: string;
  imageUrl?: string;
};

/** Compact mode indicator + entry point, shown at the top of an asset flyout. */
export function VaryModeBar({
  assetLabel,
  mode,
  column,
  onVary,
  onTurnOff,
}: {
  assetLabel: string;
  mode: "static" | "dynamic";
  column: string;
  onVary: () => void;
  onTurnOff: () => void;
}) {
  return (
    <div className="vary-mode-bar">
      {mode === "static" ? (
        <>
          <span className="vary-mode-label">Same {assetLabel} for every letter</span>
          <button type="button" className="vary-mode-btn" onClick={onVary}>
            <Shuffle size={13} />
            Vary by data…
          </button>
        </>
      ) : (
        <>
          <span className="vary-mode-label vary-mode-active">
            Varies by <strong>{column}</strong>
          </span>
          <span className="vary-mode-actions">
            <button type="button" className="vary-mode-btn" onClick={onVary}>
              Edit rule
            </button>
            <button type="button" className="vary-mode-btn vary-mode-off" onClick={onTurnOff}>
              Turn off
            </button>
          </span>
        </>
      )}
    </div>
  );
}

export type VaryColumnOption = {
  column: string;
  uniqueCount: number;
  /** Category-like: a small set of values that repeat across recipients. */
  suggested: boolean;
};

type VaryByDataModalProps = {
  /** Lowercase asset name for copy, e.g. "logo", "return address", "tagline". */
  assetLabel: string;
  /** Rule-eligible columns (mailing/name columns are excluded upstream). */
  columnOptions: VaryColumnOption[];
  /** How many columns were hidden because they hold names/mailing address. */
  excludedCount: number;
  getUniqueValues: (column: string) => string[];
  items: VaryItem[];
  /** Auto-match values to item ids (existing fuzzy matcher, bound to this library). */
  suggest: (values: string[]) => Record<string, string>;
  /** Label of the current static selection, used for unmatched values. */
  defaultLabel: string | null;
  initialColumn: string;
  initialMap: Record<string, string>;
  onSave: (column: string, valueMap: Record<string, string>) => void;
  onClose: () => void;
};

const MANY_VALUES = 30;

export function VaryByDataModal({
  assetLabel,
  columnOptions,
  excludedCount,
  getUniqueValues,
  items,
  suggest,
  defaultLabel,
  initialColumn,
  initialMap,
  onSave,
  onClose,
}: VaryByDataModalProps) {
  const [column, setColumn] = useState(initialColumn);
  const [valueMap, setValueMap] = useState<Record<string, string>>(initialMap);

  const values = useMemo(
    () => (column ? getUniqueValues(column) : []),
    // getUniqueValues is stable enough for modal lifetime
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [column]
  );
  const autoMatched = useMemo(
    () => (values.length ? suggest(values) : {}),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [values]
  );

  const pickColumn = (col: string) => {
    setColumn(col);
    if (!col) {
      setValueMap({});
      return;
    }
    const uniques = getUniqueValues(col);
    const suggested = suggest(uniques);
    // Keep the user's saved choices when re-editing the same column.
    setValueMap(col === initialColumn ? { ...suggested, ...initialMap } : suggested);
  };

  const matchedCount = values.filter((v) => valueMap[v]).length;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal vary-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Vary {assetLabel} by data</h3>
          <button className="ghost" onClick={onClose}>Close</button>
        </div>

        <div className="vary-modal-body">
          <label className="vary-field-label" htmlFor="vary-column-select">
            Which column decides the {assetLabel}?
          </label>
          <div className="vary-column-row">
            <select
              id="vary-column-select"
              value={column}
              onChange={(e) => pickColumn(e.target.value)}
            >
              <option value="">Choose a column…</option>
              {columnOptions.some((o) => o.suggested) && (
                <optgroup label="Suggested — a few values that repeat">
                  {columnOptions
                    .filter((o) => o.suggested)
                    .map((o) => (
                      <option key={o.column} value={o.column}>
                        {o.column} ({o.uniqueCount} value{o.uniqueCount !== 1 ? "s" : ""})
                      </option>
                    ))}
                </optgroup>
              )}
              {columnOptions.some((o) => !o.suggested) && (
                <optgroup label="Other columns">
                  {columnOptions
                    .filter((o) => !o.suggested)
                    .map((o) => (
                      <option key={o.column} value={o.column}>
                        {o.column}
                      </option>
                    ))}
                </optgroup>
              )}
            </select>
            {column && (
              <span className="vary-column-hint">
                {values.length} value{values.length !== 1 ? "s" : ""}
                {values.length > 0 && values.length <= 4 ? `: ${values.join(", ")}` : ""}
              </span>
            )}
          </div>

          {excludedCount > 0 && (
            <p className="vary-excluded-note">
              Columns used for the recipient&apos;s name or mailing address are
              not listed — they are different for every letter.
            </p>
          )}

          {column && values.length > MANY_VALUES && (
            <div className="vary-warning">
              <AlertTriangle size={14} />
              This column has {values.length} different values. Rules work best
              with a small set of categories (like Branch or Department).
            </div>
          )}

          {column && values.length > 0 && (
            <>
              <div className="vary-map-header">
                <span>When the value is…</span>
                <span>use this {assetLabel}</span>
              </div>
              <div className="vary-map-table">
                {values.map((value) => {
                  const chosen = valueMap[value] ?? "";
                  const item = items.find((i) => i.id === chosen);
                  return (
                    <div key={value} className="vary-map-row">
                      <span className="vary-map-value" title={value}>{value}</span>
                      <span className="vary-map-arrow">→</span>
                      {item?.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.imageUrl} alt="" className="vary-map-thumb" />
                      )}
                      <select
                        aria-label={`Asset for ${value}`}
                        value={chosen}
                        onChange={(e) =>
                          setValueMap((prev) => {
                            const next = { ...prev };
                            if (e.target.value) next[value] = e.target.value;
                            else delete next[value];
                            return next;
                          })
                        }
                      >
                        <option value="">Use default</option>
                        {items.map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.label}
                            {autoMatched[value] === i.id ? " (auto-matched)" : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
              <p className="vary-default-note">
                Any other value → {defaultLabel ? `“${defaultLabel}”` : `no ${assetLabel}`}
                {" "}(your current selection in the library).
              </p>
            </>
          )}
        </div>

        <div className="vary-modal-footer">
          {column && values.length > 0 && (
            <span className="vary-match-count">
              {matchedCount} of {values.length} matched
            </span>
          )}
          <button className="ghost" onClick={onClose}>Cancel</button>
          <button
            className="primary"
            disabled={!column || values.length === 0}
            onClick={() => onSave(column, valueMap)}
          >
            Save rule
          </button>
        </div>
      </div>
    </div>
  );
}
