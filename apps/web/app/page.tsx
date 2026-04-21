import Link from "next/link";
import { Badge, Button, Card, Divider, Kbd } from "@/design";
import { FileText, Database, Mail } from "@/design/icons";

export const metadata = { title: "AdhocPrintStudio" };

export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--surface-page)",
        color: "var(--text-primary)",
        fontFamily: "var(--font-sans, system-ui, sans-serif)",
      }}
    >
      {/* Top bar */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 32px",
          borderBottom: "1px solid var(--border-subtle)",
          background: "var(--surface-card)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            aria-hidden
            style={{
              width: 28,
              height: 28,
              background: "var(--ink-900)",
              color: "var(--text-inverse)",
              borderRadius: "var(--radius-sm)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: 12,
            }}
          >
            A
          </div>
          <strong style={{ fontSize: 15, letterSpacing: "-0.01em" }}>
            Adhoc Print Studio
          </strong>
          <Badge caps>Redesign · v2</Badge>
        </div>
        <nav style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Link href="/design" style={{ textDecoration: "none" }}>
            <Button variant="ghost" size="sm">Design system</Button>
          </Link>
          <Link href="/builder" style={{ textDecoration: "none" }}>
            <Button variant="primary" size="sm">Open Builder</Button>
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section
        style={{
          maxWidth: 960,
          margin: "0 auto",
          padding: "80px 32px 32px",
        }}
      >
        <div style={{ maxWidth: 640 }}>
          <Badge tone="accent">Now live · 2026-04-21</Badge>
          <h1
            style={{
              fontFamily: "var(--font-serif, Georgia, serif)",
              fontSize: 56,
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              fontWeight: 600,
              margin: "16px 0 12px",
            }}
          >
            Compose letters from approved blocks.
          </h1>
          <p
            style={{
              fontSize: 18,
              lineHeight: 1.55,
              color: "var(--text-secondary)",
              margin: 0,
              maxWidth: 560,
            }}
          >
            Logos, taglines, return addresses, and verbiage. Drop in a CSV,
            map placeholders, preview every recipient, and ship as PDF or AFP.
            Readiness beats ceremony.
          </p>

          <div style={{ display: "flex", gap: 12, marginTop: 28, alignItems: "center" }}>
            <Link href="/builder" style={{ textDecoration: "none" }}>
              <Button variant="primary">Open the Builder →</Button>
            </Link>
            <Link href="/design/primitives" style={{ textDecoration: "none" }}>
              <Button variant="secondary">Browse the design system</Button>
            </Link>
            <span
              style={{
                color: "var(--text-muted)",
                fontSize: 13,
                marginLeft: 8,
              }}
            >
              Press <Kbd>⌘K</Kbd> in the Builder for the library
            </span>
          </div>
        </div>
      </section>

      {/* Feature cards */}
      <section
        style={{
          maxWidth: 960,
          margin: "0 auto",
          padding: "32px 32px 64px",
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 16,
        }}
      >
        <FeatureCard
          icon={<FileText size={20} />}
          title="Letter canvas"
          description="Drag blocks onto the canvas. Inspector shows position, alignment, content, and merge readiness as you work."
        />
        <FeatureCard
          icon={<Database size={20} />}
          title="Data &amp; mapping"
          description="Upload a CSV, auto-match columns to placeholders, swap logos and return addresses dynamically per row."
        />
        <FeatureCard
          icon={<Mail size={20} />}
          title="Preview &amp; generate"
          description="Step through every merged letter, then export as PDF for the office or AFP for the print operator."
        />
      </section>

      {/* Status strip */}
      <section
        style={{
          maxWidth: 960,
          margin: "0 auto",
          padding: "0 32px 64px",
        }}
      >
        <Card padding="lg">
          <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
            <Badge tone="success" caps>READY</Badge>
            <strong>Foundation A is live.</strong>
            <span style={{ color: "var(--text-secondary)", fontSize: 14 }}>
              9 token groups · 20 primitives · 1 demo route. The full PDF
              redesign rolls out across sub-projects B–F.
            </span>
            <span style={{ flex: 1 }} />
            <Link href="/design/tokens" style={{ textDecoration: "none" }}>
              <Button variant="ghost" size="sm">View tokens →</Button>
            </Link>
          </div>
        </Card>
      </section>

      <Divider />

      {/* Footer */}
      <footer
        style={{
          maxWidth: 960,
          margin: "0 auto",
          padding: "24px 32px 48px",
          color: "var(--text-muted)",
          fontFamily: "var(--font-mono, monospace)",
          fontSize: 11,
          display: "flex",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <span>Adhoc Print Studio · Redesign v2 · 2026</span>
        <span>
          <Link href="/builder" style={{ color: "inherit" }}>builder</Link>
          {" · "}
          <Link href="/design" style={{ color: "inherit" }}>design</Link>
          {" · "}
          <Link href="/design/tokens" style={{ color: "inherit" }}>tokens</Link>
          {" · "}
          <Link href="/design/primitives" style={{ color: "inherit" }}>primitives</Link>
        </span>
      </footer>
    </main>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Card padding="lg" interactive>
      <div
        aria-hidden
        style={{
          width: 36,
          height: 36,
          borderRadius: "var(--radius-sm)",
          background: "var(--accent-soft)",
          color: "var(--accent-ink)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 12,
        }}
      >
        {icon}
      </div>
      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.5 }}>
        {description}
      </div>
    </Card>
  );
}
