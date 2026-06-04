"use client";

import { useState } from "react";
import { CheckCircle2, AlertTriangle } from "lucide-react";

export type ReadinessItem = {
  label: string;
  status: "ok" | "warn" | "error";
  detail?: string;
};

type SelectedBlock = {
  label: string;
  type: string;
  x: number;
  y: number;
  align: "left" | "center" | "right";
  content?: string;
} | null;

type InspectorPanelProps = {
  selectedBlock: SelectedBlock;
  onAlignChange: (align: "left" | "center" | "right") => void;
  onXChange: (x: number) => void;
  onYChange: (y: number) => void;
  readiness: ReadinessItem[];
  onOpenMerge: () => void;
};

function ReadinessList({ items }: { items: ReadinessItem[] }) {
  if (items.length === 0) {
    return <p className="inspector-empty">No readiness checks defined.</p>;
  }
  return (
    <div className="readiness-list">
      {items.map((item) => (
        <div key={item.label} className={`readiness-row readiness-${item.status}`}>
          {item.status === "ok" ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
          <span className="readiness-label">{item.label}</span>
          {item.detail && <span className="readiness-detail">{item.detail}</span>}
        </div>
      ))}
    </div>
  );
}

export function InspectorPanel({
  selectedBlock,
  onAlignChange,
  onXChange,
  onYChange,
  readiness,
  onOpenMerge,
}: InspectorPanelProps) {
  const [activeTab, setActiveTab] = useState<"block" | "document" | "merge">("block");

  return (
    <aside className="inspector-panel">
      <div className="inspector-tabs">
        {(["block", "document", "merge"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            className={`inspector-tab${activeTab === tab ? " active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <div className="inspector-body">
        {activeTab === "block" && (
          <div className="inspector-section">
            {selectedBlock ? (
              <>
                <div className="inspector-block-header">
                  <span className="inspector-type-chip">{selectedBlock.type.toUpperCase()}</span>
                  <span className="inspector-block-label">{selectedBlock.label}</span>
                </div>

                <div className="inspector-field-group">
                  <label className="inspector-label">POSITION</label>
                  <div className="inspector-xy-row">
                    <div className="inspector-xy-field">
                      <span>X</span>
                      <input
                        type="number"
                        aria-label="X position"
                        value={selectedBlock.x}
                        onChange={(e) => onXChange(Number(e.target.value))}
                      />
                    </div>
                    <div className="inspector-xy-field">
                      <span>Y</span>
                      <input
                        type="number"
                        aria-label="Y position"
                        value={selectedBlock.y}
                        onChange={(e) => onYChange(Number(e.target.value))}
                      />
                    </div>
                  </div>
                </div>

                <div className="inspector-field-group">
                  <label className="inspector-label">ALIGNMENT</label>
                  <div className="inspector-align-row">
                    {(["left", "center", "right"] as const).map((a) => (
                      <button
                        key={a}
                        type="button"
                        aria-label={`Align ${a}`}
                        aria-pressed={selectedBlock.align === a}
                        className={`inspector-align-btn${selectedBlock.align === a ? " active" : ""}`}
                        onClick={() => onAlignChange(a)}
                      >
                        {a === "left" ? "Left" : a === "center" ? "Center" : "Right"}
                      </button>
                    ))}
                  </div>
                </div>

                {selectedBlock.content && (
                  <div className="inspector-field-group">
                    <label className="inspector-label">CONTENT</label>
                    <p className="inspector-content-preview">
                      {selectedBlock.content.slice(0, 120)}
                      {selectedBlock.content.length > 120 ? "…" : ""}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <p className="inspector-empty">Select a block on the canvas to see its properties.</p>
            )}
          </div>
        )}

        {activeTab === "document" && (
          <div className="inspector-section">
            <p className="inspector-empty">Document-level settings coming soon.</p>
          </div>
        )}

        {activeTab === "merge" && (
          <div className="inspector-section">
            <label className="inspector-label">MERGE READINESS</label>
            <ReadinessList items={readiness} />
            <button type="button" className="btn-accent readiness-merge-btn" onClick={onOpenMerge}>
              Open merge panel →
            </button>
          </div>
        )}
      </div>

      {activeTab !== "merge" && (
        <div className="inspector-readiness-footer">
          <label className="inspector-label">MERGE READINESS</label>
          <ReadinessList items={readiness} />
        </div>
      )}
    </aside>
  );
}
