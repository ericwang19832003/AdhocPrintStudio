"use client";
import * as React from "react";

export interface PaginationProps {
  totalItems: number;
  pageSize: number;
  page: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function Pagination({ totalItems, pageSize, page, onPageChange, className }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const start = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(totalItems, page * pageSize);

  return (
    <div className={`psd-pagination ${className ?? ""}`} role="navigation" aria-label="Pagination">
      <span>
        Showing {start}–{end} of {totalItems}
      </span>
      <button
        type="button"
        className="psd-pagination-btn"
        disabled={page <= 1}
        onClick={() => onPageChange(Math.max(1, page - 1))}
      >
        Previous
      </button>
      <button
        type="button"
        className="psd-pagination-btn"
        disabled={page >= totalPages}
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
      >
        Next
      </button>
    </div>
  );
}
