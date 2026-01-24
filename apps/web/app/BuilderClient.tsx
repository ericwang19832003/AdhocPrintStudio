"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { EditorClientHandle } from "./EditorClient";
import { EditorToolbar } from "./EditorClient";
import type { Editor } from "@tiptap/react";
import * as XLSX from "xlsx";
import DOMPurify from "isomorphic-dompurify";

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
      <p className="flyout-footer-hint">Cannot find what you need?</p>
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

// 15 Logo placeholders with varied styles and colors
const logoPlaceholders: LibraryItem[] = [
  { id: "logo-1", label: "APS Primary", type: "logo", imageUrl: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='70'><rect width='100%25' height='100%25' rx='14' fill='%23b84f2f'/><text x='50%25' y='55%25' text-anchor='middle' font-family='Arial' font-size='28' fill='white'>APS</text></svg>" },
  { id: "logo-2", label: "APS Monogram", type: "logo", imageUrl: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='70'><rect width='100%25' height='100%25' rx='14' fill='%231f1c18'/><text x='50%25' y='55%25' text-anchor='middle' font-family='Arial' font-size='28' fill='%23f6f1ea'>A</text></svg>" },
  { id: "logo-3", label: "APS Light", type: "logo", imageUrl: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='70'><rect width='100%25' height='100%25' rx='14' fill='%23f6f1ea' stroke='%23b84f2f' stroke-width='2'/><text x='50%25' y='55%25' text-anchor='middle' font-family='Arial' font-size='24' fill='%238c2e15'>APS</text></svg>" },
  { id: "logo-4", label: "APS Serif", type: "logo", imageUrl: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='70'><rect width='100%25' height='100%25' rx='14' fill='%23ffffff' stroke='%23e6dbcf' stroke-width='2'/><text x='50%25' y='55%25' text-anchor='middle' font-family='Georgia' font-size='24' fill='%231f1c18'>APS</text></svg>" },
  { id: "logo-5", label: "APS Outline", type: "logo", imageUrl: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='70'><rect width='100%25' height='100%25' rx='14' fill='%23ffffff' stroke='%231f1c18' stroke-width='2'/><text x='50%25' y='55%25' text-anchor='middle' font-family='Arial' font-size='22' fill='%231f1c18'>APS</text></svg>" },
  { id: "logo-6", label: "Acme Corp Blue", type: "logo", imageUrl: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='70'><rect width='100%25' height='100%25' rx='14' fill='%232563eb'/><text x='50%25' y='55%25' text-anchor='middle' font-family='Arial' font-size='20' fill='white'>ACME CORP</text></svg>" },
  { id: "logo-7", label: "Acme Corp Dark", type: "logo", imageUrl: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='70'><rect width='100%25' height='100%25' rx='14' fill='%23111827'/><text x='50%25' y='55%25' text-anchor='middle' font-family='Arial' font-size='20' fill='%2360a5fa'>ACME</text></svg>" },
  { id: "logo-8", label: "GlobalTech Green", type: "logo", imageUrl: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='70'><rect width='100%25' height='100%25' rx='14' fill='%2316a34a'/><text x='50%25' y='55%25' text-anchor='middle' font-family='Arial' font-size='18' fill='white'>GlobalTech</text></svg>" },
  { id: "logo-9", label: "FinServ Gold", type: "logo", imageUrl: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='70'><rect width='100%25' height='100%25' rx='14' fill='%23fbbf24'/><text x='50%25' y='55%25' text-anchor='middle' font-family='Georgia' font-size='20' fill='%23451a03'>FinServ</text></svg>" },
  { id: "logo-10", label: "HealthPlus Red", type: "logo", imageUrl: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='70'><rect width='100%25' height='100%25' rx='14' fill='%23dc2626'/><text x='50%25' y='55%25' text-anchor='middle' font-family='Arial' font-size='18' fill='white'>Health+</text></svg>" },
  { id: "logo-11", label: "InsureCo Purple", type: "logo", imageUrl: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='70'><rect width='100%25' height='100%25' rx='14' fill='%239333ea'/><text x='50%25' y='55%25' text-anchor='middle' font-family='Arial' font-size='18' fill='white'>InsureCo</text></svg>" },
  { id: "logo-12", label: "BankFirst Navy", type: "logo", imageUrl: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='70'><rect width='100%25' height='100%25' rx='14' fill='%231e3a5f'/><text x='50%25' y='55%25' text-anchor='middle' font-family='Georgia' font-size='18' fill='%23fcd34d'>BankFirst</text></svg>" },
  { id: "logo-13", label: "TechStart Orange", type: "logo", imageUrl: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='70'><rect width='100%25' height='100%25' rx='14' fill='%23ea580c'/><text x='50%25' y='55%25' text-anchor='middle' font-family='Arial' font-size='18' fill='white'>TechStart</text></svg>" },
  { id: "logo-14", label: "EduLearn Teal", type: "logo", imageUrl: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='70'><rect width='100%25' height='100%25' rx='14' fill='%230d9488'/><text x='50%25' y='55%25' text-anchor='middle' font-family='Arial' font-size='18' fill='white'>EduLearn</text></svg>" },
  { id: "logo-15", label: "RetailMax Pink", type: "logo", imageUrl: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='70'><rect width='100%25' height='100%25' rx='14' fill='%23db2777'/><text x='50%25' y='55%25' text-anchor='middle' font-family='Arial' font-size='18' fill='white'>RetailMax</text></svg>" },
];

// 20 Taglines with varied lengths (short to long)
const taglineSeed: LibraryItem[] = [
  { id: "tag-1", label: "Trusted since 1998", type: "tagline", content: "Trusted since 1998" },
  { id: "tag-2", label: "Delivering clarity", type: "tagline", content: "Delivering clarity" },
  { id: "tag-3", label: "Excellence.", type: "tagline", content: "Excellence." },
  { id: "tag-4", label: "Your success, our mission", type: "tagline", content: "Your success, our mission" },
  { id: "tag-5", label: "Innovation forward", type: "tagline", content: "Innovation forward" },
  { id: "tag-6", label: "Building tomorrow today", type: "tagline", content: "Building tomorrow today" },
  { id: "tag-7", label: "Where quality meets reliability and customer service excellence", type: "tagline", content: "Where quality meets reliability and customer service excellence" },
  { id: "tag-8", label: "Simply better", type: "tagline", content: "Simply better" },
  { id: "tag-9", label: "Precision print, personal touch", type: "tagline", content: "Precision print, personal touch" },
  { id: "tag-10", label: "Committed to your financial well-being since 1965", type: "tagline", content: "Committed to your financial well-being since 1965" },
  { id: "tag-11", label: "Fast. Reliable. Secure.", type: "tagline", content: "Fast. Reliable. Secure." },
  { id: "tag-12", label: "Empowering businesses worldwide with cutting-edge solutions", type: "tagline", content: "Empowering businesses worldwide with cutting-edge solutions" },
  { id: "tag-13", label: "Care you can count on", type: "tagline", content: "Care you can count on" },
  { id: "tag-14", label: "Leading the way", type: "tagline", content: "Leading the way" },
  { id: "tag-15", label: "Your partner in progress, dedicated to delivering results that matter", type: "tagline", content: "Your partner in progress, dedicated to delivering results that matter" },
  { id: "tag-16", label: "Think different", type: "tagline", content: "Think different" },
  { id: "tag-17", label: "Service beyond expectations", type: "tagline", content: "Service beyond expectations" },
  { id: "tag-18", label: "Connecting people, inspiring growth, transforming communities", type: "tagline", content: "Connecting people, inspiring growth, transforming communities" },
  { id: "tag-19", label: "Made for your message", type: "tagline", content: "Made for your message" },
  { id: "tag-20", label: "The trusted name in financial services for over five decades of excellence", type: "tagline", content: "The trusted name in financial services for over five decades of excellence" },
];

// 20 Return Addresses with varied formats (2-5 lines)
const returnAddressSeed: LibraryItem[] = [
  { id: "ret-1", label: "HQ - San Jose", type: "return", content: "APS HQ\n250 Market Street\nSan Jose, CA 95113" },
  { id: "ret-2", label: "East Coast Ops", type: "return", content: "APS East Coast\n44 Hanover Ave\nBoston, MA 02116" },
  { id: "ret-3", label: "Midwest Fulfillment", type: "return", content: "APS Midwest\n1200 Lakeview Dr\nChicago, IL 60601" },
  { id: "ret-4", label: "Southwest Print Hub", type: "return", content: "APS Southwest\n815 Copper Road\nPhoenix, AZ 85004" },
  { id: "ret-5", label: "Pacific NW Office", type: "return", content: "APS Pacific NW\n900 Rainier Blvd\nSeattle, WA 98104" },
  { id: "ret-6", label: "NYC Corporate", type: "return", content: "Acme Corporation\nAttn: Customer Service\n350 Fifth Avenue, Suite 4500\nNew York, NY 10118" },
  { id: "ret-7", label: "LA Branch", type: "return", content: "GlobalTech Inc.\n1000 Wilshire Blvd\nLos Angeles, CA 90017" },
  { id: "ret-8", label: "Denver Regional", type: "return", content: "FinServ Partners\nRegional Processing Center\n1700 Broadway, Floor 12\nDenver, CO 80202" },
  { id: "ret-9", label: "Atlanta Hub (Short)", type: "return", content: "HealthPlus\nAtlanta, GA 30301" },
  { id: "ret-10", label: "Miami Operations", type: "return", content: "InsureCo of Florida\nClaims Department\n100 SE 2nd Street\nMiami, FL 33131" },
  { id: "ret-11", label: "Dallas Center", type: "return", content: "BankFirst Texas\nP.O. Box 650001\nDallas, TX 75265-0001" },
  { id: "ret-12", label: "Portland Office", type: "return", content: "TechStart LLC\n121 SW Morrison St\nSuite 500\nPortland, OR 97204" },
  { id: "ret-13", label: "Minneapolis HQ", type: "return", content: "RetailMax Inc.\nCorporate Headquarters\n80 South 8th Street\nMinneapolis, MN 55402\nUSA" },
  { id: "ret-14", label: "PO Box Simple", type: "return", content: "EduLearn Corp\nP.O. Box 12345\nAustin, TX 78711" },
  { id: "ret-15", label: "Full Corporate (Long)", type: "return", content: "National Insurance Group\nCorporate Communications\nAttn: Policyholder Services\n500 Constitution Ave NW\nWashington, DC 20001" },
  { id: "ret-16", label: "San Diego Branch", type: "return", content: "Pacific Financial\n401 B Street\nSan Diego, CA 92101" },
  { id: "ret-17", label: "Philadelphia Center", type: "return", content: "Liberty Mutual Services\n1500 Market Street\nPhiladelphia, PA 19102" },
  { id: "ret-18", label: "Detroit Office", type: "return", content: "AutoServ Inc.\nCustomer Relations\n300 Renaissance Center\nDetroit, MI 48243" },
  { id: "ret-19", label: "Simple 2-Line", type: "return", content: "Quick Mail Co.\nOrlando, FL 32801" },
  { id: "ret-20", label: "International (Long)", type: "return", content: "Global Enterprises Ltd.\nInternational Division\n1 World Trade Center\nFloor 85\nNew York, NY 10007\nUnited States" },
];

// 25 Verbiage blocks with varied lengths (1 sentence to 4 sentences)
const verbiageSeed: LibraryItem[] = [
  { id: "verb-1", label: "Privacy notice", type: "verbiage", content: "We value your privacy. Your information is used only for account servicing and will not be shared without consent." },
  { id: "verb-2", label: "Late payment block", type: "verbiage", content: "Our records show an outstanding balance. Please remit payment within 10 days to avoid service interruption." },
  { id: "verb-3", label: "Billing assistance", type: "verbiage", content: "Need help with your bill? Call 800-555-0199, Monday through Friday, 8am-6pm, and we will assist you." },
  { id: "verb-4", label: "Opt-out instructions", type: "verbiage", content: "To opt out of paper delivery, visit your account settings or call customer care at 800-555-0177." },
  { id: "verb-5", label: "Account update reminder", type: "verbiage", content: "Please review your contact details to ensure your statements are delivered to the correct address." },
  { id: "verb-6", label: "Thank you (Short)", type: "verbiage", content: "Thank you for your business." },
  { id: "verb-7", label: "Contact us", type: "verbiage", content: "Questions? Contact us at support@example.com or call 1-800-555-0123." },
  { id: "verb-8", label: "Legal disclaimer (Long)", type: "verbiage", content: "This document contains confidential information intended only for the named recipient. If you have received this in error, please notify the sender immediately and delete all copies. Unauthorized use, disclosure, or distribution is prohibited and may be unlawful. The sender accepts no liability for any damages arising from the unauthorized use of this information." },
  { id: "verb-9", label: "Payment due", type: "verbiage", content: "Payment is due within 30 days of the statement date." },
  { id: "verb-10", label: "Autopay enrollment", type: "verbiage", content: "Enroll in AutoPay for worry-free payments. Your payment will be automatically deducted on the due date, ensuring you never miss a payment. Sign up online at myaccount.example.com or call our automated line at 800-555-0188." },
  { id: "verb-11", label: "Rate change notice", type: "verbiage", content: "Please be advised that your interest rate may change based on market conditions. Review your account terms for details." },
  { id: "verb-12", label: "Paperless invitation", type: "verbiage", content: "Go green with paperless statements! Switch to electronic delivery and receive your statements faster, reduce clutter, and help the environment." },
  { id: "verb-13", label: "Fraud alert", type: "verbiage", content: "Protect yourself from fraud. Never share your account number, PIN, or password with anyone claiming to be from our company. We will never ask for this information via email or phone." },
  { id: "verb-14", label: "Service hours", type: "verbiage", content: "Our customer service team is available Monday through Friday, 8:00 AM to 8:00 PM EST, and Saturday, 9:00 AM to 5:00 PM EST." },
  { id: "verb-15", label: "Minimum payment", type: "verbiage", content: "Paying only the minimum amount due will result in higher interest charges and a longer time to pay off your balance." },
  { id: "verb-16", label: "Credit score impact", type: "verbiage", content: "Late payments may be reported to credit bureaus and could negatively impact your credit score. Please ensure timely payment to maintain good standing." },
  { id: "verb-17", label: "Rewards program", type: "verbiage", content: "Earn points on every purchase! Redeem for cash back, travel, merchandise, and more. Visit rewards.example.com to view your balance and redeem points." },
  { id: "verb-18", label: "Address change", type: "verbiage", content: "Moving? Update your address online or call us to ensure uninterrupted service." },
  { id: "verb-19", label: "Dispute instructions", type: "verbiage", content: "If you believe there is an error on your statement, write to us at the address shown within 60 days. Include your name, account number, the dollar amount of the suspected error, and a description of the problem." },
  { id: "verb-20", label: "Security reminder", type: "verbiage", content: "For your security, always sign out of your online account when finished. Use strong, unique passwords and enable two-factor authentication when available." },
  { id: "verb-21", label: "Grace period", type: "verbiage", content: "You have a 21-day grace period on new purchases when you pay your balance in full each month." },
  { id: "verb-22", label: "Fee disclosure", type: "verbiage", content: "A late fee of up to $40 may be charged if your minimum payment is not received by the due date." },
  { id: "verb-23", label: "Balance transfer offer", type: "verbiage", content: "Transfer your high-interest balances and enjoy 0% APR for 12 months. A 3% transfer fee applies. Offer expires December 31, 2026." },
  { id: "verb-24", label: "Annual fee notice", type: "verbiage", content: "Your annual membership fee of $95 will appear on your next statement." },
  { id: "verb-25", label: "HIPAA notice (Long)", type: "verbiage", content: "This notice describes how medical information about you may be used and disclosed and how you can get access to this information. Please review it carefully. We are required by law to maintain the privacy of your protected health information, provide you with notice of our legal duties and privacy practices, and notify you following a breach of unsecured protected health information." },
];

// 20 Full Letters with varied lengths (2 paragraphs to 6 paragraphs)
const fullLetterSeed: LibraryItem[] = [
  { id: "full-1", label: "Dunning Letter A", type: "full-letter", content: "Hello [Customer Name],\n\nOur records indicate your account has an overdue balance. Please submit payment at your earliest convenience to avoid any disruption.\n\nIf you have already sent payment, please disregard this notice." },
  { id: "full-2", label: "Welcome Letter", type: "full-letter", content: "Welcome to APS!\n\nWe are pleased to have you with us. This letter confirms your enrollment and provides information about how to manage your account online." },
  { id: "full-3", label: "Policy Update Notice", type: "full-letter", content: "We are writing to inform you of updates to our service terms. These changes take effect on the first of next month. Please review the enclosed summary for details." },
  { id: "full-4", label: "Service Confirmation", type: "full-letter", content: "This letter confirms your recent service request. Our team will process your request within 3 business days and notify you once complete." },
  { id: "full-5", label: "Annual Statement Cover", type: "full-letter", content: "Enclosed is your annual statement. Please review it carefully and contact us if any information appears incorrect." },
  { id: "full-6", label: "Account Closure Confirmation", type: "full-letter", content: "Dear Valued Customer,\n\nThis letter confirms that your account has been closed as requested. Any remaining balance has been refunded to your original payment method.\n\nWe appreciate the opportunity to serve you and hope you will consider us again in the future.\n\nThank you for your business." },
  { id: "full-7", label: "Payment Plan Offer", type: "full-letter", content: "Dear [Customer Name],\n\nWe understand that financial circumstances can change. If you are having difficulty paying your balance, we want to help.\n\nWe are pleased to offer you a payment plan that allows you to pay your balance over time. Please call us at 800-555-0199 to discuss your options.\n\nOur goal is to work with you to find a solution that fits your budget." },
  { id: "full-8", label: "Rate Increase Notice (Long)", type: "full-letter", content: "Important Notice Regarding Your Account\n\nDear [Customer Name],\n\nWe are writing to inform you of changes to your account terms. Effective [Date], your Annual Percentage Rate (APR) will increase from [Current Rate] to [New Rate].\n\nThis change is being made due to market conditions and applies to new purchases made after the effective date. Your current balance will continue to accrue interest at your existing rate.\n\nYou have the right to reject this change by notifying us in writing before [Opt-Out Date]. If you reject, you may use your account under the current terms until the end of your current membership year, but your account will be closed for future transactions.\n\nIf you have questions about this notice, please call us at 800-555-0199.\n\nThank you for being a valued customer." },
  { id: "full-9", label: "Renewal Notice", type: "full-letter", content: "Dear Member,\n\nYour membership is up for renewal. To continue enjoying your benefits, please renew by [Date].\n\nYou can renew online at myaccount.example.com or by calling 800-555-0199." },
  { id: "full-10", label: "Collections Final Notice", type: "full-letter", content: "FINAL NOTICE\n\nDear [Customer Name],\n\nDespite our previous attempts to contact you, your account remains seriously past due. The total amount owed is [Amount].\n\nUnless we receive payment in full or hear from you within 10 days of this letter, we will have no choice but to refer your account to a collection agency. This action may negatively impact your credit score.\n\nPlease contact us immediately at 800-555-0199 to discuss your options.\n\nWe hope to resolve this matter without further action." },
  { id: "full-11", label: "Thank You Letter", type: "full-letter", content: "Dear [Customer Name],\n\nThank you for your recent purchase. We truly appreciate your business and hope you are satisfied with your order.\n\nIf you have any questions or concerns, please don't hesitate to reach out. We're here to help." },
  { id: "full-12", label: "Insurance Claim Acknowledgment", type: "full-letter", content: "Re: Claim Number [Claim ID]\n\nDear [Policyholder Name],\n\nWe have received your claim dated [Date] and it is currently being reviewed. A claims adjuster will contact you within 5-7 business days.\n\nIn the meantime, please gather any additional documentation that may support your claim, including photos, receipts, and police reports if applicable.\n\nThank you for your patience during this process." },
  { id: "full-13", label: "Benefits Enrollment Reminder", type: "full-letter", content: "Important: Open Enrollment Ends Soon\n\nDear Employee,\n\nThis is a reminder that open enrollment for employee benefits ends on [Date]. If you wish to make changes to your health insurance, dental, vision, or retirement plans, you must do so before the deadline.\n\nTo review your options and make elections, visit benefits.company.com or contact HR at ext. 4500.\n\nIf you do not make any changes, your current elections will continue for the next plan year.\n\nPlease take action before the deadline to ensure your coverage meets your needs." },
  { id: "full-14", label: "Address Verification Request", type: "full-letter", content: "Dear [Customer Name],\n\nWe recently attempted to deliver important documents to your address on file, but they were returned as undeliverable.\n\nPlease verify and update your mailing address by calling 800-555-0199 or logging into your account online.\n\nUntil we receive your updated information, we may be unable to send you important account notices." },
  { id: "full-15", label: "Loan Approval Letter", type: "full-letter", content: "Congratulations!\n\nDear [Applicant Name],\n\nWe are pleased to inform you that your loan application has been approved. The details of your loan are as follows:\n\nLoan Amount: [Amount]\nInterest Rate: [Rate]\nTerm: [Term]\nMonthly Payment: [Payment]\n\nPlease review the enclosed documents carefully and sign where indicated. Return the signed documents within 10 business days to finalize your loan.\n\nIf you have any questions, please contact your loan officer at [Phone].\n\nThank you for choosing us for your financial needs." },
  { id: "full-16", label: "Service Interruption Notice", type: "full-letter", content: "Service Interruption Notice\n\nDear Customer,\n\nDue to scheduled maintenance, your service will be temporarily unavailable on [Date] from [Start Time] to [End Time].\n\nWe apologize for any inconvenience this may cause and appreciate your patience." },
  { id: "full-17", label: "Referral Program Invitation", type: "full-letter", content: "Share the Savings!\n\nDear [Customer Name],\n\nWe hope you're enjoying your experience with us. Did you know you can earn rewards by referring friends and family?\n\nFor every new customer you refer, you'll receive a $50 credit on your account, and your friend will receive $25 off their first purchase.\n\nSimply share your unique referral code [CODE] or visit referrals.example.com to get started.\n\nThere's no limit to how much you can earn. Start referring today!" },
  { id: "full-18", label: "Privacy Policy Update (Long)", type: "full-letter", content: "Notice of Privacy Policy Changes\n\nDear [Customer Name],\n\nWe are committed to protecting your personal information. This notice is to inform you of updates to our Privacy Policy, effective [Date].\n\nKey changes include:\n\n• How we collect and use your information\n• Your choices regarding data sharing\n• Enhanced security measures we have implemented\n• Your rights under applicable privacy laws\n\nThe updated policy is available at privacy.example.com or by calling 800-555-0199 to request a printed copy.\n\nThese changes reflect our ongoing commitment to transparency and your privacy rights. No action is required on your part, but we encourage you to review the updated policy.\n\nIf you have questions or concerns, please contact our Privacy Office at privacy@example.com.\n\nThank you for trusting us with your information." },
  { id: "full-19", label: "Appointment Reminder", type: "full-letter", content: "Appointment Reminder\n\nDear [Patient Name],\n\nThis is a reminder of your upcoming appointment:\n\nDate: [Date]\nTime: [Time]\nLocation: [Address]\n\nPlease arrive 15 minutes early to complete any necessary paperwork. Remember to bring your insurance card and photo ID.\n\nIf you need to reschedule, please call us at least 24 hours in advance." },
  { id: "full-20", label: "Warranty Expiration Notice", type: "full-letter", content: "Warranty Expiration Notice\n\nDear [Customer Name],\n\nThe warranty on your [Product Name] (Serial: [Serial Number]) will expire on [Date].\n\nTo continue protecting your investment, consider purchasing an extended warranty. Our extended coverage plans offer:\n\n• Full parts and labor coverage\n• No deductibles\n• 24/7 customer support\n• Transferable coverage if you sell the product\n\nVisit warranty.example.com or call 800-555-0199 before your warranty expires to take advantage of special pricing available only to existing customers.\n\nDon't wait until it's too late to protect your purchase." },
];

const librarySeed: Record<string, LibraryItem[]> = {
  Logos: [...logoPlaceholders],
  Taglines: [...taglineSeed],
  "Return Address": [...returnAddressSeed],
  Verbiage: [...verbiageSeed],
  "Full Letters": [...fullLetterSeed],
};

const tabs = Object.keys(librarySeed);
const libraryButtons = [
  { label: "Logo", tab: "Logos", icon: "🏷️" },
  { label: "Return Address", tab: "Return Address", icon: "📍" },
  { label: "Verbiage", tab: "Verbiage", icon: "💬" },
  { label: "Tagline", tab: "Taglines", icon: "✨" },
  { label: "Letter Template", tab: "Full Letters", icon: "📄" },
] as const;

function createBlock(item: LibraryItem, x: number, y: number): PlacedBlock | null {
  if (item.type === "logo" || item.type === "return") {
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

  // Dynamic asset selection state
  const [logoMode, setLogoMode] = useState<"static" | "dynamic">("static");
  const [logoColumn, setLogoColumn] = useState<string>("");
  const [logoValueMap, setLogoValueMap] = useState<Record<string, string>>({});

  const [taglineMode, setTaglineMode] = useState<"static" | "dynamic">("static");
  const [taglineColumn, setTaglineColumn] = useState<string>("");
  const [taglineValueMap, setTaglineValueMap] = useState<Record<string, string>>({});

  const [returnMode, setReturnMode] = useState<"static" | "dynamic">("static");
  const [returnColumn, setReturnColumn] = useState<string>("");
  const [returnValueMap, setReturnValueMap] = useState<Record<string, string>>({});

  const [pages, setPages] = useState(["Page 1"]);
  const [activePage, setActivePage] = useState(0);
  const [blocksByPage, setBlocksByPage] = useState<Record<number, PlacedBlock[]>>({
    0: [],
  });
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [openMenuTab, setOpenMenuTab] = useState<string | null>(null);
  const [flyoutQuery, setFlyoutQuery] = useState("");

  // Library UX improvements: Recently Used, Favorites, Sorting
  const [recentlyUsedLogos, setRecentlyUsedLogos] = useState<string[]>([]);
  const [favoriteLogos, setFavoriteLogos] = useState<string[]>([]);
  const [logoSortOrder, setLogoSortOrder] = useState<"recent" | "a-z" | "favorites">("recent");

  const [recentlyUsedReturns, setRecentlyUsedReturns] = useState<string[]>([]);
  const [favoriteReturns, setFavoriteReturns] = useState<string[]>([]);
  const [returnSortOrder, setReturnSortOrder] = useState<"recent" | "a-z" | "favorites">("recent");

  const [recentlyUsedTaglines, setRecentlyUsedTaglines] = useState<string[]>([]);
  const [favoriteTaglines, setFavoriteTaglines] = useState<string[]>([]);
  const [taglineSortOrder, setTaglineSortOrder] = useState<"recent" | "a-z" | "favorites">("recent");

  const [recentlyUsedVerbiage, setRecentlyUsedVerbiage] = useState<string[]>([]);
  const [favoriteVerbiage, setFavoriteVerbiage] = useState<string[]>([]);
  const [verbiageSortOrder, setVerbiageSortOrder] = useState<"recent" | "a-z" | "favorites">("recent");

  const [recentlyUsedTemplates, setRecentlyUsedTemplates] = useState<string[]>([]);
  const [favoriteTemplates, setFavoriteTemplates] = useState<string[]>([]);
  const [templateSortOrder, setTemplateSortOrder] = useState<"recent" | "a-z" | "favorites">("recent");
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
  const [showGrid, setShowGrid] = useState(false);
  const [spreadsheetName, setSpreadsheetName] = useState<string | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [placeholderMap, setPlaceholderMap] = useState<Record<string, string>>({});
  const [spreadsheetContent, setSpreadsheetContent] = useState<string>("");
  const [generating, setGenerating] = useState(false);
  const [outputFormat, setOutputFormat] = useState<"afp" | "pdf">("afp");
  const [spreadsheetLoading, setSpreadsheetLoading] = useState(false);
  const [spreadsheetError, setSpreadsheetError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isDraggingLibraryItem, setIsDraggingLibraryItem] = useState(false);
  const [dragItemType, setDragItemType] = useState<string | null>(null);
  const [showDragTooltip, setShowDragTooltip] = useState(() => {
    if (typeof window !== "undefined") {
      return !localStorage.getItem("dragTooltipDismissed");
    }
    return true;
  });
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
  const [editorInstance, setEditorInstance] = useState<Editor | null>(null);
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

  // Track editor instance for toolbar
  useEffect(() => {
    const checkEditor = () => {
      const editor = editorRef.current?.getEditor();
      if (editor && editor !== editorInstance) {
        setEditorInstance(editor);
      }
    };
    // Check immediately and then poll until editor is available
    checkEditor();
    const interval = setInterval(checkEditor, 100);
    return () => clearInterval(interval);
  }, [editorInstance]);

  // Load library preferences from localStorage
  useEffect(() => {
    try {
      // Logos
      const savedRecentLogos = localStorage.getItem("recentlyUsedLogos");
      const savedFavoriteLogos = localStorage.getItem("favoriteLogos");
      if (savedRecentLogos) setRecentlyUsedLogos(JSON.parse(savedRecentLogos));
      if (savedFavoriteLogos) setFavoriteLogos(JSON.parse(savedFavoriteLogos));

      // Returns
      const savedRecentReturns = localStorage.getItem("recentlyUsedReturns");
      const savedFavoriteReturns = localStorage.getItem("favoriteReturns");
      if (savedRecentReturns) setRecentlyUsedReturns(JSON.parse(savedRecentReturns));
      if (savedFavoriteReturns) setFavoriteReturns(JSON.parse(savedFavoriteReturns));

      // Taglines
      const savedRecentTaglines = localStorage.getItem("recentlyUsedTaglines");
      const savedFavoriteTaglines = localStorage.getItem("favoriteTaglines");
      if (savedRecentTaglines) setRecentlyUsedTaglines(JSON.parse(savedRecentTaglines));
      if (savedFavoriteTaglines) setFavoriteTaglines(JSON.parse(savedFavoriteTaglines));

      // Verbiage
      const savedRecentVerbiage = localStorage.getItem("recentlyUsedVerbiage");
      const savedFavoriteVerbiage = localStorage.getItem("favoriteVerbiage");
      if (savedRecentVerbiage) setRecentlyUsedVerbiage(JSON.parse(savedRecentVerbiage));
      if (savedFavoriteVerbiage) setFavoriteVerbiage(JSON.parse(savedFavoriteVerbiage));

      // Templates
      const savedRecentTemplates = localStorage.getItem("recentlyUsedTemplates");
      const savedFavoriteTemplates = localStorage.getItem("favoriteTemplates");
      if (savedRecentTemplates) setRecentlyUsedTemplates(JSON.parse(savedRecentTemplates));
      if (savedFavoriteTemplates) setFavoriteTemplates(JSON.parse(savedFavoriteTemplates));
    } catch (e) {
      console.error("Failed to load library preferences:", e);
    }
  }, []);

  // Save recently used items to localStorage
  useEffect(() => {
    if (recentlyUsedLogos.length > 0) localStorage.setItem("recentlyUsedLogos", JSON.stringify(recentlyUsedLogos));
  }, [recentlyUsedLogos]);
  useEffect(() => {
    if (recentlyUsedReturns.length > 0) localStorage.setItem("recentlyUsedReturns", JSON.stringify(recentlyUsedReturns));
  }, [recentlyUsedReturns]);
  useEffect(() => {
    if (recentlyUsedTaglines.length > 0) localStorage.setItem("recentlyUsedTaglines", JSON.stringify(recentlyUsedTaglines));
  }, [recentlyUsedTaglines]);
  useEffect(() => {
    if (recentlyUsedVerbiage.length > 0) localStorage.setItem("recentlyUsedVerbiage", JSON.stringify(recentlyUsedVerbiage));
  }, [recentlyUsedVerbiage]);
  useEffect(() => {
    if (recentlyUsedTemplates.length > 0) localStorage.setItem("recentlyUsedTemplates", JSON.stringify(recentlyUsedTemplates));
  }, [recentlyUsedTemplates]);

  // Save favorites to localStorage
  useEffect(() => { localStorage.setItem("favoriteLogos", JSON.stringify(favoriteLogos)); }, [favoriteLogos]);
  useEffect(() => { localStorage.setItem("favoriteReturns", JSON.stringify(favoriteReturns)); }, [favoriteReturns]);
  useEffect(() => { localStorage.setItem("favoriteTaglines", JSON.stringify(favoriteTaglines)); }, [favoriteTaglines]);
  useEffect(() => { localStorage.setItem("favoriteVerbiage", JSON.stringify(favoriteVerbiage)); }, [favoriteVerbiage]);
  useEffect(() => { localStorage.setItem("favoriteTemplates", JSON.stringify(favoriteTemplates)); }, [favoriteTemplates]);

  // Track usage for "Recently Used" sections
  const trackLogoUsage = (id: string) => {
    setRecentlyUsedLogos((prev) => [id, ...prev.filter((x) => x !== id)].slice(0, 5));
  };
  const trackReturnUsage = (id: string) => {
    setRecentlyUsedReturns((prev) => [id, ...prev.filter((x) => x !== id)].slice(0, 5));
  };
  const trackTaglineUsage = (id: string) => {
    setRecentlyUsedTaglines((prev) => [id, ...prev.filter((x) => x !== id)].slice(0, 5));
  };
  const trackVerbiageUsage = (id: string) => {
    setRecentlyUsedVerbiage((prev) => [id, ...prev.filter((x) => x !== id)].slice(0, 5));
  };
  const trackTemplateUsage = (id: string) => {
    setRecentlyUsedTemplates((prev) => [id, ...prev.filter((x) => x !== id)].slice(0, 5));
  };

  // Toggle favorite status
  const toggleLogoFavorite = (id: string, event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    setFavoriteLogos((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };
  const toggleReturnFavorite = (id: string, event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    setFavoriteReturns((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };
  const toggleTaglineFavorite = (id: string, event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    setFavoriteTaglines((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };
  const toggleVerbiageFavorite = (id: string, event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    setFavoriteVerbiage((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };
  const toggleTemplateFavorite = (id: string, event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    setFavoriteTemplates((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

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
    setIsDraggingLibraryItem(true);
    setDragItemType(item.type ?? null);
    const ghost = document.createElement("div");
    ghost.style.width = "1px";
    ghost.style.height = "1px";
    ghost.style.opacity = "0";
    document.body.appendChild(ghost);
    event.dataTransfer.setDragImage(ghost, 0, 0);
    setTimeout(() => ghost.remove(), 0);
  };

  const handleDragEnd = () => {
    setIsDraggingLibraryItem(false);
    setDragItemType(null);
  };

  const dismissDragTooltip = () => {
    setShowDragTooltip(false);
    localStorage.setItem("dragTooltipDismissed", "true");
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

  const handleExportWord = () => {
    // Get current letter content
    const bodyContent = bodyContentByPage[activePage] ?? "";
    const returnAddress = selectedReturn?.content ?? selectedReturn?.label ?? "";
    const selectedTagline = selectedTaglineByPage[activePage];
    const tagline = selectedTagline?.content ?? selectedTagline?.label ?? "";
    const logoUrl = selectedLogo?.imageUrl ?? "";

    // Build Word-compatible HTML
    const wordContent = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: "Times New Roman", Times, serif; font-size: 12pt; line-height: 1.5; margin: 1in; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24pt; }
          .return-address { flex: 1; }
          .logo { max-width: 150px; max-height: 80px; }
          .body-content { margin-bottom: 24pt; }
          .tagline { font-style: italic; color: #666; margin-top: 24pt; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="return-address">${returnAddress ? returnAddress.replace(/\n/g, "<br>") : ""}</div>
          ${logoUrl ? `<img class="logo" src="${logoUrl}" alt="Logo" />` : ""}
        </div>
        <div class="body-content">${bodyContent}</div>
        ${tagline ? `<div class="tagline">${tagline}</div>` : ""}
      </body>
      </html>
    `;

    // Create and download file
    const blob = new Blob([wordContent], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "letter-template.doc";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSaveToLibrary = () => {
    const bodyContent = bodyContentByPage[activePage] ?? "";
    if (!bodyContent.trim()) {
      alert("Cannot save empty letter. Please add some content first.");
      return;
    }

    // Strip HTML tags for plain text content
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = bodyContent;
    const plainText = tempDiv.textContent || tempDiv.innerText || "";

    // Create a new full letter item
    const newLetter: LibraryItem = {
      id: `letter-saved-${Date.now()}`,
      label: `Saved Letter ${new Date().toLocaleDateString()}`,
      type: "full-letter",
      content: plainText.trim(),
    };

    // Add to library
    setLibrary((prev) => ({
      ...prev,
      "full-letter": [...(prev["full-letter"] ?? []), newLetter],
    }));

    alert("Letter saved to Full Letters library!");
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
    // Track usage for "Recently Used" feature
    if (item.type === "logo") trackLogoUsage(item.id);
    else if (item.type === "return") trackReturnUsage(item.id);
    else if (item.type === "tagline") trackTaglineUsage(item.id);
    else if (item.type === "verbiage") trackVerbiageUsage(item.id);
    else if (item.type === "full-letter") trackTemplateUsage(item.id);

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
      const fileName = file.name.toLowerCase();

      if (fileName.endsWith(".xlsx")) {
        // Parse XLSX client-side using xlsx library
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        // Convert to CSV
        const csvContent = XLSX.utils.sheet_to_csv(worksheet);

        // Extract columns from first row
        const [headerLine] = csvContent.split(/\r?\n/);
        const parsedColumns = headerLine
          ? headerLine.split(",").map((value) => value.trim()).filter(Boolean)
          : [];

        setSpreadsheetContent(csvContent);
        setSpreadsheetName(file.name);
        setColumns(parsedColumns.length > 0 ? parsedColumns : []);
        setSpreadsheetLoading(false);
        return;
      }

      if (fileName.endsWith(".xml")) {
        // Send XML to backend for parsing (handles complex nested structures)
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/print-output/columns", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.detail || "Failed to parse XML file");
        }

        const result = await response.json();
        setSpreadsheetContent(result.csv || "");
        setSpreadsheetName(file.name);
        setColumns(result.columns || []);
        setSpreadsheetLoading(false);
        return;
      }

      if (fileName.endsWith(".json")) {
        // Parse JSON client-side
        const text = await file.text();
        const jsonData = JSON.parse(text);

        // Helper to flatten nested objects
        const flattenObject = (obj: Record<string, unknown>, prefix = ""): Record<string, string> => {
          const result: Record<string, string> = {};
          for (const [key, value] of Object.entries(obj)) {
            const newKey = prefix ? `${prefix}_${key}` : key;
            if (value && typeof value === "object" && !Array.isArray(value)) {
              Object.assign(result, flattenObject(value as Record<string, unknown>, newKey));
            } else {
              result[newKey] = value === null || value === undefined ? "" : String(value);
            }
          }
          return result;
        };

        // Detect JSON structure and extract records
        let records: Record<string, unknown>[] = [];
        if (Array.isArray(jsonData)) {
          records = jsonData;
        } else if (typeof jsonData === "object" && jsonData !== null) {
          // Look for common data array keys
          const dataKeys = ["data", "records", "items", "rows", "results"];
          for (const key of dataKeys) {
            if (Array.isArray(jsonData[key])) {
              records = jsonData[key];
              break;
            }
          }
          // If no data array found, check if it's a single record
          if (records.length === 0 && Object.keys(jsonData).length > 0) {
            // Check if first value is an array (might be keyed by something else)
            const firstArrayKey = Object.keys(jsonData).find((k) => Array.isArray(jsonData[k]));
            if (firstArrayKey) {
              records = jsonData[firstArrayKey];
            } else {
              records = [jsonData]; // Treat as single record
            }
          }
        }

        if (records.length === 0) {
          throw new Error("No records found in JSON file");
        }

        // Flatten all records and extract columns
        const flattenedRecords = records.map((record) =>
          flattenObject(record as Record<string, unknown>)
        );
        const parsedColumns = Array.from(
          new Set(flattenedRecords.flatMap((record) => Object.keys(record)))
        );

        // Convert to CSV
        const escapeCSV = (value: string) => {
          if (value.includes(",") || value.includes('"') || value.includes("\n")) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        };

        const csvLines = [
          parsedColumns.map(escapeCSV).join(","),
          ...flattenedRecords.map((record) =>
            parsedColumns.map((col) => escapeCSV(record[col] ?? "")).join(",")
          ),
        ];
        const csvContent = csvLines.join("\n");

        setSpreadsheetContent(csvContent);
        setSpreadsheetName(file.name);
        setColumns(parsedColumns);
        setSpreadsheetLoading(false);
        return;
      }

      // Handle CSV files
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

  // Auto-match: compute suggested mappings between placeholders and columns
  const autoMatchSuggestions = useMemo(() => {
    if (placeholders.length === 0 || columns.length === 0) return [];

    const normalizeString = (str: string) =>
      str.replace(/[_\-\s]/g, "").toLowerCase();

    const suggestions: Array<{
      placeholder: string;
      column: string;
      confidence: "high" | "medium";
    }> = [];

    for (const placeholder of placeholders) {
      // Skip if already mapped
      if (placeholderMap[placeholder]) continue;

      const key = placeholder.replace(/^\[|\]$/g, "");

      // 1. Exact match (high confidence)
      if (columns.includes(key)) {
        suggestions.push({ placeholder, column: key, confidence: "high" });
        continue;
      }

      // 2. Case-insensitive match (high confidence)
      const caseMatch = columns.find(
        (col) => col.toLowerCase() === key.toLowerCase()
      );
      if (caseMatch) {
        suggestions.push({ placeholder, column: caseMatch, confidence: "high" });
        continue;
      }

      // 3. Normalized match - handles underscore/camelCase/hyphen differences (medium confidence)
      const normalizedKey = normalizeString(key);
      const normalizedMatch = columns.find(
        (col) => normalizeString(col) === normalizedKey
      );
      if (normalizedMatch) {
        suggestions.push({ placeholder, column: normalizedMatch, confidence: "medium" });
      }
    }

    return suggestions;
  }, [placeholders, columns, placeholderMap]);

  // Apply a single auto-match suggestion
  const applyAutoMatch = (placeholder: string, column: string) => {
    setPlaceholderMap((prev) => ({ ...prev, [placeholder]: column }));
  };

  // Apply all auto-match suggestions
  const applyAllAutoMatches = () => {
    setPlaceholderMap((prev) => {
      const next = { ...prev };
      for (const suggestion of autoMatchSuggestions) {
        next[suggestion.placeholder] = suggestion.column;
      }
      return next;
    });
  };

  const bodyIsEmpty = useMemo(() => {
    const htmlText = stripInlineControls(bodyContentByPage[activePage] ?? "");
    return htmlText.replace(/<[^>]*>/g, "").trim().length === 0;
  }, [activePage, bodyContentByPage]);

  const returnLines = useMemo(() => {
    const content = selectedReturn?.content ?? "";
    const lines = content.split("\n").map((line) => line.trim()).filter(Boolean);
    return [lines[0] ?? "", lines[1] ?? "", lines[2] ?? ""];
  }, [selectedReturn]);

  // Get return lines for a specific row (for preview)
  const getReturnLinesForRow = (rowIndex: number): string[] => {
    const returnItem = getReturnForRow(rowIndex);
    const content = returnItem?.content ?? "";
    const lines = content.split("\n").map((line) => line.trim()).filter(Boolean);
    return [lines[0] ?? "", lines[1] ?? "", lines[2] ?? ""];
  };

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

  // Extract unique values for dynamic asset columns
  const getUniqueValuesForColumn = (column: string) => {
    if (!column || !spreadsheetRows.length) return [];
    const values = new Set<string>();
    for (const row of spreadsheetRows) {
      const val = row[column]?.trim();
      if (val) values.add(val);
    }
    return Array.from(values).sort();
  };

  const uniqueLogoValues = useMemo(
    () => getUniqueValuesForColumn(logoColumn),
    [logoColumn, spreadsheetRows]
  );

  const uniqueTaglineValues = useMemo(
    () => getUniqueValuesForColumn(taglineColumn),
    [taglineColumn, spreadsheetRows]
  );

  const uniqueReturnValues = useMemo(
    () => getUniqueValuesForColumn(returnColumn),
    [returnColumn, spreadsheetRows]
  );

  // Auto-match function for library items
  const autoMatchAssets = (
    uniqueValues: string[],
    libraryItems: LibraryItem[]
  ): Record<string, string> => {
    const matches: Record<string, string> = {};
    const normalizeStr = (s: string) => s.toLowerCase().replace(/[_\-\s]/g, "");

    for (const value of uniqueValues) {
      const normalizedValue = normalizeStr(value);

      // Strategy 1: Exact match (case-insensitive)
      let match = libraryItems.find(
        (item) => item.label.toLowerCase() === value.toLowerCase()
      );

      // Strategy 2: Normalized match
      if (!match) {
        match = libraryItems.find(
          (item) => normalizeStr(item.label) === normalizedValue
        );
      }

      // Strategy 3: Contains match
      if (!match) {
        match = libraryItems.find(
          (item) =>
            normalizeStr(item.label).includes(normalizedValue) ||
            normalizedValue.includes(normalizeStr(item.label))
        );
      }

      if (match) matches[value] = match.id;
    }

    return matches;
  };

  // Auto-compute matches when column or library changes
  const autoMatchedLogos = useMemo(
    () => autoMatchAssets(uniqueLogoValues, library.Logos ?? []),
    [uniqueLogoValues, library.Logos]
  );

  const autoMatchedTaglines = useMemo(
    () => autoMatchAssets(uniqueTaglineValues, library.Taglines ?? []),
    [uniqueTaglineValues, library.Taglines]
  );

  const autoMatchedReturns = useMemo(
    () => autoMatchAssets(uniqueReturnValues, library["Return Address"] ?? []),
    [uniqueReturnValues, library]
  );

  // Apply auto-matches when column changes
  useEffect(() => {
    if (logoColumn && uniqueLogoValues.length > 0) {
      setLogoValueMap((prev) => ({ ...autoMatchedLogos, ...prev }));
    }
  }, [logoColumn, autoMatchedLogos]);

  useEffect(() => {
    if (taglineColumn && uniqueTaglineValues.length > 0) {
      setTaglineValueMap((prev) => ({ ...autoMatchedTaglines, ...prev }));
    }
  }, [taglineColumn, autoMatchedTaglines]);

  useEffect(() => {
    if (returnColumn && uniqueReturnValues.length > 0) {
      setReturnValueMap((prev) => ({ ...autoMatchedReturns, ...prev }));
    }
  }, [returnColumn, autoMatchedReturns]);

  // Get dynamic asset for a specific row
  const getLogoForRow = (rowIndex: number): LibraryItem | null => {
    if (logoMode === "static") return selectedLogo;
    const row = spreadsheetRows[rowIndex];
    const value = row?.[logoColumn];
    const logoId = logoValueMap[value];
    return (library.Logos ?? []).find((logo) => logo.id === logoId) ?? null;
  };

  const getTaglineForRow = (rowIndex: number): LibraryItem | null => {
    if (taglineMode === "static") return selectedTaglineByPage[activePage];
    const row = spreadsheetRows[rowIndex];
    const value = row?.[taglineColumn];
    const taglineId = taglineValueMap[value];
    return (library.Taglines ?? []).find((t) => t.id === taglineId) ?? null;
  };

  const getReturnForRow = (rowIndex: number): LibraryItem | null => {
    if (returnMode === "static") return selectedReturn;
    const row = spreadsheetRows[rowIndex];
    const value = row?.[returnColumn];
    const returnId = returnValueMap[value];
    return (library["Return Address"] ?? []).find((r) => r.id === returnId) ?? null;
  };

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

  const handleGenerate = async (format: "afp" | "pdf" = outputFormat) => {
    if (!spreadsheetContent) {
      alert("Please upload a spreadsheet first.");
      return;
    }
    setGenerating(true);
    try {
      // Build dynamic asset mappings (value -> content/URL)
      const buildDynamicLogoMap = () => {
        if (logoMode === "static") return null;
        const map: Record<string, string> = {};
        for (const [value, logoId] of Object.entries(logoValueMap)) {
          const logo = (library.Logos ?? []).find((l) => l.id === logoId);
          if (logo?.imageUrl) map[value] = logo.imageUrl;
        }
        return map;
      };

      const buildDynamicTaglineMap = () => {
        if (taglineMode === "static") return null;
        const map: Record<string, string> = {};
        for (const [value, taglineId] of Object.entries(taglineValueMap)) {
          const tagline = (library.Taglines ?? []).find((t) => t.id === taglineId);
          if (tagline) map[value] = tagline.content ?? tagline.label;
        }
        return map;
      };

      const buildDynamicReturnMap = () => {
        if (returnMode === "static") return null;
        const map: Record<string, string[]> = {};
        for (const [value, returnId] of Object.entries(returnValueMap)) {
          const ret = (library["Return Address"] ?? []).find((r) => r.id === returnId);
          if (ret) {
            const content = ret.content ?? "";
            const lines = content.split("\n").map((l) => l.trim()).filter(Boolean);
            map[value] = [lines[0] ?? "", lines[1] ?? "", lines[2] ?? ""];
          }
        }
        return map;
      };

      const endpoint = format === "pdf" ? "pdf" : "afp";
      const response = await fetch(`${env.apiBaseUrl}/print-output/${endpoint}`, {
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
          // Dynamic asset configuration
          dynamic_logo: logoMode === "dynamic" ? {
            column: logoColumn,
            map: buildDynamicLogoMap(),
            default: selectedLogo?.imageUrl ?? null,
          } : null,
          dynamic_tagline: taglineMode === "dynamic" ? {
            column: taglineColumn,
            map: buildDynamicTaglineMap(),
            default: selectedTaglineByPage[0]?.content ?? selectedTaglineByPage[0]?.label ?? null,
          } : null,
          dynamic_return: returnMode === "dynamic" ? {
            column: returnColumn,
            map: buildDynamicReturnMap(),
            default: returnLines,
          } : null,
        }),
      });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || `Failed to generate ${format.toUpperCase()}`);
      }
      const blob = await response.blob();
      const fileExt = format === "pdf" ? ".pdf" : ".afp";
      const fileName = `print_output${fileExt}`;
      const mimeType = format === "pdf" ? "application/pdf" : "application/octet-stream";
      const description = format === "pdf" ? "PDF Document" : "AFP Document";

      if ("showSaveFilePicker" in window) {
        const picker = await (window as Window & {
          showSaveFilePicker: (options: {
            suggestedName?: string;
            types?: Array<{ description: string; accept: Record<string, string[]> }>;
          }) => Promise<FileSystemFileHandle>;
        }).showSaveFilePicker({
          suggestedName: fileName,
          types: [{ description, accept: { [mimeType]: [fileExt] } }],
        });
        const writable = await picker.createWritable();
        await writable.write(blob);
        await writable.close();
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(url);
      }
      setShowPreview(false);
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : `Failed to generate ${format.toUpperCase()}`;
      alert(`Error: ${message}\n\nMake sure the API server is running.`);
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
          <button className="ghost" onClick={handleExportWord}>Export</button>
          <button className="primary" onClick={handleSaveToLibrary}>Save</button>
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
              ⚙️ Manage Library
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
              <div className="logo-panel">
                {/* Recently Used Section */}
                {recentlyUsedLogos.length > 0 && !flyoutQuery && (
                  <div className="logo-section">
                    <div className="logo-section-header">
                      <span className="logo-section-title">Recently Used</span>
                    </div>
                    <div className="logo-recent-row">
                      {recentlyUsedLogos
                        .map((id) => (library.Logos ?? []).find((l) => l.id === id))
                        .filter(Boolean)
                        .map((item) => item && (
                          <div
                            key={item.id}
                            className="logo-card-mini"
                            draggable
                            onDragStart={(event) => handleDragStart(event, item)}
                            onDragEnd={handleDragEnd}
                            onClick={() => addLibraryItemToCanvas(item)}
                            title={item.label}
                          >
                            <div className="logo-card-mini-thumb">
                              {item.imageUrl ? <img src={item.imageUrl} alt={item.label} /> : null}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* All Logos Section */}
                <div className="logo-section">
                  <div className="logo-section-header">
                    <span className="logo-section-title">
                      {flyoutQuery ? `Results for "${flyoutQuery}"` : "All Logos"}
                    </span>
                    {!flyoutQuery && (
                      <select
                        className="logo-sort-select"
                        value={logoSortOrder}
                        onChange={(e) => setLogoSortOrder(e.target.value as "recent" | "a-z" | "favorites")}
                      >
                        <option value="recent">Recent</option>
                        <option value="a-z">A-Z</option>
                        <option value="favorites">Favorites</option>
                      </select>
                    )}
                  </div>
                  <div className="logo-grid">
                    {(() => {
                      let items = filterFlyoutItems(openMenuTab);
                      // Apply sorting
                      if (!flyoutQuery) {
                        if (logoSortOrder === "a-z") {
                          items = [...items].sort((a, b) => a.label.localeCompare(b.label));
                        } else if (logoSortOrder === "favorites") {
                          items = [...items].sort((a, b) => {
                            const aFav = favoriteLogos.includes(a.id) ? 0 : 1;
                            const bFav = favoriteLogos.includes(b.id) ? 0 : 1;
                            return aFav - bFav || a.label.localeCompare(b.label);
                          });
                        } else if (logoSortOrder === "recent") {
                          items = [...items].sort((a, b) => {
                            const aRecent = recentlyUsedLogos.indexOf(a.id);
                            const bRecent = recentlyUsedLogos.indexOf(b.id);
                            const aScore = aRecent === -1 ? 999 : aRecent;
                            const bScore = bRecent === -1 ? 999 : bRecent;
                            return aScore - bScore || a.label.localeCompare(b.label);
                          });
                        }
                      }
                      return items.map((item) => (
                        <div
                          key={item.id}
                          className={`logo-card${favoriteLogos.includes(item.id) ? " favorited" : ""}`}
                          draggable
                          onDragStart={(event) => handleDragStart(event, item)}
                            onDragEnd={handleDragEnd}
                          onClick={() => addLibraryItemToCanvas(item)}
                          title={`${item.label} - Drag to canvas or click to insert`}
                        >
                          <div className="logo-card-drag-handle">
                            <span className="drag-dots">⋮⋮</span>
                          </div>
                          <div className="logo-card-thumb">
                            {item.imageUrl ? <img src={item.imageUrl} alt={item.label} /> : null}
                          </div>
                          <div className="logo-card-title">
                            <span className="logo-card-label">{item.label}</span>
                            <button
                              className={`logo-favorite-btn${favoriteLogos.includes(item.id) ? " active" : ""}`}
                              onClick={(e) => toggleLogoFavorite(item.id, e)}
                              title={favoriteLogos.includes(item.id) ? "Remove from favorites" : "Add to favorites"}
                            >
                              {favoriteLogos.includes(item.id) ? "★" : "☆"}
                            </button>
                          </div>
                          {item.isCustom && <span className="logo-badge">Custom</span>}
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              </div>
            ) : openMenuTab === "Return Address" ? (
              <div className="library-panel-enhanced">
                {/* Recently Used Section */}
                {recentlyUsedReturns.length > 0 && !flyoutQuery && (
                  <div className="library-section">
                    <div className="library-section-header">
                      <span className="library-section-title">Recently Used</span>
                    </div>
                    <div className="library-recent-chips">
                      {recentlyUsedReturns
                        .map((id) => (library["Return Address"] ?? []).find((r) => r.id === id))
                        .filter(Boolean)
                        .map((item) => item && (
                          <div
                            key={item.id}
                            className="library-chip"
                            draggable
                            onDragStart={(event) => handleDragStart(event, item)}
                            onDragEnd={handleDragEnd}
                            onClick={() => addLibraryItemToCanvas(item)}
                            title={item.label}
                          >
                            {item.label}
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Main Content */}
                <div className="library-section">
                  <div className="library-section-header">
                    <span className="library-section-title">
                      {flyoutQuery ? `Results` : "All Addresses"}
                    </span>
                    {!flyoutQuery && (
                      <select
                        className="library-sort-select"
                        value={returnSortOrder}
                        onChange={(e) => setReturnSortOrder(e.target.value as "recent" | "a-z" | "favorites")}
                      >
                        <option value="recent">Recent</option>
                        <option value="a-z">A-Z</option>
                        <option value="favorites">Favorites</option>
                      </select>
                    )}
                  </div>
                  <div className="return-two-column">
                    <div className="return-list">
                      {(() => {
                        let items = filterFlyoutItems(openMenuTab);
                        if (!flyoutQuery) {
                          if (returnSortOrder === "a-z") {
                            items = [...items].sort((a, b) => a.label.localeCompare(b.label));
                          } else if (returnSortOrder === "favorites") {
                            items = [...items].sort((a, b) => {
                              const aFav = favoriteReturns.includes(a.id) ? 0 : 1;
                              const bFav = favoriteReturns.includes(b.id) ? 0 : 1;
                              return aFav - bFav || a.label.localeCompare(b.label);
                            });
                          } else if (returnSortOrder === "recent") {
                            items = [...items].sort((a, b) => {
                              const aRecent = recentlyUsedReturns.indexOf(a.id);
                              const bRecent = recentlyUsedReturns.indexOf(b.id);
                              return (aRecent === -1 ? 999 : aRecent) - (bRecent === -1 ? 999 : bRecent) || a.label.localeCompare(b.label);
                            });
                          }
                        }
                        return items.map((item) => (
                          <div
                            key={item.id}
                            className={`return-list-item${favoriteReturns.includes(item.id) ? " favorited" : ""}`}
                            draggable
                            onDragStart={(event) => handleDragStart(event, item)}
                            onDragEnd={handleDragEnd}
                            onClick={() => addLibraryItemToCanvas(item)}
                            onMouseEnter={() => setHoverReturnId(item.id)}
                            onMouseLeave={() => setHoverReturnId(null)}
                            onFocus={() => setHoverReturnId(item.id)}
                            onBlur={() => setHoverReturnId(null)}
                            tabIndex={0}
                          >
                            <span className="drag-handle-icon">⋮⋮</span>
                            <span className="library-item-label">{item.label}</span>
                            <button
                              className={`library-favorite-btn${favoriteReturns.includes(item.id) ? " active" : ""}`}
                              onClick={(e) => toggleReturnFavorite(item.id, e)}
                              title={favoriteReturns.includes(item.id) ? "Remove from favorites" : "Add to favorites"}
                            >
                              {favoriteReturns.includes(item.id) ? "★" : "☆"}
                            </button>
                          </div>
                        ));
                      })()}
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
                </div>
              </div>
            ) : openMenuTab === "Taglines" ? (
              <div className="library-panel-enhanced">
                {/* Recently Used Section */}
                {recentlyUsedTaglines.length > 0 && !flyoutQuery && (
                  <div className="library-section">
                    <div className="library-section-header">
                      <span className="library-section-title">Recently Used</span>
                    </div>
                    <div className="library-recent-chips">
                      {recentlyUsedTaglines
                        .map((id) => (library.Taglines ?? []).find((t) => t.id === id))
                        .filter(Boolean)
                        .map((item) => item && (
                          <div
                            key={item.id}
                            className="library-chip"
                            draggable
                            onDragStart={(event) => handleDragStart(event, item)}
                            onDragEnd={handleDragEnd}
                            onClick={() => addLibraryItemToCanvas(item)}
                            title={item.content ?? item.label}
                          >
                            {item.label}
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Main Content */}
                <div className="library-section">
                  <div className="library-section-header">
                    <span className="library-section-title">
                      {flyoutQuery ? `Results` : "All Taglines"}
                    </span>
                    {!flyoutQuery && (
                      <select
                        className="library-sort-select"
                        value={taglineSortOrder}
                        onChange={(e) => setTaglineSortOrder(e.target.value as "recent" | "a-z" | "favorites")}
                      >
                        <option value="recent">Recent</option>
                        <option value="a-z">A-Z</option>
                        <option value="favorites">Favorites</option>
                      </select>
                    )}
                  </div>
                  <div className="tagline-two-column" onWheel={handleTaglineWheel}>
                    <div className="tagline-list" ref={taglineListRef}>
                      {(() => {
                        let items = filterFlyoutItems(openMenuTab);
                        if (!flyoutQuery) {
                          if (taglineSortOrder === "a-z") {
                            items = [...items].sort((a, b) => a.label.localeCompare(b.label));
                          } else if (taglineSortOrder === "favorites") {
                            items = [...items].sort((a, b) => {
                              const aFav = favoriteTaglines.includes(a.id) ? 0 : 1;
                              const bFav = favoriteTaglines.includes(b.id) ? 0 : 1;
                              return aFav - bFav || a.label.localeCompare(b.label);
                            });
                          } else if (taglineSortOrder === "recent") {
                            items = [...items].sort((a, b) => {
                              const aRecent = recentlyUsedTaglines.indexOf(a.id);
                              const bRecent = recentlyUsedTaglines.indexOf(b.id);
                              return (aRecent === -1 ? 999 : aRecent) - (bRecent === -1 ? 999 : bRecent) || a.label.localeCompare(b.label);
                            });
                          }
                        }
                        return items.map((item) => (
                          <div
                            key={item.id}
                            className={`tagline-list-item${favoriteTaglines.includes(item.id) ? " favorited" : ""}`}
                            draggable
                            onDragStart={(event) => handleDragStart(event, item)}
                            onDragEnd={handleDragEnd}
                            onClick={() => addLibraryItemToCanvas(item)}
                            onMouseEnter={() => setHoverTaglineId(item.id)}
                            onMouseLeave={() => setHoverTaglineId(null)}
                            onFocus={() => setHoverTaglineId(item.id)}
                            onBlur={() => setHoverTaglineId(null)}
                            tabIndex={0}
                          >
                            <span className="drag-handle-icon">⋮⋮</span>
                            <span className="library-item-label">{item.label}</span>
                            <button
                              className={`library-favorite-btn${favoriteTaglines.includes(item.id) ? " active" : ""}`}
                              onClick={(e) => toggleTaglineFavorite(item.id, e)}
                              title={favoriteTaglines.includes(item.id) ? "Remove from favorites" : "Add to favorites"}
                            >
                              {favoriteTaglines.includes(item.id) ? "★" : "☆"}
                            </button>
                          </div>
                        ));
                      })()}
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
                </div>
              </div>
            ) : openMenuTab === "Full Letters" ? (
              <div className="library-panel-enhanced">
                {/* Recently Used Section */}
                {recentlyUsedTemplates.length > 0 && !flyoutQuery && (
                  <div className="library-section">
                    <div className="library-section-header">
                      <span className="library-section-title">Recently Used</span>
                    </div>
                    <div className="library-recent-chips">
                      {recentlyUsedTemplates
                        .map((id) => (library["Full Letters"] ?? []).find((t) => t.id === id))
                        .filter(Boolean)
                        .map((item) => item && (
                          <div
                            key={item.id}
                            className="library-chip"
                            draggable
                            onDragStart={(event) => handleDragStart(event, item)}
                            onDragEnd={handleDragEnd}
                            onClick={() => addLibraryItemToCanvas(item)}
                            title={item.content ?? item.label}
                          >
                            {item.label}
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Main Content */}
                <div className="library-section">
                  <div className="library-section-header">
                    <span className="library-section-title">
                      {flyoutQuery ? `Results` : "All Templates"}
                    </span>
                    {!flyoutQuery && (
                      <select
                        className="library-sort-select"
                        value={templateSortOrder}
                        onChange={(e) => setTemplateSortOrder(e.target.value as "recent" | "a-z" | "favorites")}
                      >
                        <option value="recent">Recent</option>
                        <option value="a-z">A-Z</option>
                        <option value="favorites">Favorites</option>
                      </select>
                    )}
                  </div>
                  <div className="full-letter-two-column">
                    <div className="full-letter-list">
                      {(() => {
                        let items = filterFlyoutItems(openMenuTab);
                        if (!flyoutQuery) {
                          if (templateSortOrder === "a-z") {
                            items = [...items].sort((a, b) => a.label.localeCompare(b.label));
                          } else if (templateSortOrder === "favorites") {
                            items = [...items].sort((a, b) => {
                              const aFav = favoriteTemplates.includes(a.id) ? 0 : 1;
                              const bFav = favoriteTemplates.includes(b.id) ? 0 : 1;
                              return aFav - bFav || a.label.localeCompare(b.label);
                            });
                          } else if (templateSortOrder === "recent") {
                            items = [...items].sort((a, b) => {
                              const aRecent = recentlyUsedTemplates.indexOf(a.id);
                              const bRecent = recentlyUsedTemplates.indexOf(b.id);
                              return (aRecent === -1 ? 999 : aRecent) - (bRecent === -1 ? 999 : bRecent) || a.label.localeCompare(b.label);
                            });
                          }
                        }
                        return items.map((item) => (
                          <div
                            key={item.id}
                            className={`full-letter-list-item${selectedFullLetterId === item.id ? " active" : ""}${favoriteTemplates.includes(item.id) ? " favorited" : ""}`}
                            draggable
                            onDragStart={(event) => handleDragStart(event, item)}
                            onDragEnd={handleDragEnd}
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
                            <span className="library-item-label">{item.label}</span>
                            <button
                              className={`library-favorite-btn${favoriteTemplates.includes(item.id) ? " active" : ""}`}
                              onClick={(e) => toggleTemplateFavorite(item.id, e)}
                              title={favoriteTemplates.includes(item.id) ? "Remove from favorites" : "Add to favorites"}
                            >
                              {favoriteTemplates.includes(item.id) ? "★" : "☆"}
                            </button>
                          </div>
                        ));
                      })()}
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
                </div>
              </div>
            ) : openMenuTab === "Verbiage" ? (
              <div className="library-panel-enhanced">
                {/* Recently Used Section */}
                {recentlyUsedVerbiage.length > 0 && !flyoutQuery && (
                  <div className="library-section">
                    <div className="library-section-header">
                      <span className="library-section-title">Recently Used</span>
                    </div>
                    <div className="library-recent-chips">
                      {recentlyUsedVerbiage
                        .map((id) => (library.Verbiage ?? []).find((v) => v.id === id))
                        .filter(Boolean)
                        .map((item) => item && (
                          <div
                            key={item.id}
                            className="library-chip"
                            draggable
                            onDragStart={(event) => handleDragStart(event, item)}
                            onDragEnd={handleDragEnd}
                            onClick={() => addLibraryItemToCanvas(item)}
                            title={item.content ?? item.label}
                          >
                            {item.label}
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Main Content */}
                <div className="library-section">
                  <div className="library-section-header">
                    <span className="library-section-title">
                      {flyoutQuery ? `Results` : "All Verbiage"}
                    </span>
                    {!flyoutQuery && (
                      <select
                        className="library-sort-select"
                        value={verbiageSortOrder}
                        onChange={(e) => setVerbiageSortOrder(e.target.value as "recent" | "a-z" | "favorites")}
                      >
                        <option value="recent">Recent</option>
                        <option value="a-z">A-Z</option>
                        <option value="favorites">Favorites</option>
                      </select>
                    )}
                  </div>
                  <div className="verbiage-two-column">
                    <div className="verbiage-list">
                      {(() => {
                        let items = filterFlyoutItems(openMenuTab);
                        if (!flyoutQuery) {
                          if (verbiageSortOrder === "a-z") {
                            items = [...items].sort((a, b) => a.label.localeCompare(b.label));
                          } else if (verbiageSortOrder === "favorites") {
                            items = [...items].sort((a, b) => {
                              const aFav = favoriteVerbiage.includes(a.id) ? 0 : 1;
                              const bFav = favoriteVerbiage.includes(b.id) ? 0 : 1;
                              return aFav - bFav || a.label.localeCompare(b.label);
                            });
                          } else if (verbiageSortOrder === "recent") {
                            items = [...items].sort((a, b) => {
                              const aRecent = recentlyUsedVerbiage.indexOf(a.id);
                              const bRecent = recentlyUsedVerbiage.indexOf(b.id);
                              return (aRecent === -1 ? 999 : aRecent) - (bRecent === -1 ? 999 : bRecent) || a.label.localeCompare(b.label);
                            });
                          }
                        }
                        return items.map((item) => (
                          <div
                            key={item.id}
                            className={`verbiage-list-item${selectedVerbiageId === item.id ? " active" : ""}${favoriteVerbiage.includes(item.id) ? " favorited" : ""}`}
                            draggable
                            onDragStart={(event) => handleDragStart(event, item)}
                            onDragEnd={handleDragEnd}
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
                            <span className="library-item-label">{item.label}</span>
                            <button
                              className={`library-favorite-btn${favoriteVerbiage.includes(item.id) ? " active" : ""}`}
                              onClick={(e) => toggleVerbiageFavorite(item.id, e)}
                              title={favoriteVerbiage.includes(item.id) ? "Remove from favorites" : "Add to favorites"}
                            >
                              {favoriteVerbiage.includes(item.id) ? "★" : "☆"}
                            </button>
                          </div>
                        ));
                      })()}
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
          <section className="canvas">
            {/* Toolbar above the page */}
            <EditorToolbar editor={editorInstance} />

            {/* Unified page surface - everything on one "paper" */}
            <div className="page-wrapper">
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
                  if (target.closest(".page-header")) return;
                  if (target.closest(".mail-window")) return;
                  event.preventDefault();
                  setEditorSelectionAtPoint(event.clientX, event.clientY);
                }}
              >
                {/* Page header: Return address + Logo */}
                {activePage === 0 && (
                  <div className="page-header">
                    <div
                      className={`return-block${isDraggingLibraryItem && dragItemType === "return" ? " drag-active" : ""}`}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={handleReturnDrop}
                    >
                      {isDraggingLibraryItem && dragItemType === "return" && (
                        <span className="drop-zone-label">Drop return address</span>
                      )}
                      <div className="return-content">
                        {selectedReturn
                          ? selectedReturn.content ?? selectedReturn.label
                          : "Return address"}
                      </div>
                    </div>

                    <div
                      className={`logo-block resizable${isDraggingLibraryItem && dragItemType === "logo" ? " drag-active" : ""}`}
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
                        <>
                          {isDraggingLibraryItem && dragItemType === "logo" && (
                            <span className="drop-zone-label">Drop logo</span>
                          )}
                          <span className="logo-placeholder">Logo</span>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Mailing window */}
                {activePage === 0 && (
                  <div className="mail-window" aria-hidden="true">
                    <div className="mail-label">Recipient address</div>
                    <div className="mailing-variables">
                      <div>[mailing_name]</div>
                      <div>[mailing_addr1]</div>
                      <div>[mailing_addr2]</div>
                      <div>[mailing_addr3]</div>
                    </div>
                  </div>
                )}

                {/* Letter body content */}
                <div className="page-body">
                  <EditorClient
                    ref={editorRef}
                    value={bodyContentByPage[activePage] ?? ""}
                    onChange={(html) => updateBodyContent(activePageRef.current, html)}
                    placeholder="Start typing your letter..."
                    columns={columns}
                  />
                {guideX !== null && <div className="guide-line guide-x" style={{ left: guideX }} />}
                {guideY !== null && <div className="guide-line guide-y" style={{ top: guideY }} />}
                {(blocksByPage[activePage] ?? []).length === 0 && bodyIsEmpty && (
                  <div className="empty-state">Drop content here or start typing</div>
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

                {/* Tagline at bottom of page */}
                <div
                  className={`tagline-block${isDraggingLibraryItem && dragItemType === "tagline" ? " drag-active" : ""}`}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={handleTaglineDrop}
                >
                  {isDraggingLibraryItem && dragItemType === "tagline" && (
                    <span className="drop-zone-label">Drop tagline</span>
                  )}
                  <div className="tagline-content">
                    {selectedTaglineByPage[activePage]
                      ? selectedTaglineByPage[activePage]?.label
                      : "Tagline"}
                  </div>
                </div>
              </div>
            </div>
          </section>
            </div>
          </div>
        </main>

        <aside className="properties">
          <h3>Document</h3>
          <div className="property-group">
            <button className="ghost full-width" onClick={handleAddPage}>
              + Add page
            </button>
          </div>

          <h3>Data</h3>
          <div className="property-group">
            <div
              className={`drop-zone${isDragging ? " dragging" : ""}`}
              onDragEnter={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
              onDrop={(event) => {
                event.preventDefault();
                setIsDragging(false);
                const file = event.dataTransfer.files?.[0];
                if (file) {
                  handleSpreadsheetFile(file).catch((error) => {
                    console.error(error);
                  });
                }
              }}
            >
              <p>{spreadsheetName ? "Data file loaded" : "Drag data file here"}</p>
              <span>{spreadsheetName ?? "Upload CSV, Excel, XML, or JSON file"}</span>
              <label className="file-input">
                Upload file
                <input
                  type="file"
                  accept=".csv,.xlsx,.xml,.json"
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
          {columns.length > 0 && (
            <div className="property-group">
              <h4>Variables mapping</h4>
              {unmappedMailing.length > 0 && (
                <div className="alert warning">
                  Please map mailing address fields to address columns in the data sheet
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
              {placeholders.length === 0 && (
                <div className="hint-box">
                  <p>No variables found in your letter.</p>
                  <p>Type text in [brackets] to create variables that map to spreadsheet columns.</p>
                  <p className="hint-example">Example: Dear [FirstName], ...</p>
                </div>
              )}
              {placeholders.length > 0 && (
                <>
                  {unmappedPlaceholders.length > 0 && (
                    <div className="alert warning">
                      Unmapped placeholders: {unmappedPlaceholders.join(", ")}
                    </div>
                  )}
                  {autoMatchSuggestions.length > 0 && (
                    <div className="auto-match-banner">
                      <div className="auto-match-header">
                        <span className="auto-match-icon">✨</span>
                        <span className="auto-match-title">
                          {autoMatchSuggestions.length} auto-match{autoMatchSuggestions.length > 1 ? "es" : ""} found
                        </span>
                        <button
                          className="auto-match-apply-all"
                          onClick={applyAllAutoMatches}
                        >
                          Apply All
                        </button>
                      </div>
                      <div className="auto-match-list">
                        {autoMatchSuggestions.map((suggestion) => (
                          <div key={suggestion.placeholder} className="auto-match-row">
                            <span className="auto-match-placeholder">{suggestion.placeholder}</span>
                            <span className="auto-match-arrow">→</span>
                            <span className="auto-match-column">{suggestion.column}</span>
                            <span className={`auto-match-confidence ${suggestion.confidence}`}>
                              {suggestion.confidence === "high" ? "●●" : "●○"}
                            </span>
                            <button
                              className="auto-match-apply"
                              onClick={() => applyAutoMatch(suggestion.placeholder, suggestion.column)}
                            >
                              Apply
                            </button>
                          </div>
                        ))}
                      </div>
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

          {/* Dynamic Asset Selection */}
          {columns.length > 0 && (
            <div className="property-group">
              <h4>Dynamic Assets</h4>
              <p className="hint">Use different logos, taglines, or return addresses based on data values.</p>

              {/* Logo Selection */}
              <div className="dynamic-asset-section">
                <div className="dynamic-asset-header">
                  <span className="dynamic-asset-label">Logo</span>
                </div>
                <div className="dynamic-asset-mode">
                  <label className={`mode-option${logoMode === "static" ? " active" : ""}`}>
                    <input
                      type="radio"
                      name="logoMode"
                      checked={logoMode === "static"}
                      onChange={() => setLogoMode("static")}
                    />
                    Same for all
                  </label>
                  <label className={`mode-option${logoMode === "dynamic" ? " active" : ""}`}>
                    <input
                      type="radio"
                      name="logoMode"
                      checked={logoMode === "dynamic"}
                      onChange={() => setLogoMode("dynamic")}
                    />
                    Based on data
                  </label>
                </div>
                {logoMode === "static" ? (
                  <div className="static-asset-select">
                    <select
                      value={selectedLogo?.id ?? ""}
                      onChange={(e) => {
                        const logo = (library.Logos ?? []).find((l) => l.id === e.target.value);
                        setSelectedLogo(logo ?? null);
                      }}
                    >
                      <option value="">Select logo...</option>
                      {(library.Logos ?? []).map((logo) => (
                        <option key={logo.id} value={logo.id}>{logo.label}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="dynamic-asset-config">
                    <select
                      value={logoColumn}
                      onChange={(e) => setLogoColumn(e.target.value)}
                      className="column-select"
                    >
                      <option value="">Select column...</option>
                      {columns.map((col) => (
                        <option key={col} value={col}>{col}</option>
                      ))}
                    </select>
                    {logoColumn && uniqueLogoValues.length > 0 && (
                      <>
                        {uniqueLogoValues.length > 20 && (
                          <div className="alert warning">
                            {uniqueLogoValues.length} unique values found. Consider using a different column.
                          </div>
                        )}
                        <div className="value-mapping-table">
                          <div className="value-mapping-header">
                            <span>Value</span>
                            <span>Logo</span>
                          </div>
                          {uniqueLogoValues.slice(0, 50).map((value) => (
                            <div key={value} className="value-mapping-row">
                              <span className="value-cell">{value}</span>
                              <select
                                value={logoValueMap[value] ?? ""}
                                onChange={(e) =>
                                  setLogoValueMap((prev) => ({ ...prev, [value]: e.target.value }))
                                }
                                className={logoValueMap[value] ? "mapped" : "unmapped"}
                              >
                                <option value="">Select...</option>
                                {(library.Logos ?? []).map((logo) => (
                                  <option key={logo.id} value={logo.id}>{logo.label}</option>
                                ))}
                              </select>
                              {logoValueMap[value] && <span className="match-indicator">✓</span>}
                            </div>
                          ))}
                        </div>
                        <div className="mapping-stats">
                          {Object.keys(logoValueMap).filter((k) => uniqueLogoValues.includes(k) && logoValueMap[k]).length} of {uniqueLogoValues.length} mapped
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Tagline Selection */}
              <div className="dynamic-asset-section">
                <div className="dynamic-asset-header">
                  <span className="dynamic-asset-label">Tagline</span>
                </div>
                <div className="dynamic-asset-mode">
                  <label className={`mode-option${taglineMode === "static" ? " active" : ""}`}>
                    <input
                      type="radio"
                      name="taglineMode"
                      checked={taglineMode === "static"}
                      onChange={() => setTaglineMode("static")}
                    />
                    Same for all
                  </label>
                  <label className={`mode-option${taglineMode === "dynamic" ? " active" : ""}`}>
                    <input
                      type="radio"
                      name="taglineMode"
                      checked={taglineMode === "dynamic"}
                      onChange={() => setTaglineMode("dynamic")}
                    />
                    Based on data
                  </label>
                </div>
                {taglineMode === "static" ? (
                  <div className="static-asset-select">
                    <select
                      value={selectedTaglineByPage[activePage]?.id ?? ""}
                      onChange={(e) => {
                        const tagline = (library.Taglines ?? []).find((t) => t.id === e.target.value);
                        setSelectedTaglineByPage((prev) => ({ ...prev, [activePage]: tagline ?? null }));
                      }}
                    >
                      <option value="">Select tagline...</option>
                      {(library.Taglines ?? []).map((tagline) => (
                        <option key={tagline.id} value={tagline.id}>{tagline.label}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="dynamic-asset-config">
                    <select
                      value={taglineColumn}
                      onChange={(e) => setTaglineColumn(e.target.value)}
                      className="column-select"
                    >
                      <option value="">Select column...</option>
                      {columns.map((col) => (
                        <option key={col} value={col}>{col}</option>
                      ))}
                    </select>
                    {taglineColumn && uniqueTaglineValues.length > 0 && (
                      <>
                        {uniqueTaglineValues.length > 20 && (
                          <div className="alert warning">
                            {uniqueTaglineValues.length} unique values found. Consider using a different column.
                          </div>
                        )}
                        <div className="value-mapping-table">
                          <div className="value-mapping-header">
                            <span>Value</span>
                            <span>Tagline</span>
                          </div>
                          {uniqueTaglineValues.slice(0, 50).map((value) => (
                            <div key={value} className="value-mapping-row">
                              <span className="value-cell">{value}</span>
                              <select
                                value={taglineValueMap[value] ?? ""}
                                onChange={(e) =>
                                  setTaglineValueMap((prev) => ({ ...prev, [value]: e.target.value }))
                                }
                                className={taglineValueMap[value] ? "mapped" : "unmapped"}
                              >
                                <option value="">Select...</option>
                                {(library.Taglines ?? []).map((tagline) => (
                                  <option key={tagline.id} value={tagline.id}>{tagline.label}</option>
                                ))}
                              </select>
                              {taglineValueMap[value] && <span className="match-indicator">✓</span>}
                            </div>
                          ))}
                        </div>
                        <div className="mapping-stats">
                          {Object.keys(taglineValueMap).filter((k) => uniqueTaglineValues.includes(k) && taglineValueMap[k]).length} of {uniqueTaglineValues.length} mapped
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Return Address Selection */}
              <div className="dynamic-asset-section">
                <div className="dynamic-asset-header">
                  <span className="dynamic-asset-label">Return Address</span>
                </div>
                <div className="dynamic-asset-mode">
                  <label className={`mode-option${returnMode === "static" ? " active" : ""}`}>
                    <input
                      type="radio"
                      name="returnMode"
                      checked={returnMode === "static"}
                      onChange={() => setReturnMode("static")}
                    />
                    Same for all
                  </label>
                  <label className={`mode-option${returnMode === "dynamic" ? " active" : ""}`}>
                    <input
                      type="radio"
                      name="returnMode"
                      checked={returnMode === "dynamic"}
                      onChange={() => setReturnMode("dynamic")}
                    />
                    Based on data
                  </label>
                </div>
                {returnMode === "static" ? (
                  <div className="static-asset-select">
                    <select
                      value={selectedReturn?.id ?? ""}
                      onChange={(e) => {
                        const ret = (library["Return Address"] ?? []).find((r) => r.id === e.target.value);
                        setSelectedReturn(ret ?? null);
                      }}
                    >
                      <option value="">Select return address...</option>
                      {(library["Return Address"] ?? []).map((ret) => (
                        <option key={ret.id} value={ret.id}>{ret.label}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="dynamic-asset-config">
                    <select
                      value={returnColumn}
                      onChange={(e) => setReturnColumn(e.target.value)}
                      className="column-select"
                    >
                      <option value="">Select column...</option>
                      {columns.map((col) => (
                        <option key={col} value={col}>{col}</option>
                      ))}
                    </select>
                    {returnColumn && uniqueReturnValues.length > 0 && (
                      <>
                        {uniqueReturnValues.length > 20 && (
                          <div className="alert warning">
                            {uniqueReturnValues.length} unique values found. Consider using a different column.
                          </div>
                        )}
                        <div className="value-mapping-table">
                          <div className="value-mapping-header">
                            <span>Value</span>
                            <span>Return Address</span>
                          </div>
                          {uniqueReturnValues.slice(0, 50).map((value) => (
                            <div key={value} className="value-mapping-row">
                              <span className="value-cell">{value}</span>
                              <select
                                value={returnValueMap[value] ?? ""}
                                onChange={(e) =>
                                  setReturnValueMap((prev) => ({ ...prev, [value]: e.target.value }))
                                }
                                className={returnValueMap[value] ? "mapped" : "unmapped"}
                              >
                                <option value="">Select...</option>
                                {(library["Return Address"] ?? []).map((ret) => (
                                  <option key={ret.id} value={ret.id}>{ret.label}</option>
                                ))}
                              </select>
                              {returnValueMap[value] && <span className="match-indicator">✓</span>}
                            </div>
                          ))}
                        </div>
                        <div className="mapping-stats">
                          {Object.keys(returnValueMap).filter((k) => uniqueReturnValues.includes(k) && returnValueMap[k]).length} of {uniqueReturnValues.length} mapped
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="property-group">
            <button className="primary" onClick={handleMergePreview} disabled={!spreadsheetContent}>
              Merge/Preview/Print
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
                    addLibraryItemToCanvas(createdItem);
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
                        {(() => {
                          const previewReturnLines = getReturnLinesForRow(previewIndex);
                          return previewReturnLines[0] || previewReturnLines[1] || previewReturnLines[2] ? (
                            <>
                              <div>{previewReturnLines[0]}</div>
                              <div>{previewReturnLines[1]}</div>
                              <div>{previewReturnLines[2]}</div>
                            </>
                          ) : (
                            <div className="preview-placeholder">No return address</div>
                          );
                        })()}
                      </div>
                      <div className="preview-logo">
                        {(() => {
                          const previewLogo = getLogoForRow(previewIndex);
                          return previewLogo?.imageUrl ? (
                            <img src={previewLogo.imageUrl} alt={previewLogo.label} />
                          ) : (
                            <div className="preview-placeholder">No logo</div>
                          );
                        })()}
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
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(buildMergedHtml()) }}
                />
                {(() => {
                  const previewTagline = getTaglineForRow(previewIndex);
                  return previewTagline ? (
                    <div className="preview-tagline">
                      {previewTagline.content ?? previewTagline.label}
                    </div>
                  ) : null;
                })()}
              </div>
              <div className="preview-meta">
                <h4>TLE Index (Row {previewIndex + 1})</h4>
                {Object.entries(buildTleIndex()).map(([key, value]) => (
                  <div key={key} className="preview-row">
                    <span>{key}</span>
                    <span>{value}</span>
                  </div>
                ))}
                <div className="output-format-section">
                  <h4>Select Output Format</h4>
                  <div className="format-segmented-control">
                    <button
                      className={`format-segment ${outputFormat === "pdf" ? "active" : ""}`}
                      onClick={() => setOutputFormat("pdf")}
                    >
                      <span className="format-icon">PDF</span>
                      <span className="format-label">Preview & Print</span>
                    </button>
                    <button
                      className={`format-segment ${outputFormat === "afp" ? "active" : ""}`}
                      onClick={() => setOutputFormat("afp")}
                    >
                      <span className="format-icon">AFP</span>
                      <span className="format-label">Mainframe</span>
                    </button>
                  </div>
                  <p className="format-description">
                    {outputFormat === "pdf"
                      ? "Generate a PDF file for preview and direct printing."
                      : "Generate AFP format for mainframe processing and mail sorting."}
                  </p>
                </div>
                <div className="preview-actions">
                  <button className="ghost" onClick={() => setShowPreview(false)}>
                    Cancel
                  </button>
                  <button className="primary" onClick={() => handleGenerate(outputFormat)} disabled={generating}>
                    {generating ? "Generating..." : `Download ${outputFormat.toUpperCase()}`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* First-time drag tooltip */}
      {showDragTooltip && openMenuTab && (
        <div
          className="drag-tooltip"
          style={{ top: "200px", left: "420px" }}
        >
          <div className="tooltip-title">
            <span>✨</span> Drag & Drop
          </div>
          <p>
            Drag items from the library panel and drop them onto the letter canvas.
          </p>
          <button className="tooltip-dismiss" onClick={dismissDragTooltip}>
            Got it
          </button>
        </div>
      )}
    </div>
  );
}
