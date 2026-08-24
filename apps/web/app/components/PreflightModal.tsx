"use client";

import { X, ClipboardCheck, AlertCircle, AlertTriangle } from "lucide-react";

export type PreflightIssue = {
  row: number;
  field: string;
  severity: "error" | "warning";
  message: string;
  source?: string;
};

type PreflightModalProps = {
  issues: PreflightIssue[];
  truncated: boolean;
  totalIssues: number;
  rowCount: number;
  /** Rows actually checked — differs from rowCount only when capped (>5000). */
  checkedRowCount?: number;
  onCancel: () => void;
  onConfirm: () => void;
  onReviewIssue: (issue: PreflightIssue) => void;
};

export function PreflightModal({
  issues,
  truncated,
  totalIssues,
  rowCount,
  checkedRowCount,
  onCancel,
  onConfirm,
  onReviewIssue,
}: PreflightModalProps) {
  const errorCount = issues.filter((issue) => issue.severity === "error").length;
  const warningCount = issues.length - errorCount;
  const rowSummary =
    checkedRowCount !== undefined && checkedRowCount < rowCount
      ? `in first ${checkedRowCount.toLocaleString()} of ${rowCount.toLocaleString()} rows`
      : `in ${rowCount.toLocaleString()} row${rowCount !== 1 ? "s" : ""}`;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div
        className="modal-dialog preflight-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <h2 className="modal-title">
            <ClipboardCheck
              size={16}
              style={{ display: "inline", marginRight: 6, verticalAlign: "middle" }}
            />
            Data Preflight Report
          </h2>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onCancel}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body">
          <p className="preflight-summary">
            {errorCount} error{errorCount !== 1 ? "s" : ""}, {warningCount}{" "}
            warning{warningCount !== 1 ? "s" : ""} {rowSummary}
            {truncated ? ` — showing first ${issues.length} of ${totalIssues}` : ""}
          </p>

          <ul className="preflight-issue-list">
            {issues.map((issue, index) => (
              <li key={index} className="preflight-issue">
                {issue.severity === "error" ? (
                  <AlertCircle
                    size={14}
                    className="preflight-icon-error"
                    aria-label="Error"
                  />
                ) : (
                  <AlertTriangle
                    size={14}
                    className="preflight-icon-warning"
                    aria-label="Warning"
                  />
                )}
                <span className="preflight-issue-row">Row {issue.row}</span>
                {issue.field && (
                  <span className="preflight-issue-field">{issue.field}</span>
                )}
                <span className="preflight-issue-message">{issue.message}</span>
                {issue.source === "ai" && (
                  <span className="preflight-ai-badge">AI</span>
                )}
                <button
                  type="button"
                  className="preflight-review-btn"
                  onClick={() => onReviewIssue(issue)}
                >
                  Review
                </button>
              </li>
            ))}
          </ul>

          {/* Actions */}
          <div className="modal-actions">
            <button type="button" className="btn-ghost-sm" onClick={onCancel}>
              Cancel
            </button>
            <button type="button" className="btn-outline-sm" onClick={onConfirm}>
              {errorCount > 0 ? "Generate anyway" : "Generate"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
