"use client";

import { useState, useMemo } from "react";
import { Search, Star } from "lucide-react";

export type LibraryLogo = {
  id: string;
  label: string;
  url: string;
  custom?: boolean;
};

type LogoLibraryProps = {
  logos: LibraryLogo[];
  selectedId: string | null;
  onSelect: (logo: LibraryLogo) => void;
  onUpload: () => void;
  /** Search text from the flyout header (the panel's single search box). */
  query?: string;
};

type Tab = "all" | "favorites" | "custom";

export function LogoLibrary({ logos, selectedId, onSelect, onUpload, query = "" }: LogoLibraryProps) {
  const [tab, setTab] = useState<Tab>("all");
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [recentIds, setRecentIds] = useState<string[]>([]);

  const filtered = useMemo(() => {
    let items = logos;
    if (tab === "favorites") items = items.filter((l) => favorites.has(l.id));
    if (tab === "custom")    items = items.filter((l) => l.custom);
    if (query.trim()) {
      const q = query.toLowerCase();
      items = items.filter((l) => l.label.toLowerCase().includes(q));
    }
    return items;
  }, [logos, tab, query, favorites]);

  const recentLogos = useMemo(
    () => recentIds.map((id) => logos.find((l) => l.id === id)).filter(Boolean) as LibraryLogo[],
    [recentIds, logos]
  );

  function handleSelect(logo: LibraryLogo) {
    onSelect(logo);
    setRecentIds((prev) => [logo.id, ...prev.filter((id) => id !== logo.id)].slice(0, 5));
  }

  function toggleFavorite(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <div className="logo-library">
      {/* Tabs */}
      <div className="lib-tabs">
        {(["all", "favorites", "custom"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            className={`lib-tab${tab === t ? " active" : ""}`}
            onClick={() => setTab(t)}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Recently used strip */}
      {tab === "all" && recentLogos.length > 0 && (
        <div className="lib-section">
          <p className="lib-section-label">Recently used</p>
          <div className="logo-grid">
            {recentLogos.map((logo) => (
              <button
                key={logo.id}
                type="button"
                className={`logo-card${selectedId === logo.id ? " selected" : ""}`}
                onClick={() => handleSelect(logo)}
                title={logo.label}
              >
                <img src={logo.url} alt={logo.label} className="logo-card-img" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main grid */}
      <div className="lib-section">
        {tab === "all" && recentLogos.length > 0 && (
          <p className="lib-section-label">All logos</p>
        )}
        {filtered.length === 0 ? (
          <p className="lib-empty">No logos found.</p>
        ) : (
          <div className="logo-grid">
            {filtered.map((logo) => (
              <button
                key={logo.id}
                type="button"
                className={`logo-card${selectedId === logo.id ? " selected" : ""}`}
                onClick={() => handleSelect(logo)}
                title={logo.label}
                aria-label={logo.label}
                aria-pressed={selectedId === logo.id}
              >
                <img src={logo.url} alt={logo.label} className="logo-card-img" />
                <button
                  type="button"
                  aria-label={favorites.has(logo.id) ? "Unfavorite" : "Favorite"}
                  className={`logo-star${favorites.has(logo.id) ? " active" : ""}`}
                  onClick={(e) => toggleFavorite(e, logo.id)}
                >
                  <Star size={12} fill={favorites.has(logo.id) ? "currentColor" : "none"} />
                </button>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Upload button */}
      <button type="button" className="lib-upload-btn" onClick={onUpload}>
        + Upload logo
      </button>
    </div>
  );
}
