"use client";

import { useEffect, useRef, useState } from "react";
import {
  CheckCircle,
  ChevronDown,
  Clock3,
  Copy,
  FileDown,
  FilePlus2,
  Library,
  Settings,
  type LucideIcon,
} from "lucide-react";
import {
  getCreateActionLabel,
  getMoreActionsLabel,
  getTopbarMenuGroups,
  type TopbarCommandId,
} from "@/lib/ux";

export type JourneyStep = {
  label: string;
  done: boolean;
  onClick: () => void;
};

type TopbarProps = {
  letterTitle: string;
  onTitleChange: (t: string) => void;
  savedAgo: string | null;
  onExport: () => void;
  onPreviewCreate: () => void;
  createDisabled?: boolean;
  creating?: boolean;
  onManageLibrary?: () => void;
  onAiSettings?: () => void;
  onNewDraft?: () => void;
  onOpenDrafts?: () => void;
  onDuplicateDraft?: () => void;
  /** The three-step journey: write letter → add recipients → preview & create. */
  steps?: JourneyStep[];
};

export function Topbar({
  letterTitle,
  onTitleChange,
  savedAgo,
  onExport,
  onPreviewCreate,
  createDisabled,
  creating,
  onManageLibrary,
  onAiSettings,
  onNewDraft,
  onOpenDrafts,
  onDuplicateDraft,
  steps,
}: TopbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const commandActions: Record<TopbarCommandId, (() => void) | undefined> = {
    new: onNewDraft,
    open: onOpenDrafts,
    duplicate: onDuplicateDraft,
    export: onExport,
    library: onManageLibrary,
    settings: onAiSettings,
  };
  const commandIcons: Record<TopbarCommandId, LucideIcon> = {
    new: FilePlus2,
    open: Clock3,
    duplicate: Copy,
    export: FileDown,
    library: Library,
    settings: Settings,
  };
  const menuGroups = getTopbarMenuGroups();

  const closeMenu = (restoreFocus = false) => {
    setMenuOpen(false);
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const openMenu = () => {
    setMenuOpen(true);
    requestAnimationFrame(() => {
      menuRef.current?.querySelector<HTMLButtonElement>("[role='menuitem']")?.focus();
    });
  };

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) closeMenu(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu(true);
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen]);

  const runMenuAction = (action?: () => void) => {
    closeMenu(false);
    action?.();
  };

  const handleMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>("[role='menuitem']")
    );
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    let next = current;
    if (event.key === "ArrowDown") next = (current + 1) % items.length;
    else if (event.key === "ArrowUp") next = (current - 1 + items.length) % items.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = items.length - 1;
    else return;
    event.preventDefault();
    items[next]?.focus();
  };

  return (
    <header className="topbar-v2">
      <div className="topbar-brand">
        <div className="topbar-brand-avatar">A</div>
        <span className="topbar-brand-name">Adhoc Print Studio</span>
      </div>

      {steps && (
        <nav className="journey-strip" aria-label="Letter progress">
          {steps.map((step, i) => (
            <button
              key={step.label}
              type="button"
              className={`journey-step${step.done ? " done" : ""}`}
              onClick={step.onClick}
            >
              <span className="journey-step-num" aria-hidden="true">
                {step.done ? "✓" : i + 1}
              </span>
              {step.label}
            </button>
          ))}
        </nav>
      )}

      <div className="topbar-center">
        <input
          type="text"
          aria-label="Letter title"
          className="topbar-title-input"
          value={letterTitle}
          onChange={(e) => onTitleChange(e.target.value)}
          onFocus={(event) => event.currentTarget.select()}
          placeholder="Untitled letter"
          spellCheck={false}
        />
        {savedAgo !== null && (
          <div className="topbar-save-status">
            <CheckCircle size={14} className="save-check" />
            <span>Saved</span>
            <span className="save-ago">{savedAgo}</span>
          </div>
        )}
      </div>

      <div className="topbar-actions-v2">
        <button
          type="button"
          className="btn-accent"
          onClick={onPreviewCreate}
          disabled={createDisabled || creating}
        >
          {creating && <span className="topbar-spinner" aria-hidden="true" />}
          {getCreateActionLabel(Boolean(creating))}
        </button>
        <div className="topbar-more" ref={menuRef}>
          <button
            ref={triggerRef}
            type="button"
            className="topbar-more-trigger"
            onClick={() => menuOpen ? closeMenu(false) : openMenu()}
            onKeyDown={(event) => {
              if (!menuOpen && (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ")) {
                event.preventDefault();
                openMenu();
              }
            }}
            aria-label="More actions"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            title="More actions"
          >
            <span>{getMoreActionsLabel()}</span>
            <ChevronDown size={15} strokeWidth={2} aria-hidden="true" />
          </button>
          {menuOpen && (
            <div
              className="topbar-more-menu"
              role="menu"
              aria-label="Document actions"
              onKeyDown={handleMenuKeyDown}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) closeMenu(false);
              }}
            >
              {menuGroups.map((group) => (
                <div className="topbar-menu-group" key={group.label}>
                  <div className="topbar-menu-label">{group.label}</div>
                  {group.items.map((item) => {
                    const Icon = commandIcons[item.id];
                    return (
                      <button
                        key={item.id}
                        type="button"
                        role="menuitem"
                        className="topbar-menu-item"
                        onClick={() => runMenuAction(commandActions[item.id])}
                      >
                        <Icon size={16} strokeWidth={1.8} aria-hidden="true" />
                        <span>{item.label}</span>
                        {item.id === "export" && <span className="topbar-menu-meta">.docx</span>}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
