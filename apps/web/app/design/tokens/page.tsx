import * as React from "react";
import Link from "next/link";

export const metadata = { title: "Tokens — Design system" };

const inkScale = ["900", "700", "500", "300", "150", "50"];
const accentScale = [
  { name: "accent", hex: "#b3502f" },
  { name: "accent-hover", hex: "#9a4326" },
  { name: "accent-ink", hex: "#7a3318" },
  { name: "accent-soft", hex: "#fdeee6" },
];
const statusScale = [
  { name: "success", hex: "#0f7a55" },
  { name: "warn", hex: "#b45309" },
  { name: "danger", hex: "#b42318" },
  { name: "info", hex: "#1d5fbe" },
];

export default function TokensPage() {
  return (
    <main style={{ padding: 40, maxWidth: 1100, fontFamily: "var(--font-sans, system-ui)" }}>
      <Link href="/design" style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)", textDecoration: "none" }}>
        ← back to design index
      </Link>
      <h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.01em", margin: "8px 0 24px" }}>
        Tokens
      </h1>

      <Section title="Color · neutrals">
        <div style={swatchGrid(6)}>
          {inkScale.map((s) => {
            const hex = (
              { "900": "#0b1220", "700": "#1f2937", "500": "#4b5563",
                "300": "#9ca3af", "150": "#e5e7eb",  "50": "#f8fafc" } as Record<string, string>
            )[s];
            return (
              <Swatch key={s} name={`ink-${s}`} hex={hex} dark={Number(s) >= 500} />
            );
          })}
        </div>
      </Section>

      <Section title="Color · accent">
        <div style={swatchGrid(4)}>
          {accentScale.map((c) => (
            <Swatch key={c.name} name={c.name} hex={c.hex} dark={c.name !== "accent-soft"} />
          ))}
        </div>
      </Section>

      <Section title="Color · status">
        <div style={swatchGrid(4)}>
          {statusScale.map((c) => (
            <Swatch key={c.name} name={c.name} hex={c.hex} dark />
          ))}
        </div>
      </Section>

      <Section title="Typography · faces">
        <TypeSample label="Inter — UI (default)" sample="Adhoc Print Studio" font="var(--font-sans)" size={32} weight={600} />
        <TypeSample label="Source Serif 4 — letter body" sample="Dear Customer," font="var(--font-serif)" size={24} />
        <TypeSample label="JetBrains Mono — data, placeholders" sample="[Customer_Name]" font="var(--font-mono)" size={18} />
      </Section>

      <Section title="Typography · size scale (Inter)">
        <Scale items={[
          ["xs · 11/16",  11, 16,  "VERBIAGE · uppercase labels"],
          ["sm · 12/16",  12, 16,  "114 chars · #legal · captions"],
          ["base · 13/18", 13, 18, "Default UI body, list items."],
          ["md · 14/20",  14, 20,  "Inputs, buttons, table cells."],
          ["lg · 16/22",  16, 22,  "Section titles inside panels."],
          ["xl · 20/26",  20, 26,  "Modal titles."],
          ["2xl · 28/34", 28, 34,  "Page titles."],
        ]} />
      </Section>

      <Section title="Spacing scale (4px base)">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 12 }}>
          {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => (
            <div key={n} style={{ height: 64, background: "#fff", border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-sm)", display: "flex", alignItems: "end", padding: 8,
              fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)" }}>
              space-{n} · {[null, 4, 8, 12, 16, 20, 24, null, 32, null, 40][n]}
            </div>
          ))}
        </div>
      </Section>

      <Section title="Radii">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
          {[
            ["xs", 4, "(chips)"],
            ["sm", 6, "(buttons, inputs)"],
            ["md", 8, "(cards)"],
            ["lg", 12, "(modals)"],
            ["pill", 999, "(badges)"],
          ].map(([name, r, label]) => (
            <div key={name as string} style={{
              height: 80, background: "var(--ink-700)", color: "#fff",
              borderRadius: r as number, display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "var(--font-mono)", fontSize: 11,
            }}>{name} · {r as number} {label}</div>
          ))}
        </div>
      </Section>

      <Section title="Shadows">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
          {[
            ["sm", "var(--shadow-sm)", "card lift"],
            ["md", "var(--shadow-md)", "popover, dropdown"],
            ["lg", "var(--shadow-lg)", "modal"],
          ].map(([name, shadow, label]) => (
            <div key={name as string} style={{
              height: 120, background: "#fff", borderRadius: "var(--radius-md)",
              boxShadow: shadow as string, display: "flex", alignItems: "end", padding: 12,
              fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)",
            }}>shadow-{name} — {label}</div>
          ))}
        </div>
      </Section>

      <Section title="Motion (added by 2026-04-20 amendments)">
        <ul style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.8 }}>
          <li>--motion-fast: 120ms · short hover, snap toggle</li>
          <li>--motion-base: 180ms · modal/tabs panel switch</li>
          <li>--motion-slow: 280ms · large surface transitions</li>
          <li>--ease-standard: cubic-bezier(0.2, 0, 0, 1)</li>
          <li>--ease-emphasized: cubic-bezier(0.3, 0, 0, 1.2)</li>
        </ul>
      </Section>

      <Section title="Focus ring (added by 2026-04-20 amendments)">
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <button style={{
            outline: "var(--focus-ring-width) solid var(--focus-ring-color)",
            outlineOffset: "var(--focus-ring-offset)",
            background: "var(--surface-card)", border: "1px solid var(--border-strong)",
            borderRadius: "var(--radius-sm)", padding: "8px 14px", fontFamily: "var(--font-sans)",
          }}>Forced focus example</button>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)" }}>
            outline 2px solid var(--accent), offset 2px
          </span>
        </div>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 40 }}>
      <h2 style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em",
        color: "var(--text-secondary)", margin: "0 0 12px", fontWeight: 600,
        fontFamily: "var(--font-mono)" }}>{title}</h2>
      {children}
    </section>
  );
}

function swatchGrid(cols: number): React.CSSProperties {
  return { display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 12 };
}

function Swatch({ name, hex, dark }: { name: string; hex: string; dark?: boolean }) {
  return (
    <div style={{
      height: 96, background: hex, color: dark ? "#fff" : "var(--text-primary)",
      borderRadius: "var(--radius-md)", padding: 12, display: "flex", flexDirection: "column",
      justifyContent: "flex-end", border: dark ? "none" : "1px solid var(--border-subtle)",
      fontFamily: "var(--font-mono)", fontSize: 11,
    }}>
      <div style={{ fontWeight: 600, fontSize: 12 }}>{name}</div>
      <div>{hex}</div>
    </div>
  );
}

function TypeSample({ label, sample, font, size, weight }: {
  label: string; sample: string; font: string; size: number; weight?: number;
}) {
  return (
    <div style={{ padding: "16px 0", borderBottom: "1px dashed var(--border-subtle)" }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)",
        letterSpacing: "0.04em", textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontFamily: font, fontSize: size, fontWeight: weight ?? 400, marginTop: 4 }}>{sample}</div>
    </div>
  );
}

function Scale({ items }: { items: [string, number, number, string][] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 24, alignItems: "baseline" }}>
      {items.map(([label, size, lh, sample]) => (
        <React.Fragment key={label}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)" }}>{label}</div>
          <div style={{ fontSize: size, lineHeight: `${lh}px` }}>{sample}</div>
        </React.Fragment>
      ))}
    </div>
  );
}
