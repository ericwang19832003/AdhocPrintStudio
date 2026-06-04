"use client";

import { useState, useMemo } from "react";
import { Search, FileText } from "lucide-react";

export type TemplateItem = {
  id: string;
  label: string;
  content?: string;
  category?: string;
};

type TemplateLibraryProps = {
  items: TemplateItem[];
  onApply: (item: TemplateItem) => void;
};

const ALL_CAT = "All";

export function TemplateLibrary({ items, onApply }: TemplateLibraryProps) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>(ALL_CAT);

  const allCategories = useMemo(() => {
    const cats = new Set<string>();
    items.forEach((item) => { if (item.category) cats.add(item.category); });
    return [ALL_CAT, ...Array.from(cats).sort()];
  }, [items]);

  const filtered = useMemo(() => {
    let result = items;
    if (activeCategory !== ALL_CAT) {
      result = result.filter((item) => item.category === activeCategory);
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter((item) => item.label.toLowerCase().includes(q));
    }
    return result;
  }, [items, activeCategory, query]);

  return (
    <div className="template-library">
      {/* Search */}
      <div className="lib-search-row">
        <Search size={14} className="lib-search-icon" />
        <input
          type="search"
          aria-label="Search templates"
          className="lib-search-input"
          placeholder="Search templates…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {/* Category filter tabs */}
      {allCategories.length > 1 && (
        <div className="lib-tabs">
          {allCategories.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`lib-tab${activeCategory === cat ? " active" : ""}`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Card grid */}
      {filtered.length === 0 ? (
        <p className="lib-empty">No templates found.</p>
      ) : (
        <div className="template-grid">
          {filtered.map((item) => (
            <button
              key={item.id}
              type="button"
              className="template-card"
              onClick={() => onApply(item)}
              title={`Apply: ${item.label}`}
            >
              <div className="template-card-preview">
                <FileText size={28} strokeWidth={1.2} />
              </div>
              <div className="template-card-footer">
                <span className="template-card-label">{item.label}</span>
                {item.category && (
                  <span className="template-card-cat">{item.category}</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
