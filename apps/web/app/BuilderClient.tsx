"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { EditorClientHandle } from "./EditorClient";

import { env } from "@/lib/env";

const EditorClient = dynamic(() => import("./EditorClient"), { ssr: false });

type LibraryItem = {
  id: string;
  label: string;
  type: "logo" | "tagline" | "return" | "verbiage" | "full-letter";
  content?: string;
  imageUrl?: string;
  isCustom?: boolean;
};

type PlacedBlock = {
  id: string;
  label: string;
  type: "tagline" | "verbiage" | "full-letter";
  content?: string;
  x: number;
  y: number;
  width: number;
  align: "left" | "center" | "right";
};

type DragState = {
  id: string;
  offsetX: number;
  offsetY: number;
};

type SidebarButtonProps = {
  label: string;
  icon: string;
  isActive: boolean;
  onHover?: () => void;
  onLeave?: () => void;
  onClick?: () => void;
};

type BlockMenuItem = {
  id: string;
  title: string;
  previewText: string;
  previewImage?: string;
};

type BlockMenuProps = {
  items: BlockMenuItem[];
  onInsert: (item: BlockMenuItem) => void;
  onDragStart: (event: React.DragEvent<HTMLDivElement>, item: BlockMenuItem) => void;
  query: string;
};

const SidebarButton = ({
  label,
  icon,
  isActive,
  onHover,
  onLeave,
  onClick,
}: SidebarButtonProps) => (
  <button
    className={`sidebar-button${isActive ? " active" : ""}`}
    onMouseEnter={onHover}
    onMouseLeave={onLeave}
    onClick={onClick}
    type="button"
  >
    {icon ? <span className="tool-icon">{icon}</span> : null}
    <span className="tool-label">{label}</span>
  </button>
);

const FlyoutPanel = ({
  title,
  children,
  isOpen,
  onClose,
  searchPlaceholder,
  searchValue,
  onSearchChange,
  onCreateClick,
  searchRef,
  onSearchKeyDown,
  onWheel,
}: {
  title: string;
  children: React.ReactNode;
  isOpen: boolean;
  onClose: () => void;
  searchPlaceholder: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onCreateClick: () => void;
  searchRef: React.RefObject<HTMLInputElement>;
  onSearchKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onWheel?: (event: React.WheelEvent<HTMLElement>) => void;
}) => (
  <aside className={`flyout-panel${isOpen ? " open" : ""}`} onWheel={onWheel}>
    <div className="flyout-header">
      <div className="flyout-title-row">
        <h3>{title}</h3>
        <button className="ghost" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="flyout-search">
        <span className="search-icon">🔍</span>
        <input
          ref={searchRef}
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          onKeyDown={onSearchKeyDown}
          placeholder={searchPlaceholder}
        />
      </div>
    </div>
    <div className="flyout-body">{children}</div>
    <div className="flyout-footer">
      <p className="flyout-footer-hint">Couldn't find what you need?</p>
      <button className="secondary" onClick={onCreateClick}>
        Add your own
      </button>
    </div>
  </aside>
);

const BlockMenu = ({ items, onInsert, onDragStart, query }: BlockMenuProps) => {
  const [hoveredItem, setHoveredItem] = useState<BlockMenuItem | null>(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const term = query.trim().toLowerCase();
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(term) ||
        item.previewText.toLowerCase().includes(term)
    );
  }, [items, query]);

  return (
    <div className="block-menu">
      <div className="block-menu-panel">
        <div className="block-menu-list">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="block-menu-item"
              draggable
              onDragStart={(event) => onDragStart(event, item)}
              onMouseEnter={() => setHoveredItem(item)}
              onMouseLeave={() => setHoveredItem(null)}
              onClick={() => onInsert(item)}
            >
              <div className="block-menu-header">
                <span className="block-menu-title">{item.title}</span>
                <span className="drag-handle">⋮⋮</span>
              </div>
              <div className="block-menu-preview">
                {item.previewImage ? (
                  <img src={item.previewImage} alt={item.title} />
                ) : (
                  <p>{item.previewText}</p>
                )}
              </div>
              <div className="block-menu-footer">
                <button className="ghost add-button" onClick={() => onInsert(item)}>
                  Add
                </button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <p className="hint">No matches.</p>}
        </div>
        {hoveredItem && (
          <div className="block-menu-preview-panel" role="status" aria-live="polite">
            <div className="block-menu-preview-title">{hoveredItem.title}</div>
            <p>{hoveredItem.previewText}</p>
          </div>
        )}
      </div>
    </div>
  );
};

type UploadLogoModalProps = {
  isOpen: boolean;
  previewUrl: string;
  fileName: string;
  errorMessage: string;
  isUploading: boolean;
  onCancel: () => void;
  onFileSelect: (file: File) => void;
  onUpload: () => void;
};

const UploadLogoModal = ({
  isOpen,
  previewUrl,
  fileName,
  errorMessage,
  isUploading,
  onCancel,
  onFileSelect,
  onUpload,
}: UploadLogoModalProps) => {
  if (!isOpen) return null;
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal upload-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h3>Upload logo</h3>
          <button className="ghost" onClick={onCancel}>
            Close
          </button>
        </div>
        <div
          className="upload-dropzone"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            const file = event.dataTransfer.files?.[0];
            if (file) onFileSelect(file);
          }}
        >
          {previewUrl ? (
            <img src={previewUrl} alt="Logo preview" />
          ) : (
            <div className="upload-placeholder">
              <strong>Drag and drop your logo here</strong>
              <span>or</span>
            </div>
          )}
          <label className="file-input">
            Browse files
            <input
              type="file"
              accept=".png,.jpg,.jpeg,.svg"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onFileSelect(file);
              }}
            />
          </label>
          <p className="hint">Supported formats: PNG, JPG, SVG</p>
          {fileName && <p className="upload-filename">{fileName}</p>}
          {errorMessage && <p className="upload-error">{errorMessage}</p>}
        </div>
        <div className="form-actions">
          <button className="ghost" onClick={onCancel}>
            Cancel
          </button>
          <button className="primary" onClick={onUpload} disabled={!previewUrl || isUploading}>
            {isUploading ? "Uploading..." : "Upload"}
          </button>
        </div>
      </div>
    </div>
  );
};

const GRID_SIZE = 16;
const SNAP_TOLERANCE = 6;
const DEFAULT_BLOCK_HEIGHT = 80;
const PAGE_PADDING = 20;

const logoPlaceholders: LibraryItem[] = [
  {
    id: "logo-1",
    label: "APS Primary",
    type: "logo",
    imageUrl:
      "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='70'><rect width='100%25' height='100%25' rx='14' fill='%23b84f2f'/><text x='50%25' y='55%25' text-anchor='middle' font-family='Arial' font-size='28' fill='white'>APS</text></svg>",
  },
  {
    id: "logo-2",
    label: "APS Monogram",
    type: "logo",
    imageUrl:
      "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='70'><rect width='100%25' height='100%25' rx='14' fill='%231f1c18'/><text x='50%25' y='55%25' text-anchor='middle' font-family='Arial' font-size='28' fill='%23f6f1ea'>A</text></svg>",
  },
  {
    id: "logo-3",
    label: "APS Light",
    type: "logo",
    imageUrl:
      "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='70'><rect width='100%25' height='100%25' rx='14' fill='%23f6f1ea' stroke='%23b84f2f' stroke-width='2'/><text x='50%25' y='55%25' text-anchor='middle' font-family='Arial' font-size='24' fill='%238c2e15'>APS</text></svg>",
  },
  {
    id: "logo-4",
    label: "APS Serif",
    type: "logo",
    imageUrl:
      "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='70'><rect width='100%25' height='100%25' rx='14' fill='%23ffffff' stroke='%23e6dbcf' stroke-width='2'/><text x='50%25' y='55%25' text-anchor='middle' font-family='Georgia' font-size='24' fill='%231f1c18'>APS</text></svg>",
  },
  {
    id: "logo-5",
    label: "APS Outline",
    type: "logo",
    imageUrl:
      "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='70'><rect width='100%25' height='100%25' rx='14' fill='%23ffffff' stroke='%231f1c18' stroke-width='2'/><text x='50%25' y='55%25' text-anchor='middle' font-family='Arial' font-size='22' fill='%231f1c18'>APS</text></svg>",
  },
];

const librarySeed: Record<string, LibraryItem[]> = {
  Logos: [...logoPlaceholders],
  Taglines: [
    {
      id: "tag-1",
      label: "Trusted since 1998",
      type: "tagline",
      content: "Trusted since 1998",
    },
    {
      id: "tag-2",
      label: "Delivering clarity",
      type: "tagline",
      content: "Delivering clarity",
    },
    {
      id: "tag-3",
      label: "Precision print, personal touch",
      type: "tagline",
      content: "Precision print, personal touch",
    },
    {
      id: "tag-4",
      label: "Reliable mail, every time",
      type: "tagline",
      content: "Reliable mail, every time",
    },
    {
      id: "tag-5",
      label: "Made for your message",
      type: "tagline",
      content: "Made for your message",
    },
  ],
  "Return Address": [
    {
      id: "ret-1",
      label: "HQ - San Jose",
      type: "return",
      content: "APS HQ\n250 Market Street\nSan Jose, CA 95113",
    },
    {
      id: "ret-2",
      label: "East Coast Ops",
      type: "return",
      content: "APS East Coast\n44 Hanover Ave\nBoston, MA 02116",
    },
    {
      id: "ret-3",
      label: "Midwest Fulfillment",
      type: "return",
      content: "APS Midwest\n1200 Lakeview Dr\nChicago, IL 60601",
    },
    {
      id: "ret-4",
      label: "Southwest Print Hub",
      type: "return",
      content: "APS Southwest\n815 Copper Road\nPhoenix, AZ 85004",
    },
    {
      id: "ret-5",
      label: "Pacific NW Office",
      type: "return",
      content: "APS Pacific NW\n900 Rainier Blvd\nSeattle, WA 98104",
    },
  ],
  Verbiage: [
    {
      id: "verb-1",
      label: "Privacy notice",
      type: "verbiage",
      content:
        "We value your privacy. Your information is used only for account servicing and will not be shared without consent.",
    },
    {
      id: "verb-2",
      label: "Late payment block",
      type: "verbiage",
      content:
        "Our records show an outstanding balance. Please remit payment within 10 days to avoid service interruption.",
    },
    {
      id: "verb-3",
      label: "Billing assistance",
      type: "verbiage",
      content:
        "Need help with your bill? Call 800-555-0199, Monday through Friday, 8am-6pm, and we will assist you.",
    },
    {
      id: "verb-4",
      label: "Opt-out instructions",
      type: "verbiage",
      content:
        "To opt out of paper delivery, visit your account settings or call customer care at 800-555-0177.",
    },
    {
      id: "verb-5",
      label: "Account update reminder",
      type: "verbiage",
      content:
        "Please review your contact details to ensure your statements are delivered to the correct address.",
    },
  ],
  "Full Letters": [
    {
      id: "full-1",
      label: "Dunning Letter A",
      type: "full-letter",
      content:
        "Hello [Customer Name],\n\nOur records indicate your account has an overdue balance. Please submit payment at your earliest convenience to avoid any disruption.\n\nIf you have already sent payment, please disregard this notice.",
    },
    {
      id: "full-2",
      label: "Welcome Letter",
      type: "full-letter",
      content:
        "Welcome to APS!\n\nWe are pleased to have you with us. This letter confirms your enrollment and provides information about how to manage your account online.",
    },
    {
      id: "full-3",
      label: "Policy Update Notice",
      type: "full-letter",
      content:
        "We are writing to inform you of updates to our service terms. These changes take effect on the first of next month. Please review the enclosed summary for details.",
    },
    {
      id: "full-4",
      label: "Service Confirmation",
      type: "full-letter",
      content:
        "This letter confirms your recent service request. Our team will process your request within 3 business days and notify you once complete.",
    },
    {
      id: "full-5",
      label: "Annual Statement Cover",
      type: "full-letter",
      content:
        "Enclosed is your annual statement. Please review it carefully and contact us if any information appears incorrect.",
    },
  ],
};

const tabs = Object.keys(librarySeed);
const libraryButtons = [
  { label: "LOGO", tab: "Logos", icon: "" },
  { label: "RETURN ADDRESS", tab: "Return Address", icon: "" },
  { label: "VERBIAGE", tab: "Verbiage", icon: "" },
  { label: "TAGLINE", tab: "Taglines", icon: "" },
  { label: "LETTER TEMPLATE", tab: "Full Letters", icon: "" },
] as const;

function createBlock(item: LibraryItem, x: number, y: number): PlacedBlock | null {
  if (
    item.type === "logo" ||
    item.type === "return" ||
    item.type === "verbiage" ||
    item.type === "full-letter"
  ) {
    return null;
  }
  return {
    id: `${item.id}-${Date.now()}`,
    label: item.label,
    type: item.type,
    content: item.content,
    x,
    y,
    width: 320,
    align: "left",
  };
}

export default function BuilderClient() {
  const [activeTab, setActiveTab] = useState(tabs[0]);
  const [library, setLibrary] = useState(librarySeed);
  const [selectedLogo, setSelectedLogo] = useState<LibraryItem | null>(null);
  const [selectedReturn, setSelectedReturn] = useState<LibraryItem | null>(null);
  const [selectedTaglineByPage, setSelectedTaglineByPage] = useState<
    Record<number, LibraryItem | null>
  >({
    0: null,
  });
  const [pages, setPages] = useState(["Page 1"]);
  const [activePage, setActivePage] = useState(0);
  const [blocksByPage, setBlocksByPage] = useState<Record<number, PlacedBlock[]>>({
    0: [],
  });
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [openMenuTab, setOpenMenuTab] = useState<string | null>(null);
  const [flyoutQuery, setFlyoutQuery] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showLogoModal, setShowLogoModal] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [showTaglineModal, setShowTaglineModal] = useState(false);
  const [showVerbiageModal, setShowVerbiageModal] = useState(false);
  const [hoverPreviewId, setHoverPreviewId] = useState<string | null>(null);
  const [selectedVerbiageId, setSelectedVerbiageId] = useState<string | null>(null);
  const [hoverFullLetterId, setHoverFullLetterId] = useState<string | null>(null);
  const [selectedFullLetterId, setSelectedFullLetterId] = useState<string | null>(null);
  const [hoverReturnId, setHoverReturnId] = useState<string | null>(null);
  const [hoverTaglineId, setHoverTaglineId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newImageUrl, setNewImageUrl] = useState("");
  const [newImagePreview, setNewImagePreview] = useState("");
  const [addressName, setAddressName] = useState("");
  const [addressContent, setAddressContent] = useState("");
  const [taglineText, setTaglineText] = useState("");
  const [verbiageTitle, setVerbiageTitle] = useState("");
  const [verbiageText, setVerbiageText] = useState("");
  const [logoUploadPreview, setLogoUploadPreview] = useState("");
  const [logoUploadName, setLogoUploadName] = useState("");
  const [logoUploadError, setLogoUploadError] = useState("");
  const [logoUploadLoading, setLogoUploadLoading] = useState(false);
  const [logoBox, setLogoBox] = useState({ width: 160, height: 70 });
  const [logoResizeState, setLogoResizeState] = useState<{
    corner: "tl" | "tr" | "bl" | "br";
    startX: number;
    startWidth: number;
  } | null>(null);
  const [dragging, setDragging] = useState<DragState | null>(null);
  const [guideX, setGuideX] = useState<number | null>(null);
  const [guideY, setGuideY] = useState<number | null>(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showNewItemForm, setShowNewItemForm] = useState(false);
  const [newItemLabel, setNewItemLabel] = useState("");
  const [newItemContent, setNewItemContent] = useState("");
  const [newItemImageUrl, setNewItemImageUrl] = useState("");
  const [newItemImagePreview, setNewItemImagePreview] = useState("");
  const [bodyContentByPage, setBodyContentByPage] = useState<Record<number, string>>({
    0: "",
  });
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [spreadsheetName, setSpreadsheetName] = useState<string | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [placeholderMap, setPlaceholderMap] = useState<Record<string, string>>({});
  const [insertPlaceholder, setInsertPlaceholder] = useState("");
  const [spreadsheetContent, setSpreadsheetContent] = useState<string>("");
  const [generating, setGenerating] = useState(false);
  const [spreadsheetLoading, setSpreadsheetLoading] = useState(false);
  const [spreadsheetError, setSpreadsheetError] = useState<string | null>(null);
  const [mailingMap, setMailingMap] = useState<Record<string, string>>({
    mailing_name: "",
    mailing_addr1: "",
    mailing_addr2: "",
    mailing_addr3: "",
  });
  const [showPreview, setShowPreview] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);

  const bodyZoneRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<EditorClientHandle | null>(null);
  const blockRefs = useRef(new Map<string, HTMLDivElement>());
  const inlineDraftsRef = useRef(new Map<string, string>());
  const flyoutSearchRef = useRef<HTMLInputElement | null>(null);
  const taglineListRef = useRef<HTMLDivElement | null>(null);
  const logoAspectRef = useRef(160 / 70);
  const activePageRef = useRef(activePage);

  const stripInlineControls = (html: string) => {
    if (!html) return "";
    if (typeof document === "undefined") return html;
    const wrapper = document.createElement("div");
    wrapper.innerHTML = html;
    wrapper.querySelectorAll(".inline-remove").forEach((node) => node.remove());
    return wrapper.innerHTML;
  };

  useEffect(() => {
    activePageRef.current = activePage;
  }, [activePage]);

  const escapeHtml = (value: string) =>
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const insertLibraryText = (item: LibraryItem, options?: { standardFormat?: boolean }) => {
    editorRef.current?.insertLibraryItem(item, options);
  };

  const selectedBlock = blocksByPage[activePage]?.find((block) => block.id === selectedBlockId) ?? null;

  const getBlockHeight = (id: string) =>
    blockRefs.current.get(id)?.offsetHeight ?? DEFAULT_BLOCK_HEIGHT;

  const getBodyZoneSize = () => {
    if (!bodyZoneRef.current) return null;
    const rect = bodyZoneRef.current.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  };

  const snapToGrid = (value: number) => Math.round(value / GRID_SIZE) * GRID_SIZE;

  const getOverlap = (
    x: number,
    y: number,
    width: number,
    height: number,
    ignoreId: string
  ) => {
    return (blocksByPage[activePage] ?? []).some((block) => {
      if (block.id === ignoreId) return false;
      const blockHeight = getBlockHeight(block.id);
      return !(
        x + width <= block.x ||
        x >= block.x + block.width ||
        y + height <= block.y ||
        y >= block.y + blockHeight
      );
    });
  };

  const clampPosition = (block: PlacedBlock, nextX: number, nextY: number) => {
    const size = getBodyZoneSize();
    if (!size) return { x: nextX, y: nextY };
    const height = getBlockHeight(block.id);
    const clampedX = Math.min(Math.max(nextX, 0), size.width - block.width);
    const clampedY = Math.min(Math.max(nextY, 0), size.height - height);
    if (getOverlap(clampedX, clampedY, block.width, height, block.id)) {
      return { x: block.x, y: block.y };
    }
    return { x: clampedX, y: clampedY };
  };

  const isEditableTarget = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    return target.isContentEditable || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!selectedBlockId || isEditableTarget(event.target)) return;
      if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
      event.preventDefault();
      const block = blocksByPage[activePage]?.find((item) => item.id === selectedBlockId);
      if (!block) return;
      const step = event.shiftKey ? GRID_SIZE * 4 : GRID_SIZE;
      const delta = {
        x: event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0,
        y: event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0,
      };
      const nextX = snapToGrid(block.x + delta.x);
      const nextY = snapToGrid(block.y + delta.y);
      const { x, y } = clampPosition(block, nextX, nextY);
      updateBlock(block.id, { x, y });
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedBlockId, activePage, blocksByPage]);

  useEffect(() => {
    if (!dragging) return;

    const handleMove = (event: MouseEvent) => {
      if (!bodyZoneRef.current) return;
      const rect = bodyZoneRef.current.getBoundingClientRect();
      const current = blocksByPage[activePage]?.find((block) => block.id === dragging.id);
      if (!current) return;

      const height = getBlockHeight(current.id);
      const rawX = event.clientX - rect.left - dragging.offsetX;
      const rawY = event.clientY - rect.top - dragging.offsetY;

      let nextX = snapToGrid(rawX);
      let nextY = snapToGrid(rawY);
      let nextGuideX: number | null = null;
      let nextGuideY: number | null = null;

      for (const block of blocksByPage[activePage] ?? []) {
        if (block.id === current.id) continue;
        const blockHeight = getBlockHeight(block.id);
        const candidatesX = [block.x, block.x + block.width, block.x - current.width];
        const candidatesY = [block.y, block.y + blockHeight, block.y - height];
        candidatesX.forEach((candidate) => {
          if (Math.abs(rawX - candidate) <= SNAP_TOLERANCE) {
            nextX = candidate;
            nextGuideX = candidate;
          }
        });
        candidatesY.forEach((candidate) => {
          if (Math.abs(rawY - candidate) <= SNAP_TOLERANCE) {
            nextY = candidate;
            nextGuideY = candidate;
          }
        });
      }

      nextX = Math.min(Math.max(nextX, 0), rect.width - current.width);
      nextY = Math.min(Math.max(nextY, 0), rect.height - height);

      const hasOverlap = getOverlap(nextX, nextY, current.width, height, current.id);
      if (hasOverlap) {
        setGuideX(null);
        setGuideY(null);
        return;
      }

      setGuideX(nextGuideX);
      setGuideY(nextGuideY);

      setBlocksByPage((prev) => ({
        ...prev,
        [activePage]: (prev[activePage] ?? []).map((block) =>
          block.id === dragging.id ? { ...block, x: nextX, y: nextY } : block
        ),
      }));
    };

    const handleUp = () => {
      setDragging(null);
      setGuideX(null);
      setGuideY(null);
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [dragging, activePage, blocksByPage]);

  const handleDragStart = (event: React.DragEvent<HTMLDivElement>, item: LibraryItem) => {
    event.dataTransfer.setData("text/plain", JSON.stringify(item));
    event.dataTransfer.effectAllowed = "copy";
    const ghost = document.createElement("div");
    ghost.style.width = "1px";
    ghost.style.height = "1px";
    ghost.style.opacity = "0";
    document.body.appendChild(ghost);
    event.dataTransfer.setDragImage(ghost, 0, 0);
    setTimeout(() => ghost.remove(), 0);
  };

  const parseDropItem = (event: React.DragEvent<HTMLElement>) => {
    const payload = event.dataTransfer.getData("text/plain");
    if (!payload) return null;
    return JSON.parse(payload) as LibraryItem;
  };

  const handleLogoDrop = (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    const item = parseDropItem(event);
    if (item?.type === "logo") {
      setSelectedLogo(item);
    }
  };

  const handleReturnDrop = (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    const item = parseDropItem(event);
    if (item?.type === "return") {
      setSelectedReturn(item);
    }
  };

  const handleTaglineDrop = (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    const item = parseDropItem(event);
    if (item?.type === "tagline") {
      setSelectedTaglineByPage((prev) => ({ ...prev, [activePage]: item }));
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!bodyZoneRef.current) return;
    const item = parseDropItem(event);
    if (!item) return;
    if (item.type === "verbiage" || item.type === "full-letter") {
      setEditorSelectionAtPoint(event.clientX, event.clientY);
      insertLibraryText(item, { standardFormat: item.type === "full-letter" });
      return;
    }
    if (item.type === "tagline") {
      setSelectedTaglineByPage((prev) => ({ ...prev, [activePage]: item }));
      return;
    }
    if (item.type === "logo") {
      setSelectedLogo(item);
      return;
    }
    if (item.type === "return") {
      setSelectedReturn(item);
      return;
    }
    const rect = bodyZoneRef.current.getBoundingClientRect();
    placeItemOnCanvas(item, event.clientX - rect.left - 24, event.clientY - rect.top - 24);
  };

  const handleAddLibraryItem = () => {
    if (!newItemLabel.trim()) return;
    const nextItem: LibraryItem = {
      id: `${activeTab}-${Date.now()}`,
      label: newItemLabel.trim(),
      content: newItemContent.trim() || undefined,
      imageUrl:
        activeTab === "Logos"
          ? newItemImageUrl.trim() || newItemImagePreview || undefined
          : undefined,
      type:
        activeTab === "Logos"
          ? "logo"
          : activeTab === "Taglines"
            ? "tagline"
            : activeTab === "Return Address"
              ? "return"
              : activeTab === "Verbiage"
                ? "verbiage"
                : "full-letter",
    };
    setLibrary((prev) => ({
      ...prev,
      [activeTab]: [nextItem, ...(prev[activeTab] ?? [])],
    }));
    setNewItemLabel("");
    setNewItemContent("");
    setNewItemImageUrl("");
    setNewItemImagePreview("");
    setShowNewItemForm(false);
  };

  const handleAddPage = () => {
    const nextIndex = pages.length;
    setPages((prev) => [...prev, `Page ${nextIndex + 1}`]);
    setBlocksByPage((prev) => ({ ...prev, [nextIndex]: [] }));
    setActivePage(nextIndex);
    setSelectedBlockId(null);
  };

  const handleRemoveBlock = (blockId: string) => {
    setBlocksByPage((prev) => ({
      ...prev,
      [activePage]: (prev[activePage] ?? []).filter((block) => block.id !== blockId),
    }));
    if (selectedBlockId === blockId) setSelectedBlockId(null);
  };

  const updateBlock = (id: string, updates: Partial<PlacedBlock>) => {
    setBlocksByPage((prev) => ({
      ...prev,
      [activePage]: (prev[activePage] ?? []).map((block) =>
        block.id === id ? { ...block, ...updates } : block
      ),
    }));
  };

  const placeItemOnCanvas = (item: LibraryItem, rawX: number, rawY: number) => {
    if (item.type === "logo") {
      setSelectedLogo(item);
      return;
    }
    if (item.type === "return") {
      setSelectedReturn(item);
      return;
    }
    if (item.type === "tagline") {
      setSelectedTaglineByPage((prev) => ({ ...prev, [activePage]: item }));
      return;
    }
    const size = getBodyZoneSize();
    if (!size) return;
    let x = snapToGrid(Math.max(rawX, 0));
    let y = snapToGrid(Math.max(rawY, 0));
    const block = createBlock(item, x, y);
    if (!block) return;
    const height = DEFAULT_BLOCK_HEIGHT;
    let attempt = 0;
    while (getOverlap(x, y, block.width, height, block.id) && attempt < 12) {
      y = Math.min(y + GRID_SIZE, size.height - height);
      attempt += 1;
    }
    block.x = Math.min(Math.max(x, 0), size.width - block.width);
    block.y = Math.min(Math.max(y, 0), size.height - height);
    setBlocksByPage((prev) => ({
      ...prev,
      [activePage]: [...(prev[activePage] ?? []), block],
    }));
    setSelectedBlockId(block.id);
    if (item.type === "full-letter" || item.type === "verbiage") {
      editorRef.current?.focusEnd();
    }
  };

  const addLibraryItemToCanvas = (item: LibraryItem) => {
    if (item.type === "verbiage" || item.type === "full-letter") {
      insertLibraryText(item, { standardFormat: item.type === "full-letter" });
      return;
    }
    placeItemOnCanvas(item, GRID_SIZE, GRID_SIZE);
  };

  const handleAddFromLibrary = (event: React.MouseEvent<HTMLButtonElement>, item: LibraryItem) => {
    event.stopPropagation();
    addLibraryItemToCanvas(item);
  };
  const updateBodyContent = (pageIndex: number, html: string) => {
    const plainText = html.replace(/<[^>]*>/g, "").trim();
    const nextHtml = plainText ? html : "";
    setBodyContentByPage((prev) => ({ ...prev, [pageIndex]: nextHtml }));
  };

  const setEditorSelectionAtPoint = (x: number, y: number) => {
    editorRef.current?.focusAtPoint(x, y);
  };

  const handleSpreadsheetFile = async (file: File) => {
    setSpreadsheetLoading(true);
    setSpreadsheetError(null);
    try {
      if (file.name.toLowerCase().endsWith(".xlsx")) {
        const formData = new FormData();
        formData.append("file", file);
        const response = await fetch(`${env.apiBaseUrl}/print-output/columns`, {
          method: "POST",
          body: formData,
        });
        if (!response.ok) {
          const message = await response.text();
          throw new Error(message || "Failed to parse spreadsheet");
        }
        const data = (await response.json()) as { columns: string[]; csv: string };
        setSpreadsheetContent(data.csv);
        setSpreadsheetName(file.name);
        setColumns(data.columns ?? []);
        setSpreadsheetLoading(false);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const text = typeof reader.result === "string" ? reader.result : "";
        const [headerLine] = text.split(/\r?\n/);
        const parsedColumns = headerLine
          ? headerLine.split(",").map((value) => value.trim()).filter(Boolean)
          : [];
        setSpreadsheetContent(text);
        setSpreadsheetName(file.name);
        setColumns(parsedColumns.length > 0 ? parsedColumns : []);
        setSpreadsheetLoading(false);
      };
      reader.onerror = () => {
        setSpreadsheetError("Failed to read file");
        setSpreadsheetContent("");
        setColumns([]);
        setSpreadsheetLoading(false);
      };
      reader.readAsText(file);
    } catch (error) {
      setSpreadsheetError(error instanceof Error ? error.message : "Failed to read file");
      setSpreadsheetContent("");
      setColumns([]);
      setSpreadsheetLoading(false);
    }
  };

  const handleTaglineWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    // Always stop propagation to prevent parent scroll
    event.stopPropagation();

    const list = taglineListRef.current;
    if (!list) return;

    const target = event.target as Node;
    const isInsideList = list.contains(target);

    if (isInsideList) {
      // Check if at scroll boundaries to prevent scroll chaining
      const { scrollTop, scrollHeight, clientHeight } = list;
      const atTop = scrollTop <= 0 && event.deltaY < 0;
      const atBottom = scrollTop + clientHeight >= scrollHeight && event.deltaY > 0;

      if (atTop || atBottom) {
        event.preventDefault();
      }
    } else {
      // Scrolling outside list (e.g., preview panel) - scroll the list
      event.preventDefault();
      list.scrollTop += event.deltaY;
    }
  };

  const handleFlyoutWheel = (event: React.WheelEvent<HTMLElement>) => {
    // Always stop propagation to keep scroll within flyout
    event.stopPropagation();

    const panel = event.currentTarget;
    const target = event.target as HTMLElement;

    // Find the scrollable container the target is inside
    const scrollableSelectors = [
      ".logo-grid", ".return-list", ".tagline-list", ".verbiage-list",
      ".full-letter-list", ".flyout-list", ".flyout-compact-list",
      ".flyout-card-grid", ".block-menu-list", ".block-menu-preview-panel",
      ".verbiage-preview-panel", ".full-letter-preview-panel",
      ".return-preview-panel", ".tagline-preview-panel"
    ];

    let scrollableParent: HTMLElement | null = null;
    for (const selector of scrollableSelectors) {
      const container = target.closest(selector) as HTMLElement | null;
      if (container && panel.contains(container)) {
        scrollableParent = container;
        break;
      }
    }

    if (scrollableParent) {
      const { scrollTop, scrollHeight, clientHeight } = scrollableParent;
      const atTop = scrollTop <= 0 && event.deltaY < 0;
      const atBottom = scrollTop + clientHeight >= scrollHeight && event.deltaY > 0;

      // Prevent scroll chaining at boundaries
      if (atTop || atBottom) {
        event.preventDefault();
      }
    } else {
      // Not inside a scrollable area - prevent any scroll
      event.preventDefault();
    }
  };

  const previewRows = useMemo(() => {
    if (!spreadsheetContent) return [];
    const lines = spreadsheetContent.split(/\r?\n/).filter((line) => line.trim().length > 0);
    return lines.slice(0, 6).map((line) => line.split(","));
  }, [spreadsheetContent]);

  const extractPlaceholders = (text: string) => {
    const results = new Set<string>();
    const matches = text.match(/\[[^\]]+\]/g) ?? [];
    matches.forEach((match) => results.add(match));
    return Array.from(results);
  };

  const placeholders = useMemo(() => {
    const htmlText = stripInlineControls(bodyContentByPage[activePage] ?? "");
    const plainText = htmlText.replace(/<[^>]*>/g, " ");
    const blockText = (blocksByPage[activePage] ?? [])
      .map((block) => block.content ?? "")
      .join(" ");
    return extractPlaceholders(`${plainText} ${blockText}`);
  }, [activePage, bodyContentByPage, blocksByPage]);

  const bodyIsEmpty = useMemo(() => {
    const htmlText = stripInlineControls(bodyContentByPage[activePage] ?? "");
    return htmlText.replace(/<[^>]*>/g, "").trim().length === 0;
  }, [activePage, bodyContentByPage]);

  const returnLines = useMemo(() => {
    const content = selectedReturn?.content ?? "";
    const lines = content.split("\n").map((line) => line.trim()).filter(Boolean);
    return [lines[0] ?? "", lines[1] ?? "", lines[2] ?? ""];
  }, [selectedReturn]);

  const normalizeMailingValue = (value: string) => (value === "__empty__" ? "" : value);

  const unmappedMailing = useMemo(
    () =>
      ["mailing_name", "mailing_addr1", "mailing_addr2", "mailing_addr3"].filter((key) => {
        const value = mailingMap[key] ?? "";
        return value === "" || value === "__select__";
      }),
    [mailingMap]
  );

  const sampleValueForColumn = (column: string) => {
    const seed = column.replace(/_/g, " ");
    return `Sample ${seed}`;
  };

  const resolvePlaceholderValue = (placeholder: string) => {
    const key = placeholder.replace(/^\[|\]$/g, "");
    const mappedColumn = placeholderMap[placeholder] || key;
    return sampleValueForColumn(mappedColumn);
  };

  // Parse all spreadsheet rows for preview
  const spreadsheetRows = useMemo(() => {
    if (!spreadsheetContent) return [];
    const lines = spreadsheetContent.split(/\r?\n/).filter((line) => line.trim().length > 0);
    if (lines.length < 2) return [];
    const [headerLine, ...dataLines] = lines;
    const headers = headerLine.split(",").map((h) => h.trim());
    return dataLines.map((line) => {
      const values = line.split(",");
      const rowMap: Record<string, string> = {};
      headers.forEach((header, index) => {
        rowMap[header] = values[index]?.trim() ?? "";
      });
      return rowMap;
    });
  }, [spreadsheetContent]);

  const getValueForRow = (rowIndex: number, column: string) => {
    const row = spreadsheetRows[rowIndex];
    if (!row) return sampleValueForColumn(column);
    return row[column] ?? sampleValueForColumn(column);
  };

  const buildMergedHtmlForRow = (rowIndex: number) => {
    const bodyHtml = stripInlineControls(bodyContentByPage[activePage] ?? "");
    const mergedBody = bodyHtml.replace(/\[([^\]]+)\]/g, (match) => {
      const key = match.replace(/^\[|\]$/g, "");
      const mappedColumn = placeholderMap[match] || key;
      return getValueForRow(rowIndex, mappedColumn);
    });
    return mergedBody;
  };

  const buildTleIndexForRow = (rowIndex: number) => ({
    mailing_name: getValueForRow(rowIndex, normalizeMailingValue(mailingMap.mailing_name) || "mailing_name"),
    mailing_addr1: getValueForRow(rowIndex, normalizeMailingValue(mailingMap.mailing_addr1) || "mailing_addr1"),
    mailing_addr2: getValueForRow(rowIndex, normalizeMailingValue(mailingMap.mailing_addr2) || "mailing_addr2"),
    mailing_addr3: normalizeMailingValue(mailingMap.mailing_addr3)
      ? getValueForRow(rowIndex, normalizeMailingValue(mailingMap.mailing_addr3))
      : "",
    return_addr1: returnLines[0],
    return_addr2: returnLines[1],
    return_addr3: returnLines[2],
  });

  const buildMergedHtml = () => buildMergedHtmlForRow(previewIndex);

  const buildTleIndex = () => buildTleIndexForRow(previewIndex);

  const handleGenerate = async () => {
    if (!spreadsheetContent) return;
    setGenerating(true);
    try {
      const response = await fetch(`${env.apiBaseUrl}/print-output/afp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_html: stripInlineControls(bodyContentByPage[0] ?? ""),
          block_texts: [],
          placeholder_map: placeholderMap,
          mailing_map: {
            mailing_name: normalizeMailingValue(mailingMap.mailing_name),
            mailing_addr1: normalizeMailingValue(mailingMap.mailing_addr1),
            mailing_addr2: normalizeMailingValue(mailingMap.mailing_addr2),
            mailing_addr3: normalizeMailingValue(mailingMap.mailing_addr3),
          },
          return_address: returnLines,
          spreadsheet_csv: spreadsheetContent,
        }),
      });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Failed to generate AFP");
      }
      const blob = await response.blob();
      if ("showSaveFilePicker" in window) {
        const picker = await (window as Window & {
          showSaveFilePicker: (options: {
            suggestedName?: string;
            types?: Array<{ description: string; accept: Record<string, string[]> }>;
          }) => Promise<FileSystemFileHandle>;
        }).showSaveFilePicker({
          suggestedName: "print_output.zip",
          types: [{ description: "Zip Archive", accept: { "application/zip": [".zip"] } }],
        });
        const writable = await picker.createWritable();
        await writable.write(blob);
        await writable.close();
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "print_output.zip";
        link.click();
        URL.revokeObjectURL(url);
      }
      setShowPreview(false);
    } catch (error) {
      console.error(error);
    } finally {
      setGenerating(false);
    }
  };

  const handleMergePreview = () => {
    if (spreadsheetRows.length === 0) return;
    setPreviewIndex(0);
    setShowPreview(true);
  };

  const unmappedPlaceholders = useMemo(
    () => placeholders.filter((placeholder) => !(placeholderMap[placeholder] ?? "")),
    [placeholders, placeholderMap]
  );

  useEffect(() => {
    if (placeholders.length === 0) return;
    setPlaceholderMap((prev) => {
      const next = { ...prev };
      placeholders.forEach((placeholder) => {
        if (!(placeholder in next)) next[placeholder] = "";
      });
      return next;
    });
  }, [placeholders]);

  const alignBlockPosition = (alignment: "left" | "center" | "right") => {
    if (!selectedBlock) return;
    const size = getBodyZoneSize();
    if (!size) return;
    const targetX =
      alignment === "left"
        ? 0
        : alignment === "center"
          ? (size.width - selectedBlock.width) / 2
          : size.width - selectedBlock.width;
    const nextX = snapToGrid(targetX);
    const { x, y } = clampPosition(selectedBlock, nextX, selectedBlock.y);
    updateBlock(selectedBlock.id, { x, y });
  };

  const handleBlockMouseDown = (event: React.MouseEvent<HTMLDivElement>, block: PlacedBlock) => {
    if (isEditableTarget(event.target)) return;
    if (!bodyZoneRef.current) return;
    const rect = bodyZoneRef.current.getBoundingClientRect();
    const offsetX = event.clientX - rect.left - block.x;
    const offsetY = event.clientY - rect.top - block.y;
    setDragging({ id: block.id, offsetX, offsetY });
    setSelectedBlockId(block.id);
    event.preventDefault();
  };

  const handleLibraryItemUpdate = (
    tab: string,
    id: string,
    label: string,
    content?: string,
    imageUrl?: string
  ) => {
    setLibrary((prev) => ({
      ...prev,
      [tab]: (prev[tab] ?? []).map((item) =>
        item.id === id ? { ...item, label, content, imageUrl } : item
      ),
    }));
  };

  const handleInlineEdit = (block: PlacedBlock, value: string) => {
    inlineDraftsRef.current.set(block.id, value);
  };

  const commitInlineEdit = (block: PlacedBlock) => {
    const draft = inlineDraftsRef.current.get(block.id);
    const nextValue = draft !== undefined ? draft : block.content ?? "";
    updateBlock(block.id, { content: nextValue });
    inlineDraftsRef.current.delete(block.id);
  };

  const getBlockContent = (block: PlacedBlock) =>
    inlineDraftsRef.current.get(block.id) ?? block.content ?? "";

  const handleLogoFileUpload = (file: File, onLoad: (dataUrl: string) => void) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") onLoad(result);
    };
    reader.readAsDataURL(file);
  };

  const handleFlyoutImageUpload = (file: File) => {
    handleLogoFileUpload(file, (dataUrl) => setNewImagePreview(dataUrl));
  };

  const handleLogoUploadFile = (file: File) => {
    const validTypes = ["image/png", "image/jpeg", "image/svg+xml"];
    const maxSize = 5 * 1024 * 1024;
    if (!validTypes.includes(file.type)) {
      setLogoUploadError("Invalid file type. Please upload PNG, JPG, or SVG.");
      return;
    }
    if (file.size > maxSize) {
      setLogoUploadError("File is too large. Max size is 5MB.");
      return;
    }
    setLogoUploadError("");
    setLogoUploadName(file.name.replace(/\.[^/.]+$/, ""));
    handleLogoFileUpload(file, (dataUrl) => setLogoUploadPreview(dataUrl));
  };

  const simulateLogoUpload = (name: string, url: string) =>
    new Promise<{ id: string; name: string; url: string; type: "custom" }>((resolve) => {
      setTimeout(() => {
        resolve({ id: `custom-${Date.now()}`, name, url, type: "custom" });
      }, 700);
    });

  const filterFlyoutItems = (tab: string) => {
    const items = library[tab] ?? [];
    const term = flyoutQuery.trim().toLowerCase();
    const filtered = !term
      ? items
      : items.filter((item) => {
          const text = `${item.label} ${item.content ?? ""}`.toLowerCase();
          return text.includes(term);
        });
    if (tab !== "Logos") return filtered;
    return [...filtered].sort((a, b) => {
      const aCustom = a.isCustom ? 1 : 0;
      const bCustom = b.isCustom ? 1 : 0;
      return bCustom - aCustom;
    });
  };

  const handleLibraryItemDelete = (tab: string, id: string) => {
    setLibrary((prev) => ({
      ...prev,
      [tab]: (prev[tab] ?? []).filter((item) => item.id !== id),
    }));
  };

  const addLibraryItemForTab = (
    tab: string,
    name: string,
    content: string,
    imageUrl?: string,
    isCustom?: boolean
  ) => {
    const newItem: LibraryItem = {
      id: `${tab}-${Date.now()}`,
      label: name,
      content: content || undefined,
      imageUrl: tab === "Logos" ? imageUrl : undefined,
      isCustom: tab === "Logos" ? isCustom : undefined,
      type:
        tab === "Logos"
          ? "logo"
          : tab === "Taglines"
            ? "tagline"
            : tab === "Return Address"
              ? "return"
              : tab === "Verbiage"
                ? "verbiage"
                : "full-letter",
    };
    setLibrary((prev) => ({
      ...prev,
      [tab]: [newItem, ...(prev[tab] ?? [])],
    }));
    return newItem;
  };

  const handleAdminAdd = (tab: string) => {
    const label = window.prompt(`Add new ${tab} item`);
    if (!label) return;
    const newItem: LibraryItem = {
      id: `${tab}-${Date.now()}`,
      label,
      type:
        tab === "Logos"
          ? "logo"
          : tab === "Taglines"
            ? "tagline"
            : tab === "Return Address"
              ? "return"
              : tab === "Verbiage"
                ? "verbiage"
                : "full-letter",
    };
    setLibrary((prev) => ({
      ...prev,
      [tab]: [newItem, ...(prev[tab] ?? [])],
    }));
  };

  useEffect(() => {
    if (!openMenuTab) return;
    setFlyoutQuery("");
    setHoverPreviewId(null);
    setSelectedVerbiageId(null);
    setHoverFullLetterId(null);
    setSelectedFullLetterId(null);
    setHoverReturnId(null);
    setHoverTaglineId(null);
    requestAnimationFrame(() => {
      flyoutSearchRef.current?.focus();
      flyoutSearchRef.current?.select();
    });
  }, [openMenuTab]);

  useEffect(() => {
    if (!logoResizeState) return;
    const handleMove = (event: MouseEvent) => {
      const { corner, startX, startWidth } = logoResizeState;
      const direction = corner.includes("l") ? -1 : 1;
      const delta = (event.clientX - startX) * direction;
      const minWidth = 80;
      const maxWidth = 260;
      const nextWidth = Math.min(maxWidth, Math.max(minWidth, startWidth + delta));
      const aspect = logoAspectRef.current || 1;
      const nextHeight = Math.max(40, nextWidth / aspect);
      setLogoBox({ width: nextWidth, height: nextHeight });
    };
    const handleUp = () => setLogoResizeState(null);
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [logoResizeState]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (!openMenuTab) return;
      if (flyoutQuery.trim()) {
        event.preventDefault();
        setFlyoutQuery("");
        return;
      }
      event.preventDefault();
      setOpenMenuTab(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [openMenuTab, flyoutQuery]);

  return (
    <div className="builder">
      <header className="topbar">
        <div className="brand">
          <div>
            <h1>Adhoc Print Studio <span className="brand-suffix">By PSD</span></h1>
            <p>Compose letters from approved building blocks</p>
          </div>
        </div>
        <div className="topbar-actions">
          <button className="ghost">New template</button>
          <button className="primary">Save</button>
          <div className="menu">
            <button className="secondary" onClick={() => setShowActionsMenu((prev) => !prev)}>
              More ▾
            </button>
            {showActionsMenu && (
              <div className="menu-panel">
                <button className="ghost">Preview</button>
                <button className="ghost">Export</button>
              </div>
            )}
          </div>
          <button className="ghost">User ▾</button>
        </div>
      </header>

      <div className="builder-body">
        <div className="sidebar-shell">
          <aside className="library">
            <div className="library-nav">
              {libraryButtons.map((button) => (
                <div key={button.tab} className="sidebar-button-wrap">
                  <SidebarButton
                    label={button.label}
                    icon={button.icon}
                    isActive={button.tab === activeTab}
                    onClick={() => {
                      setActiveTab(button.tab);
                      setOpenMenuTab((current) => (current === button.tab ? null : button.tab));
                    }}
                  />
                </div>
              ))}
            </div>
            <button className="ghost admin" onClick={() => setShowAdmin(true)}>
              Admin: manage library
            </button>
          </aside>
        </div>

        {openMenuTab && (
          <FlyoutPanel
            title={libraryButtons.find((button) => button.tab === openMenuTab)?.label ?? "Library"}
            isOpen={openMenuTab !== null}
            onClose={() => setOpenMenuTab(null)}
            onWheel={handleFlyoutWheel}
            searchPlaceholder={
              openMenuTab === "Verbiage"
                ? "Search verbiage..."
                : openMenuTab === "Logos"
                  ? "Search logos..."
                  : openMenuTab === "Return Address"
                    ? "Search addresses..."
                    : openMenuTab === "Taglines"
                      ? "Search taglines..."
                      : openMenuTab === "Full Letters"
                        ? "Search letters..."
                        : "Search"
            }
            searchValue={flyoutQuery}
            onSearchChange={setFlyoutQuery}
            onCreateClick={() => {
              if (!openMenuTab) return;
              if (openMenuTab === "Logos") {
                setShowLogoModal(true);
                return;
              }
              if (openMenuTab === "Return Address") {
                setShowAddressModal(true);
                return;
              }
              if (openMenuTab === "Taglines") {
                setShowTaglineModal(true);
                return;
              }
              if (openMenuTab === "Verbiage") {
                setShowVerbiageModal(true);
                return;
              }
              setShowCreateModal(true);
            }}
            searchRef={flyoutSearchRef}
            onSearchKeyDown={(event) => {
              if (event.key !== "Escape") return;
              if (flyoutQuery.trim()) {
                event.preventDefault();
                setFlyoutQuery("");
                return;
              }
              event.preventDefault();
              setOpenMenuTab(null);
            }}
          >
            {openMenuTab === "Logos" ? (
              <div className="logo-grid">
                {filterFlyoutItems(openMenuTab).map((item) => (
                  <div
                    key={item.id}
                    className="logo-card"
                    draggable
                    onDragStart={(event) => handleDragStart(event, item)}
                    onClick={() => addLibraryItemToCanvas(item)}
                    title={item.label}
                  >
                    <div className="logo-card-thumb">
                      {item.imageUrl ? <img src={item.imageUrl} alt={item.label} /> : null}
                    </div>
                    <div className="logo-card-title">
                      {item.label}
                      {item.isCustom && <span className="logo-badge">Custom</span>}
                    </div>
                  </div>
                ))}
              </div>
            ) : openMenuTab === "Return Address" ? (
              <div className="return-two-column">
                <div className="return-list">
                  {filterFlyoutItems(openMenuTab).map((item) => (
                    <div
                      key={item.id}
                      className="return-list-item"
                      draggable
                      onDragStart={(event) => handleDragStart(event, item)}
                      onClick={() => addLibraryItemToCanvas(item)}
                      onMouseEnter={() => setHoverReturnId(item.id)}
                      onMouseLeave={() => setHoverReturnId(null)}
                      onFocus={() => setHoverReturnId(item.id)}
                      onBlur={() => setHoverReturnId(null)}
                      tabIndex={0}
                    >
                      {item.label}
                    </div>
                  ))}
                </div>
                <div className="return-preview-panel">
                  {(() => {
                    if (!hoverReturnId) {
                      return <p className="hint">Hover an address to preview.</p>;
                    }
                    const activeItem = (library[openMenuTab] ?? []).find(
                      (entry) => entry.id === hoverReturnId
                    );
                    if (!activeItem) {
                      return <p className="hint">Hover an address to preview.</p>;
                    }
                    return (
                      <>
                        <div className="return-preview-title">{activeItem.label}</div>
                        <p>{activeItem.content ?? activeItem.label}</p>
                      </>
                    );
                  })()}
                </div>
              </div>
            ) : openMenuTab === "Taglines" ? (
              <div className="tagline-two-column" onWheel={handleTaglineWheel}>
                <div className="tagline-list" ref={taglineListRef}>
                  {filterFlyoutItems(openMenuTab).map((item) => (
                    <div
                      key={item.id}
                      className="tagline-list-item"
                      draggable
                      onDragStart={(event) => handleDragStart(event, item)}
                      onClick={() => addLibraryItemToCanvas(item)}
                      onMouseEnter={() => setHoverTaglineId(item.id)}
                      onMouseLeave={() => setHoverTaglineId(null)}
                      onFocus={() => setHoverTaglineId(item.id)}
                      onBlur={() => setHoverTaglineId(null)}
                      tabIndex={0}
                    >
                      {item.label}
                    </div>
                  ))}
                </div>
                <div className="tagline-preview-panel">
                  {(() => {
                    if (!hoverTaglineId) {
                      return <p className="hint">Hover a tagline to preview.</p>;
                    }
                    const activeItem = (library[openMenuTab] ?? []).find(
                      (entry) => entry.id === hoverTaglineId
                    );
                    if (!activeItem) {
                      return <p className="hint">Hover a tagline to preview.</p>;
                    }
                    return (
                      <>
                        <div className="tagline-preview-title">{activeItem.label}</div>
                        <p>{activeItem.content ?? activeItem.label}</p>
                      </>
                    );
                  })()}
                </div>
              </div>
            ) : openMenuTab === "Full Letters" ? (
              <div className="full-letter-two-column">
                <div className="full-letter-list">
                  {filterFlyoutItems(openMenuTab).map((item) => (
                    <div
                      key={item.id}
                      className={
                        selectedFullLetterId === item.id
                          ? "full-letter-list-item active"
                          : "full-letter-list-item"
                      }
                      draggable
                      onDragStart={(event) => handleDragStart(event, item)}
                      onClick={() => {
                        addLibraryItemToCanvas(item);
                        setSelectedFullLetterId(item.id);
                      }}
                      onMouseEnter={() => setHoverFullLetterId(item.id)}
                      onMouseLeave={() => setHoverFullLetterId(null)}
                      onFocus={() => setHoverFullLetterId(item.id)}
                      onBlur={() => setHoverFullLetterId(null)}
                      tabIndex={0}
                    >
                      {item.label}
                    </div>
                  ))}
                </div>
                <div className="full-letter-preview-panel">
                  {(() => {
                    const activeId = hoverFullLetterId ?? selectedFullLetterId;
                    if (!activeId) {
                      return <p className="hint">Hover a letter to preview.</p>;
                    }
                    const activeItem = (library[openMenuTab] ?? []).find(
                      (entry) => entry.id === activeId
                    );
                    if (!activeItem) {
                      return <p className="hint">Hover a letter to preview.</p>;
                    }
                    return (
                      <>
                        <div className="full-letter-preview-title">{activeItem.label}</div>
                        <p>{activeItem.content ?? activeItem.label}</p>
                      </>
                    );
                  })()}
                </div>
              </div>
            ) : openMenuTab === "Verbiage" ? (
              <div className="verbiage-two-column">
                <div className="verbiage-list">
                  {filterFlyoutItems(openMenuTab).map((item) => (
                    <div
                      key={item.id}
                      className={
                        selectedVerbiageId === item.id
                          ? "verbiage-list-item active"
                          : "verbiage-list-item"
                      }
                      draggable
                      onDragStart={(event) => handleDragStart(event, item)}
                      onClick={() => {
                        addLibraryItemToCanvas(item);
                        setSelectedVerbiageId(item.id);
                      }}
                      onMouseEnter={() => setHoverPreviewId(item.id)}
                      onMouseLeave={() => setHoverPreviewId(null)}
                      onFocus={() => setHoverPreviewId(item.id)}
                      onBlur={() => setHoverPreviewId(null)}
                      tabIndex={0}
                    >
                      {item.label}
                    </div>
                  ))}
                </div>
                <div className="verbiage-preview-panel">
                  {(() => {
                    const activeId = hoverPreviewId ?? selectedVerbiageId;
                    if (!activeId) {
                      return <p className="hint">Hover a verbiage to preview.</p>;
                    }
                    const activeItem = (library[openMenuTab] ?? []).find(
                      (entry) => entry.id === activeId
                    );
                    if (!activeItem) {
                      return <p className="hint">Hover a verbiage to preview.</p>;
                    }
                    return (
                      <>
                        <div className="verbiage-preview-title">{activeItem.label}</div>
                        <p>{activeItem.content ?? activeItem.label}</p>
                      </>
                    );
                  })()}
                </div>
              </div>
            ) : (
              <BlockMenu
                items={(library[openMenuTab] ?? []).map((item) => ({
                  id: item.id,
                  title: item.label,
                  previewText: item.content ?? item.label,
                  previewImage: item.imageUrl,
                }))}
                onInsert={(item) => {
                  const sourceItem = (library[openMenuTab] ?? []).find(
                    (libraryItem) => libraryItem.id === item.id
                  );
                  if (!sourceItem) return;
                  addLibraryItemToCanvas(sourceItem);
                }}
                onDragStart={(event, item) => {
                  const sourceItem = (library[openMenuTab] ?? []).find(
                    (libraryItem) => libraryItem.id === item.id
                  );
                  if (!sourceItem) return;
                  handleDragStart(event, sourceItem);
                }}
                query={flyoutQuery}
              />
            )}
          </FlyoutPanel>
        )}

        <main className="canvas-panel">
          <div className="workspace">
            <div className="canvas-area" onMouseDown={() => setOpenMenuTab(null)}>
              <div className="canvas-header">
                <div className="page-controls">
                  <button className="ghost" onClick={handleAddPage}>
                    + Add page
                  </button>
                  <div className="page-tabs">
                    {pages.map((label, index) => (
                      <button
                        key={label}
                        className={index === activePage ? "tab active" : "tab"}
                        onClick={() => {
                          setActivePage(index);
                          setSelectedBlockId(null);
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

          <section className="canvas">
            <div className="letter-page">
              {activePage === 0 && (
                <>
                  <div className="letter-header">
                    <div
                      className="return-block fixed"
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={handleReturnDrop}
                    >
                      <div className="return-info">
                        <div className="block-content">
                          {selectedReturn
                            ? selectedReturn.content ?? selectedReturn.label
                            : "Drop a return address here"}
                        </div>
                      </div>
                    </div>

                    <div
                      className="logo-top-right resizable"
                      style={{ width: logoBox.width, height: logoBox.height }}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={handleLogoDrop}
                    >
                      {selectedLogo?.imageUrl ? (
                        <>
                          <img
                            src={selectedLogo.imageUrl}
                            alt={selectedLogo.label}
                            onLoad={(event) => {
                              const target = event.currentTarget;
                              const aspect = target.naturalWidth / target.naturalHeight || 1;
                              logoAspectRef.current = aspect;
                              const nextWidth = logoBox.width;
                              const nextHeight = Math.max(40, nextWidth / aspect);
                              setLogoBox((prev) => ({ ...prev, height: nextHeight }));
                            }}
                          />
                          {(["tl", "tr", "bl", "br"] as const).map((corner) => (
                            <span
                              key={corner}
                              className={`resize-handle ${corner}`}
                              onMouseDown={(event) => {
                                event.stopPropagation();
                                setLogoResizeState({
                                  corner,
                                  startX: event.clientX,
                                  startWidth: logoBox.width,
                                });
                              }}
                            />
                          ))}
                        </>
                      ) : (
                        "Logo slot"
                      )}
                    </div>
                  </div>

                  <div className="mail-window fixed" aria-hidden="true">
                    <div className="block-content">Reserved for recipient address</div>
                    <div className="mailing-variables">
                      <div>[mailing_name]</div>
                      <div>[mailing_addr1]</div>
                      <div>[mailing_addr2]</div>
                      <div>[mailing_addr3]</div>
                    </div>
                  </div>
                </>
              )}

              <div className="letter-body">
                <div className="body-zone">
              <div
                className={`page-surface ${showGrid ? "with-grid" : ""}`}
                ref={bodyZoneRef}
                onDrop={handleDrop}
                onDragEnter={() => setShowGrid(true)}
                onDragLeave={() => setShowGrid(false)}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "copy";
                }}
                onMouseDown={(event) => {
                  const target = event.target as HTMLElement;
                  if (target.closest(".inline-remove")) return;
                  if (target.closest(".block")) return;
                  if (target.closest(".ProseMirror")) return;
                  event.preventDefault();
                  setEditorSelectionAtPoint(event.clientX, event.clientY);
                }}
              >
                <EditorClient
                  ref={editorRef}
                  value={bodyContentByPage[activePage] ?? ""}
                  onChange={(html) => updateBodyContent(activePageRef.current, html)}
                  placeholder="Start typing your letter..."
                />
                {guideX !== null && <div className="guide-line guide-x" style={{ left: guideX }} />}
                {guideY !== null && <div className="guide-line guide-y" style={{ top: guideY }} />}
                {(blocksByPage[activePage] ?? []).length === 0 && bodyIsEmpty && (
                  <div className="empty-state">Drop verbiage or full letters here</div>
                )}
                {(blocksByPage[activePage] ?? []).map((block) => (
                  <div
                    key={block.id}
                    className={
                      block.id === selectedBlockId
                        ? `block selected ${block.type}`
                        : `block ${block.type}`
                    }
                    onMouseDown={(event) => handleBlockMouseDown(event, block)}
                    ref={(node) => {
                      if (node) {
                        blockRefs.current.set(block.id, node);
                      } else {
                        blockRefs.current.delete(block.id);
                      }
                    }}
                    style={{
                      left:
                        block.type === "verbiage" || block.type === "full-letter"
                          ? PAGE_PADDING
                          : block.x,
                      top: block.y,
                      width:
                        block.type === "verbiage" || block.type === "full-letter"
                          ? `calc(100% - ${PAGE_PADDING * 2}px)`
                          : block.width,
                      right: "auto",
                      textAlign: block.align,
                    }}
                  >
                    <div className="block-content-wrap">
                      <span className="block-title-inline">{block.label}</span>
                      {block.type !== "verbiage" && block.type !== "full-letter" && (
                        <span className="block-meta">{block.type.replace("-", " ")}</span>
                      )}
                    </div>
                    {block.content !== undefined && (
                      <p
                        className="block-body"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={() => {
                          commitInlineEdit(block);
                        }}
                        onInput={(event) =>
                          handleInlineEdit(block, event.currentTarget.textContent ?? "")
                        }
                      >
                        {getBlockContent(block)}
                      </p>
                    )}
                  {block.type === "verbiage" && (
                    <button
                      className="remove-block"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleRemoveBlock(block.id);
                      }}
                    >
                      Remove
                    </button>
                  )}
                  {block.type === "verbiage" && block.content && (
                    <div className="block-popover">
                      <strong>{block.label}</strong>
                      <p>{block.content}</p>
                    </div>
                  )}
                  </div>
                ))}
              </div>
              </div>
              </div>

              <div
                className="tagline-block fixed"
                onDragOver={(event) => event.preventDefault()}
                onDrop={handleTaglineDrop}
              >
                <div className="block-title">Tagline (fixed)</div>
                <div className="block-content">
                  {selectedTaglineByPage[activePage]
                    ? selectedTaglineByPage[activePage]?.label
                    : "Drop a tagline here"}
                </div>
              </div>
            </div>
          </section>
            </div>
          </div>
        </main>

        <aside className="properties">
          <h3>Data</h3>
          <div className="property-group">
            <div
              className="drop-zone"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const file = event.dataTransfer.files?.[0];
                if (file) {
                  handleSpreadsheetFile(file).catch((error) => {
                    console.error(error);
                  });
                }
              }}
            >
              <p>{spreadsheetName ? "Spreadsheet loaded" : "Drag spreadsheet here"}</p>
              <span>{spreadsheetName ?? "CSV or XLSX"}</span>
              <label className="file-input">
                Upload file
                <input
                  type="file"
                  accept=".csv,.xlsx"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      handleSpreadsheetFile(file).catch((error) => {
                        console.error(error);
                      });
                    }
                  }}
                />
              </label>
            </div>
          </div>
          {spreadsheetLoading && (
            <div className="property-group">
              <p className="hint">Parsing spreadsheet...</p>
            </div>
          )}
          {spreadsheetError && (
            <div className="property-group">
              <div className="alert warning">{spreadsheetError}</div>
            </div>
          )}
          {columns.length > 0 && (
            <div className="property-group">
              <h4>Columns</h4>
              <div className="pill-grid">
                {columns.map((column) => (
                  <span key={column} className="pill">
                    {column}
                  </span>
                ))}
              </div>
            </div>
          )}
          {(previewRows.length > 0 || spreadsheetName) && (
            <div className="property-group">
              <h4>Spreadsheet preview</h4>
              {previewRows.length > 0 ? (
                <div className="data-preview">
                  <table>
                    <thead>
                      <tr>
                        {previewRows[0].map((cell, index) => (
                          <th key={`head-${index}`}>{cell}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.slice(1).map((row, rowIndex) => (
                        <tr key={`row-${rowIndex}`}>
                          {row.map((cell, cellIndex) => (
                            <td key={`cell-${rowIndex}-${cellIndex}`}>{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="hint">No preview available yet.</p>
              )}
            </div>
          )}
          <div className="property-group">
            <h4>Insert placeholder</h4>
            <div className="placeholder-row">
              <select
                value={insertPlaceholder}
                onChange={(event) => setInsertPlaceholder(event.target.value)}
              >
                <option value="" disabled>
                  Select column
                </option>
                {columns.map((column) => (
                  <option key={column} value={column}>
                    [{column}]
                  </option>
                ))}
              </select>
              <button
                className="secondary"
                onClick={() => {
                  if (!insertPlaceholder) return;
                  editorRef.current?.insertText(`[${insertPlaceholder}]`);
                }}
              >
                Insert
              </button>
            </div>
          </div>
          {columns.length > 0 && (
            <div className="property-group">
              <h4>Variables mapping</h4>
              {unmappedMailing.length > 0 && (
                <div className="alert warning">
                  Unmapped mailing fields: {unmappedMailing.join(", ")}
                </div>
              )}
              <div className="mapping-table">
                {["mailing_name", "mailing_addr1", "mailing_addr2", "mailing_addr3"].map((key) => (
                  <div key={key} className="mapping-row">
                    <span className="mapping-key">{key}</span>
                    <select
                      value={mailingMap[key] || "__select__"}
                      onChange={(event) =>
                        setMailingMap((prev) => ({
                          ...prev,
                          [key]: event.target.value,
                        }))
                      }
                    >
                      <option value="__select__" disabled>
                        Select column
                      </option>
                      <option value="__empty__">(empty)</option>
                      {columns.map((column) => (
                        <option key={column} value={column}>
                          {column}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              {placeholders.length > 0 && (
                <>
                  {unmappedPlaceholders.length > 0 && (
                    <div className="alert warning">
                      Unmapped placeholders: {unmappedPlaceholders.join(", ")}
                    </div>
                  )}
                  <div className="mapping-table">
                    {placeholders.map((placeholder) => (
                      <div key={placeholder} className="mapping-row">
                        <span className="mapping-key">{placeholder}</span>
                        <select
                          value={placeholderMap[placeholder] ?? ""}
                          onChange={(event) =>
                            setPlaceholderMap((prev) => ({
                              ...prev,
                              [placeholder]: event.target.value,
                            }))
                          }
                        >
                          <option value="">Select column</option>
                          {columns.map((column) => (
                            <option key={column} value={column}>
                              {column}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          <div className="property-group">
            <button className="secondary" onClick={handleMergePreview} disabled={!spreadsheetContent}>
              Merge/Preview
            </button>
            <button className="primary" onClick={() => setShowPreview(true)} disabled={!spreadsheetContent}>
              Generate print output
            </button>
          </div>
        </aside>
      </div>

      {showAdmin && (
        <div className="modal-backdrop" onClick={() => setShowAdmin(false)}>
          <div className="modal admin-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>Admin Library Manager</h3>
              <button className="ghost" onClick={() => setShowAdmin(false)}>
                Close
              </button>
            </div>
            <div className="admin-tabs">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  className={tab === activeTab ? "tab active" : "tab"}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>
            <div className="admin-list">
              {(library[activeTab] ?? []).map((item) => (
                <div key={item.id} className="admin-row">
                  <input
                    value={item.label}
                    onChange={(event) =>
                      handleLibraryItemUpdate(
                        activeTab,
                        item.id,
                        event.target.value,
                        item.content,
                        item.imageUrl
                      )
                    }
                  />
                  {activeTab === "Logos" ? (
                    <div className="admin-logo-edit">
                      <input
                        value={item.imageUrl ?? ""}
                        onChange={(event) =>
                          handleLibraryItemUpdate(
                            activeTab,
                            item.id,
                            item.label,
                            item.content,
                            event.target.value
                          )
                        }
                        placeholder="Logo image URL"
                      />
                      <label className="file-input">
                        Upload image
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) {
                              handleLogoFileUpload(file, (dataUrl) =>
                                handleLibraryItemUpdate(
                                  activeTab,
                                  item.id,
                                  item.label,
                                  item.content,
                                  dataUrl
                                )
                              );
                            }
                          }}
                        />
                      </label>
                    </div>
                  ) : (
                    <input
                      value={item.content ?? ""}
                      onChange={(event) =>
                        handleLibraryItemUpdate(
                          activeTab,
                          item.id,
                          item.label,
                          event.target.value,
                          item.imageUrl
                        )
                      }
                      placeholder="Optional content"
                    />
                  )}
                  <button className="ghost" onClick={() => handleLibraryItemDelete(activeTab, item.id)}>
                    Delete
                  </button>
                </div>
              ))}
            </div>
            <button className="secondary" onClick={() => handleAdminAdd(activeTab)}>
              + Add {activeTab} item
            </button>
          </div>
        </div>
      )}
      {showCreateModal && openMenuTab && (
        <div className="modal-backdrop" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>Create new item</h3>
              <button className="ghost" onClick={() => setShowCreateModal(false)}>
                Close
              </button>
            </div>
            <div className="form-grid">
              <input
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                placeholder="Name"
              />
              {openMenuTab === "Logos" && (
                <>
                  <input
                    value={newImageUrl}
                    onChange={(event) => setNewImageUrl(event.target.value)}
                    placeholder="Image URL (optional)"
                  />
                  <label className="file-input">
                    Upload image
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) {
                          handleFlyoutImageUpload(file);
                        }
                      }}
                    />
                  </label>
                  {newImagePreview && (
                    <div className="logo-preview">
                      <img src={newImagePreview} alt="Preview" />
                    </div>
                  )}
                </>
              )}
              <textarea
                value={newContent}
                onChange={(event) => setNewContent(event.target.value)}
                placeholder="Content"
                rows={4}
              />
            </div>
            <div className="form-actions">
              <button
                className="ghost"
                onClick={() => {
                  setShowCreateModal(false);
                  setNewName("");
                  setNewContent("");
                  setNewImageUrl("");
                  setNewImagePreview("");
                }}
              >
                Cancel
              </button>
              <button
                className="primary"
                onClick={() => {
                  if (!newName.trim()) return;
                  const imageUrl =
                    openMenuTab === "Logos"
                      ? newImageUrl.trim() || newImagePreview || undefined
                      : undefined;
                  const createdItem = addLibraryItemForTab(
                    openMenuTab,
                    newName.trim(),
                    newContent.trim(),
                    imageUrl
                  );
                  if (openMenuTab === "Logos" && createdItem) {
                    setSelectedLogo(createdItem);
                  }
                  setNewName("");
                  setNewContent("");
                  setNewImageUrl("");
                  setNewImagePreview("");
                  setShowCreateModal(false);
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
      {showAddressModal && (
        <div className="modal-backdrop" onClick={() => setShowAddressModal(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>Create return address</h3>
              <button className="ghost" onClick={() => setShowAddressModal(false)}>
                Close
              </button>
            </div>
            <div className="form-grid">
              <input
                value={addressName}
                onChange={(event) => setAddressName(event.target.value)}
                placeholder="Address label"
              />
              <textarea
                value={addressContent}
                onChange={(event) => setAddressContent(event.target.value)}
                placeholder="Return address (one line per row)"
                rows={4}
              />
            </div>
            <div className="form-actions">
              <button
                className="ghost"
                onClick={() => {
                  setShowAddressModal(false);
                  setAddressName("");
                  setAddressContent("");
                }}
              >
                Cancel
              </button>
              <button
                className="primary"
                onClick={() => {
                  if (!addressName.trim()) return;
                  const createdItem = addLibraryItemForTab(
                    "Return Address",
                    addressName.trim(),
                    addressContent.trim()
                  );
                  if (createdItem) setSelectedReturn(createdItem);
                  setAddressName("");
                  setAddressContent("");
                  setShowAddressModal(false);
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
      {showTaglineModal && (
        <div className="modal-backdrop" onClick={() => setShowTaglineModal(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>Create tagline</h3>
              <button className="ghost" onClick={() => setShowTaglineModal(false)}>
                Close
              </button>
            </div>
            <div className="form-grid">
              <textarea
                value={taglineText}
                onChange={(event) => setTaglineText(event.target.value)}
                placeholder="Tagline text"
                rows={3}
              />
            </div>
            <div className="form-actions">
              <button
                className="ghost"
                onClick={() => {
                  setShowTaglineModal(false);
                  setTaglineText("");
                }}
              >
                Cancel
              </button>
              <button
                className="primary"
                onClick={() => {
                  if (!taglineText.trim()) return;
                  const createdItem = addLibraryItemForTab(
                    "Taglines",
                    taglineText.trim(),
                    taglineText.trim()
                  );
                  if (createdItem) {
                    insertLibraryText(createdItem);
                  }
                  setTaglineText("");
                  setShowTaglineModal(false);
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
      {showVerbiageModal && (
        <div className="modal-backdrop" onClick={() => setShowVerbiageModal(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>Create verbiage</h3>
              <button className="ghost" onClick={() => setShowVerbiageModal(false)}>
                Close
              </button>
            </div>
            <div className="form-grid">
              <input
                value={verbiageTitle}
                onChange={(event) => setVerbiageTitle(event.target.value)}
                placeholder="Verbiage title"
              />
              <textarea
                value={verbiageText}
                onChange={(event) => setVerbiageText(event.target.value)}
                placeholder="Verbiage text"
                rows={4}
              />
            </div>
            <div className="form-actions">
              <button
                className="ghost"
                onClick={() => {
                  setShowVerbiageModal(false);
                  setVerbiageTitle("");
                  setVerbiageText("");
                }}
              >
                Cancel
              </button>
              <button
                className="primary"
                onClick={() => {
                  if (!verbiageTitle.trim() || !verbiageText.trim()) return;
                  addLibraryItemForTab("Verbiage", verbiageTitle.trim(), verbiageText.trim());
                  setVerbiageTitle("");
                  setVerbiageText("");
                  setShowVerbiageModal(false);
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
      <UploadLogoModal
        isOpen={showLogoModal}
        previewUrl={logoUploadPreview}
        fileName={logoUploadName}
        errorMessage={logoUploadError}
        isUploading={logoUploadLoading}
        onCancel={() => {
          setShowLogoModal(false);
          setLogoUploadPreview("");
          setLogoUploadName("");
          setLogoUploadError("");
        }}
        onFileSelect={handleLogoUploadFile}
        onUpload={async () => {
          if (!logoUploadPreview) return;
          try {
            setLogoUploadLoading(true);
            const response = await simulateLogoUpload(
              logoUploadName || "Uploaded logo",
              logoUploadPreview
            );
            const createdItem = addLibraryItemForTab(
              "Logos",
              response.name,
              "",
              response.url,
              true
            );
            if (createdItem) setSelectedLogo(createdItem);
            setShowLogoModal(false);
            setLogoUploadPreview("");
            setLogoUploadName("");
            setLogoUploadError("");
          } finally {
            setLogoUploadLoading(false);
          }
        }}
      />
      {showPreview && (
        <div className="modal-backdrop" onClick={() => setShowPreview(false)}>
          <div className="modal preview-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>Print Output Preview</h3>
              <div className="preview-nav">
                <button
                  className="ghost"
                  onClick={() => setPreviewIndex((i) => Math.max(0, i - 1))}
                  disabled={previewIndex === 0}
                >
                  Previous
                </button>
                <span className="preview-counter">
                  {previewIndex + 1} of {spreadsheetRows.length}
                </span>
                <button
                  className="ghost"
                  onClick={() => setPreviewIndex((i) => Math.min(spreadsheetRows.length - 1, i + 1))}
                  disabled={previewIndex >= spreadsheetRows.length - 1}
                >
                  Next
                </button>
              </div>
              <button className="ghost" onClick={() => setShowPreview(false)}>
                Close
              </button>
            </div>
            <div className="preview-grid">
              <div className="preview-page">
                {activePage === 0 && (
                  <>
                    <div className="preview-header">
                      <div className="preview-return">
                        {returnLines[0] || returnLines[1] || returnLines[2] ? (
                          <>
                            <div>{returnLines[0]}</div>
                            <div>{returnLines[1]}</div>
                            <div>{returnLines[2]}</div>
                          </>
                        ) : (
                          <div className="preview-placeholder">No return address</div>
                        )}
                      </div>
                      <div className="preview-logo">
                        {selectedLogo?.imageUrl ? (
                          <img src={selectedLogo.imageUrl} alt={selectedLogo.label} />
                        ) : (
                          <div className="preview-placeholder">No logo</div>
                        )}
                      </div>
                    </div>
                    <div className="preview-mailing">
                      <div>{buildTleIndex().mailing_name}</div>
                      <div>{buildTleIndex().mailing_addr1}</div>
                      <div>{buildTleIndex().mailing_addr2}</div>
                      <div>{buildTleIndex().mailing_addr3}</div>
                    </div>
                  </>
                )}
                <div
                  className="preview-body"
                  dangerouslySetInnerHTML={{ __html: buildMergedHtml() }}
                />
              </div>
              <div className="preview-meta">
                <h4>TLE Index (Row {previewIndex + 1})</h4>
                {Object.entries(buildTleIndex()).map(([key, value]) => (
                  <div key={key} className="preview-row">
                    <span>{key}</span>
                    <span>{value}</span>
                  </div>
                ))}
                <div className="preview-actions">
                  <button className="secondary" onClick={() => setShowPreview(false)}>
                    Cancel
                  </button>
                  <button className="primary" onClick={handleGenerate} disabled={generating}>
                    {generating ? "Generating..." : "Generate AFP"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
