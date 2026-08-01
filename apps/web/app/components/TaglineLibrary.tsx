"use client";

import { useMemo, useRef } from "react";

export interface TaglineItem {
  id: string;
  label: string;
  content?: string;
}

interface TaglineLibraryProps {
  items: TaglineItem[];
  query: string;
  sortOrder: "recent" | "a-z" | "favorites";
  onSortChange: (order: "recent" | "a-z" | "favorites") => void;
  recentlyUsed: string[];
  favorites: string[];
  hoverTaglineId: string | null;
  onHoverChange: (id: string | null) => void;
  onToggleFavorite: (id: string, e: React.MouseEvent) => void;
  onSelect: (item: TaglineItem) => void;
  onDragStart: (event: React.DragEvent, item: TaglineItem) => void;
  onDragEnd: () => void;
}

export function TaglineLibrary({
  items,
  query,
  sortOrder,
  onSortChange,
  recentlyUsed,
  favorites,
  hoverTaglineId,
  onHoverChange,
  onToggleFavorite,
  onSelect,
  onDragStart,
  onDragEnd,
}: TaglineLibraryProps) {
  const listRef = useRef<HTMLDivElement | null>(null);

  const term = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (term) {
      return items.filter(
        (item) =>
          item.label.toLowerCase().includes(term) ||
          (item.content ?? "").toLowerCase().includes(term)
      );
    }
    const sorted = [...items];
    if (sortOrder === "a-z") {
      sorted.sort((a, b) => a.label.localeCompare(b.label));
    } else if (sortOrder === "favorites") {
      sorted.sort((a, b) => {
        const aFav = favorites.includes(a.id) ? 0 : 1;
        const bFav = favorites.includes(b.id) ? 0 : 1;
        return aFav - bFav || a.label.localeCompare(b.label);
      });
    } else {
      sorted.sort((a, b) => {
        const ai = recentlyUsed.indexOf(a.id);
        const bi = recentlyUsed.indexOf(b.id);
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi) || a.label.localeCompare(b.label);
      });
    }
    return sorted;
  }, [items, term, sortOrder, favorites, recentlyUsed]);

  const recentItems = useMemo(
    () =>
      recentlyUsed
        .map((id) => items.find((t) => t.id === id))
        .filter(Boolean) as TaglineItem[],
    [recentlyUsed, items]
  );

  const activePreview = hoverTaglineId
    ? items.find((t) => t.id === hoverTaglineId)
    : null;

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.stopPropagation();

    const list = listRef.current;
    if (!list) return;

    const target = event.target as Node;
    const isInsideList = list.contains(target);

    if (isInsideList) {
      const { scrollTop, scrollHeight, clientHeight } = list;
      const atTop = scrollTop <= 0 && event.deltaY < 0;
      const atBottom = scrollTop + clientHeight >= scrollHeight && event.deltaY > 0;

      if (atTop || atBottom) {
        event.preventDefault();
      }
    } else {
      event.preventDefault();
      list.scrollTop += event.deltaY;
    }
  };

  return (
    <div className="library-panel-enhanced">
      {recentItems.length > 0 && !term && (
        <div className="library-section">
          <div className="library-section-header">
            <span className="library-section-title">Recently Used</span>
          </div>
          <div className="library-recent-chips">
            {recentItems.map((item) => (
              <div
                key={item.id}
                className="library-chip"
                draggable
                onDragStart={(e) => onDragStart(e, item)}
                onDragEnd={onDragEnd}
                onClick={() => onSelect(item)}
                title={item.content ?? item.label}
              >
                {item.label}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="library-section">
        <div className="library-section-header">
          <span className="library-section-title">{term ? "Results" : "All Taglines"}</span>
          {!term && (
            <select
              className="library-sort-select"
              value={sortOrder}
              onChange={(e) => onSortChange(e.target.value as "recent" | "a-z" | "favorites")}
            >
              <option value="recent">Recent</option>
              <option value="a-z">A-Z</option>
              <option value="favorites">Favorites</option>
            </select>
          )}
        </div>

        <div className="tagline-two-column" onWheel={handleWheel}>
          <div className="tagline-list" ref={listRef}>
            {filtered.map((item) => (
              <div
                key={item.id}
                className={`tagline-list-item${favorites.includes(item.id) ? " favorited" : ""}`}
                draggable
                onDragStart={(e) => onDragStart(e, item)}
                onDragEnd={onDragEnd}
                onClick={() => onSelect(item)}
                onMouseEnter={() => onHoverChange(item.id)}
                onMouseLeave={() => onHoverChange(null)}
                onFocus={() => onHoverChange(item.id)}
                onBlur={() => onHoverChange(null)}
                tabIndex={0}
              >
                <span className="drag-handle-icon">⋮⋮</span>
                <span className="library-item-label">{item.label}</span>
                <button
                  type="button"
                  className={`library-favorite-btn${favorites.includes(item.id) ? " active" : ""}`}
                  onClick={(e) => onToggleFavorite(item.id, e)}
                  title={favorites.includes(item.id) ? "Remove from favorites" : "Add to favorites"}
                >
                  {favorites.includes(item.id) ? "★" : "☆"}
                </button>
              </div>
            ))}
          </div>

          <div className="tagline-preview-panel">
            {activePreview ? (
              <>
                <div className="tagline-preview-title">{activePreview.label}</div>
                <p>{activePreview.content ?? activePreview.label}</p>
              </>
            ) : (
              <p className="hint">Hover a tagline to preview.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
