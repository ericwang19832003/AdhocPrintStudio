"use client";

import { useState } from "react";
import { X, Trash2, Eye, Image, MessageSquare, MapPin, type LucideIcon } from "lucide-react";

export type LibraryItemRow = {
  id: string;
  label: string;
  isCustom: boolean;
  preview?: string; // image URL for logos, text snippet for verbiage/returns
};

export type ManageSection = "logos" | "verbiage" | "returns";

type ManageLibraryProps = {
  logos: LibraryItemRow[];
  verbiage: LibraryItemRow[];
  returns: LibraryItemRow[];
  onDelete: (section: ManageSection, id: string) => void;
  onClose: () => void;
};

const SECTION_CONFIG: Record<ManageSection, { label: string; Icon: LucideIcon }> = {
  logos:    { label: "Logos",            Icon: Image },
  verbiage: { label: "Snippets",         Icon: MessageSquare },
  returns:  { label: "Return Addresses", Icon: MapPin },
};

export function ManageLibrary({ logos, verbiage, returns, onDelete, onClose }: ManageLibraryProps) {
  const [activeSection, setActiveSection] = useState<ManageSection>("logos");

  const sectionData: Record<ManageSection, LibraryItemRow[]> = { logos, verbiage, returns };
  const items = sectionData[activeSection];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog manage-library-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <h2 className="modal-title">Manage Library</h2>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Body: sidebar nav + content */}
        <div className="manage-library-body">
          {/* Left sidebar */}
          <div className="manage-library-sidebar">
            {(Object.entries(SECTION_CONFIG) as [ManageSection, { label: string; Icon: LucideIcon }][]).map(
              ([section, { label, Icon }]) => (
                <button
                  key={section}
                  type="button"
                  className={`manage-section-btn${activeSection === section ? " active" : ""}`}
                  onClick={() => setActiveSection(section)}
                >
                  <Icon size={16} />
                  <span>{label}</span>
                  <span className="manage-section-count">{sectionData[section].length}</span>
                </button>
              )
            )}
          </div>

          {/* Right: asset table */}
          <div className="manage-library-content">
            {items.length === 0 ? (
              <p className="lib-empty">No items in this section yet.</p>
            ) : (
              <div className="manage-asset-table">
                <div className="manage-asset-header">
                  <span>Name</span>
                  <span>Type</span>
                  <span>Actions</span>
                </div>
                {items.map((item) => (
                  <div key={item.id} className="manage-asset-row">
                    {/* Preview + label */}
                    <div className="manage-asset-info">
                      {item.preview && activeSection === "logos" ? (
                        <img src={item.preview} alt={item.label} className="manage-logo-thumb" />
                      ) : (
                        <div className="manage-asset-icon">
                          {activeSection === "logos" ? (
                            <Image size={14} />
                          ) : activeSection === "verbiage" ? (
                            <MessageSquare size={14} />
                          ) : (
                            <MapPin size={14} />
                          )}
                        </div>
                      )}
                      <span className="manage-asset-label" title={item.label}>
                        {item.label}
                      </span>
                    </div>

                    {/* Badge */}
                    <span className={`manage-badge${item.isCustom ? " custom" : " system"}`}>
                      {item.isCustom ? "CUSTOM" : "SYSTEM"}
                    </span>

                    {/* Actions */}
                    <div className="manage-asset-actions">
                      {item.isCustom ? (
                        <button
                          type="button"
                          className="manage-delete-btn"
                          aria-label={`Delete ${item.label}`}
                          onClick={() => onDelete(activeSection, item.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="manage-preview-btn"
                          aria-label={`Preview ${item.label}`}
                          disabled
                          title="System items cannot be deleted"
                        >
                          <Eye size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
