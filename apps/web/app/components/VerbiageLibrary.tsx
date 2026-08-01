"use client";

import { useState, useMemo } from "react";
import { Search } from "lucide-react";

export type VerbiageItem = {
  id: string;
  label: string;
  content: string;
  tags?: string[];
};

type VerbiageLibraryProps = {
  items: VerbiageItem[];
  onInsert: (item: VerbiageItem) => void;
};

const ALL_TAG = "All";

export function VerbiageLibrary({ items, onInsert }: VerbiageLibraryProps) {
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState<string>(ALL_TAG);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    items.forEach((item) => item.tags?.forEach((t) => tags.add(t)));
    return [ALL_TAG, ...Array.from(tags).sort()];
  }, [items]);

  const filtered = useMemo(() => {
    let result = items;
    if (activeTag !== ALL_TAG) {
      result = result.filter((item) => item.tags?.includes(activeTag));
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter(
        (item) =>
          item.label.toLowerCase().includes(q) ||
          item.content.toLowerCase().includes(q)
      );
    }
    return result;
  }, [items, activeTag, query]);

  return (
    <div className="verbiage-library">
      {/* Search */}
      <div className="lib-search-row">
        <Search size={14} className="lib-search-icon" />
        <input
          type="search"
          aria-label="Search verbiage"
          className="lib-search-input"
          placeholder="Search verbiage…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {/* Tag filter chips */}
      {allTags.length > 1 && (
        <div className="verbiage-tags">
          {allTags.map((tag) => (
            <button
              key={tag}
              type="button"
              className={`verbiage-tag-chip${activeTag === tag ? " active" : ""}`}
              onClick={() => setActiveTag(tag)}
            >
              {tag !== ALL_TAG ? `#${tag}` : tag}
            </button>
          ))}
        </div>
      )}

      {/* Dense list */}
      <div className="verbiage-list-new">
        {filtered.length === 0 ? (
          <p className="lib-empty">No verbiage found.</p>
        ) : (
          filtered.map((item) => (
            <button
              key={item.id}
              type="button"
              className="verbiage-row"
              onClick={() => onInsert(item)}
              title="Click to insert"
            >
              <div className="verbiage-row-header">
                <span className="verbiage-row-label">{item.label}</span>
                {item.tags && item.tags.length > 0 && (
                  <div className="verbiage-row-tags">
                    {item.tags.slice(0, 2).map((t) => (
                      <span key={t} className="verbiage-tag-badge">#{t}</span>
                    ))}
                  </div>
                )}
              </div>
              <p className="verbiage-row-preview">
                {item.content.slice(0, 80)}
                {item.content.length > 80 ? "…" : ""}
              </p>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
