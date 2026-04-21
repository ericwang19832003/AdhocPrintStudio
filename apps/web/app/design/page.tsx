import Link from "next/link";

export const metadata = { title: "Design system — AdhocPrintStudio" };

export default function DesignIndex() {
  return (
    <main style={{ padding: 48, maxWidth: 720, fontFamily: "var(--font-sans, system-ui)" }}>
      <h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.01em", margin: "0 0 4px" }}>
        AdhocPrintStudio — Design system
      </h1>
      <p style={{ color: "var(--text-secondary)", margin: "0 0 24px" }}>
        Foundation A (with 2026-04-20 amendments). Built from <code>redesign.pdf</code> p.12.
      </p>

      <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 12 }}>
        <li>
          <Link href="/design/tokens" style={cardStyle}>
            <strong>Tokens</strong>
            <div style={{ color: "var(--text-secondary)", marginTop: 4 }}>
              Color, type ramp, spacing, radii, shadows, motion, focus ring.
            </div>
          </Link>
        </li>
        <li>
          <Link href="/design/primitives" style={cardStyle}>
            <strong>Primitives</strong>
            <div style={{ color: "var(--text-secondary)", marginTop: 4 }}>
              All 20 components in every variant — Button, Badge, Card, Input,
              Textarea, Select, Tabs, Modal, Tooltip, ToggleGroup, Checkbox,
              DropZone, Table, Pagination, Toast, Spinner, Kbd, VisuallyHidden,
              EmptyState, Divider.
            </div>
          </Link>
        </li>
      </ul>
    </main>
  );
}

const cardStyle: React.CSSProperties = {
  display: "block",
  padding: "16px 20px",
  background: "var(--surface-card)",
  border: "1px solid var(--border-subtle)",
  borderRadius: "var(--radius-md)",
  textDecoration: "none",
  color: "inherit",
};
