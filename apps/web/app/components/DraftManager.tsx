"use client";

import { Copy, FileText, X } from "lucide-react";
import type { DraftSummary } from "@/lib/ux";

type DraftManagerProps = {
  drafts: DraftSummary[];
  currentDraftId: string;
  onOpen: (id: string) => void;
  onDuplicate: (id: string) => void;
  onClose: () => void;
};

export function DraftManager({
  drafts,
  currentDraftId,
  onOpen,
  onDuplicate,
  onClose,
}: DraftManagerProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog draft-dialog" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title"><FileText size={16} /> Recent letters</h2>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="draft-list">
          {drafts.length === 0 ? (
            <p className="lib-empty">No saved letters yet.</p>
          ) : drafts.map((draft) => (
            <div key={draft.id} className={`draft-row${draft.id === currentDraftId ? " current" : ""}`}>
              <button type="button" className="draft-open" onClick={() => onOpen(draft.id)}>
                <span className="draft-title">{draft.title}</span>
                <span className="draft-meta">
                  {draft.id === currentDraftId ? "Open now · " : ""}
                  {new Date(draft.updatedAt).toLocaleString()}
                </span>
              </button>
              <button
                type="button"
                className="draft-copy"
                onClick={() => onDuplicate(draft.id)}
                aria-label={`Duplicate ${draft.title}`}
                title="Duplicate"
              >
                <Copy size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
