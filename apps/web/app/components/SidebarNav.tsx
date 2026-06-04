"use client";

import {
  ImageIcon,
  MapPin,
  MessageSquare,
  Tag,
  FileText,
  Upload,
  Database,
  type LucideIcon,
} from "lucide-react";

export type SidebarTab = "Logo" | "Return" | "Verbiage" | "Tagline" | "Templates" | "Import" | "Data";

const NAV_ITEMS: { id: SidebarTab; label: string; Icon: LucideIcon }[] = [
  { id: "Logo",      label: "Logo",      Icon: ImageIcon },
  { id: "Return",    label: "Return",    Icon: MapPin },
  { id: "Verbiage",  label: "Verbiage",  Icon: MessageSquare },
  { id: "Tagline",   label: "Tagline",   Icon: Tag },
  { id: "Templates", label: "Templates", Icon: FileText },
  { id: "Import",    label: "Import",    Icon: Upload },
  { id: "Data",      label: "Data",      Icon: Database },
];

type SidebarNavProps = {
  active: SidebarTab | null;
  onSelect: (tab: SidebarTab) => void;
};

export function SidebarNav({ active, onSelect }: SidebarNavProps) {
  return (
    <nav className="sidebar-nav">
      {NAV_ITEMS.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          className={`sidebar-nav-btn${active === id ? " active" : ""}`}
          onClick={() => onSelect(id)}
          title={label}
          aria-label={label}
          aria-pressed={active === id}
        >
          <Icon size={20} strokeWidth={1.8} />
          <span className="sidebar-nav-label">{label}</span>
        </button>
      ))}
    </nav>
  );
}
