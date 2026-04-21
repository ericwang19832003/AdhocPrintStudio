"use client";
import * as React from "react";
import Link from "next/link";
import {
  Button, Badge, Card, Input, Textarea, Table, DropZone, EmptyState,
  Pagination, Tooltip, Tabs, Modal, Select, ToggleGroup, Checkbox,
  Spinner, Kbd, Divider, useToast, DesignProviders,
} from "@/design";
import { Bold, Italic, Underline, Mail, FileText, Plus } from "@/design/icons";

export default function PrimitivesPage() {
  return (
    <DesignProviders>
      <PrimitivesGallery />
    </DesignProviders>
  );
}

function PrimitivesGallery() {
  const [page, setPage] = React.useState(1);
  const [tg, setTg] = React.useState("static");
  const [check, setCheck] = React.useState(false);
  const { toast } = useToast();
  const [select, setSelect] = React.useState("source-serif-4");

  return (
    <main style={{ padding: 40, maxWidth: 1100, fontFamily: "var(--font-sans, system-ui)" }}>
      <Link href="/design" style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)", textDecoration: "none" }}>
        ← back to design index
      </Link>
      <h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.01em", margin: "8px 0 24px" }}>
        Primitives
      </h1>

      <Section id="button" title="Button — variants, sizes, icon-only, loading">
        <Row>
          <Button variant="primary">Generate</Button>
          <Button variant="secondary">Preview</Button>
          <Button variant="ghost">Cancel</Button>
          <Button variant="link">Need help?</Button>
          <Button variant="accent">Add to library</Button>
          <Button variant="danger">Remove</Button>
        </Row>
        <Row>
          <Button size="sm" variant="primary">Generate (sm)</Button>
          <Button size="md" variant="primary">Generate (md)</Button>
          <Button variant="primary" disabled>Disabled</Button>
          <Button variant="primary" loading>Loading</Button>
        </Row>
        <Row>
          <Button iconOnly icon={<Bold size={14} />} aria-label="Bold" variant="ghost" size="sm" />
          <Button iconOnly icon={<Italic size={14} />} aria-label="Italic" variant="ghost" size="sm" />
          <Button iconOnly icon={<Underline size={14} />} aria-label="Underline" variant="ghost" size="sm" />
          <Button iconOnly icon={<Plus size={16} />} aria-label="Add page" variant="secondary" />
        </Row>
      </Section>

      <Section id="badge" title="Badge — tones, caps, dot">
        <Row>
          <Badge>neutral</Badge>
          <Badge tone="accent">accent</Badge>
          <Badge tone="success" dot>success</Badge>
          <Badge tone="warn" dot>warn</Badge>
          <Badge tone="danger" dot>danger</Badge>
          <Badge tone="info" dot>info</Badge>
        </Row>
        <Row>
          <Badge tone="success" caps>READY</Badge>
          <Badge tone="warn" caps>PENDING</Badge>
          <Badge caps>DRAFT</Badge>
          <Badge tone="info" caps>ADVANCED</Badge>
          <Badge caps>CUSTOM</Badge>
          <Badge caps>SYSTEM</Badge>
        </Row>
      </Section>

      <Section id="card" title="Card — surface and interactive">
        <Row>
          <Card style={{ width: 240 }}>
            <div style={{ fontWeight: 600 }}>APS Primary</div>
            <div style={{ color: "var(--text-secondary)", fontSize: 12, marginTop: 4 }}>328 × 140 px · 4.2 KB</div>
          </Card>
          <Card interactive style={{ width: 280 }}>
            <div style={{ fontWeight: 600 }}>Late payment notice</div>
            <div style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 6, lineHeight: 1.4 }}>
              Our records show an outstanding balance. Please remit payment within 10 days...
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>
              107 chars · #billing
            </div>
          </Card>
        </Row>
      </Section>

      <Section id="input" title="Input — text and search variants">
        <div style={{ display: "grid", gap: 12 }}>
          <Input defaultValue="APS Primary" placeholder="Display name" style={{ width: 280 }} />
          <Input.Search hint="⌘K" placeholder="Search logos by name or brand..." style={{ width: 360 }} />
          <Input size="sm" defaultValue="72" style={{ width: 100 }} />
        </div>
      </Section>

      <Section id="textarea" title="Textarea — with counter">
        <Textarea
          defaultValue="Protect yourself from fraud. Never share your account number, PIN, or password with anyone claiming to be from our company. We will never ask for this information via email or phone."
          counter={{ total: 500 }}
          style={{ width: 480 }}
        />
      </Section>

      <Section id="select" title="Select — Radix-wrapped">
        <Select value={select} onValueChange={setSelect}>
          <Select.Trigger>
            <Select.Value />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="source-serif-4">Source Serif 4</Select.Item>
            <Select.Item value="inter">Inter</Select.Item>
            <Select.Item value="jetbrains-mono">JetBrains Mono</Select.Item>
          </Select.Content>
        </Select>
      </Section>

      <Section id="tabs" title="Tabs — underline triggers">
        <Tabs defaultValue="block">
          <Tabs.List>
            <Tabs.Trigger value="block">Block</Tabs.Trigger>
            <Tabs.Trigger value="document">Document</Tabs.Trigger>
            <Tabs.Trigger value="merge">Merge</Tabs.Trigger>
          </Tabs.List>
          <Tabs.Panel value="block">Block panel content.</Tabs.Panel>
          <Tabs.Panel value="document">Document panel content.</Tabs.Panel>
          <Tabs.Panel value="merge">Merge panel content.</Tabs.Panel>
        </Tabs>
      </Section>

      <Section id="modal" title="Modal — sm / md / lg">
        <Modal>
          <Modal.Trigger asChild>
            <Button variant="secondary">Open modal</Button>
          </Modal.Trigger>
          <Modal.Content title="Upload logo" description="Supported formats: PNG, JPG, SVG · Max 5 MB">
            <Modal.Body>
              <DropZone accept="image/png,image/jpeg,image/svg+xml" maxSize={5 * 1024 * 1024} onFiles={() => {}}>
                <div style={{ fontWeight: 500, color: "var(--text-primary)" }}>Drop your logo here</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>or browse files</div>
              </DropZone>
            </Modal.Body>
            <Modal.Footer>
              <Modal.Close asChild><Button variant="secondary">Cancel</Button></Modal.Close>
              <Button variant="primary">Add to library</Button>
            </Modal.Footer>
          </Modal.Content>
        </Modal>
      </Section>

      <Section id="tooltip" title="Tooltip">
        <Tooltip content="Open library (⌘K)">
          <Button variant="ghost" iconOnly icon={<FileText size={14} />} aria-label="Open library" />
        </Tooltip>
      </Section>

      <Section id="toggle-group" title="ToggleGroup — Static/Dynamic, PDF/AFP">
        <Row>
          <ToggleGroup type="single" value={tg} onValueChange={(v) => v && setTg(v)}>
            <ToggleGroup.Item value="static">Static</ToggleGroup.Item>
            <ToggleGroup.Item value="dynamic">Dynamic</ToggleGroup.Item>
          </ToggleGroup>
          <ToggleGroup type="single" defaultValue="pdf">
            <ToggleGroup.Item value="pdf">PDF</ToggleGroup.Item>
            <ToggleGroup.Item value="afp">AFP</ToggleGroup.Item>
          </ToggleGroup>
        </Row>
      </Section>

      <Section id="checkbox" title="Checkbox">
        <div style={{ display: "grid", gap: 8 }}>
          <Checkbox label="Send via USPS window envelope" checked={check} onCheckedChange={(v) => setCheck(v === true)} />
          <Checkbox label="Include marketing insert" />
        </div>
      </Section>

      <Section id="dropzone" title="DropZone">
        <DropZone accept=".docx" maxSize={20 * 1024 * 1024} onFiles={() => {}}>
          <div style={{ fontWeight: 500, color: "var(--text-primary)" }}>Drop a .docx file</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>or browse files · max 20 MB</div>
        </DropZone>
      </Section>

      <Section id="table" title="Table">
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeadCell>Name</Table.HeadCell>
              <Table.HeadCell>Updated</Table.HeadCell>
              <Table.HeadCell>Source</Table.HeadCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {[
              { name: "APS Primary", updated: "Updated 3d ago", source: "CUSTOM" },
              { name: "APS Mono",    updated: "Updated 3d ago", source: "SYSTEM" },
              { name: "Acme Corp",   updated: "Updated 3d ago", source: "CUSTOM" },
            ].map((r) => (
              <Table.Row key={r.name}>
                <Table.Cell>{r.name}</Table.Cell>
                <Table.Cell>{r.updated}</Table.Cell>
                <Table.Cell><Badge caps>{r.source}</Badge></Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </Section>

      <Section id="pagination" title="Pagination">
        <Pagination totalItems={48} pageSize={8} page={page} onPageChange={setPage} />
      </Section>

      <Section id="toast" title="Toast">
        <Row>
          <Button variant="secondary" onClick={() => toast({ tone: "success", title: "Saved", description: "All blocks merged." })}>
            Show success
          </Button>
          <Button variant="secondary" onClick={() => toast({ tone: "warn", title: "Heads up", description: "Two placeholders unmapped." })}>
            Show warning
          </Button>
          <Button variant="secondary" onClick={() => toast({ tone: "danger", title: "Couldn't export", description: "AFP engine is offline." })}>
            Show danger
          </Button>
        </Row>
      </Section>

      <Section id="spinner" title="Spinner — sm / md / lg">
        <Row>
          <Spinner size="sm" />
          <Spinner size="md" />
          <Spinner size="lg" />
        </Row>
      </Section>

      <Section id="kbd" title="Kbd">
        <Row>
          <Kbd>⌘K</Kbd>
          <span>·</span>
          <Kbd>Ctrl</Kbd> + <Kbd>Enter</Kbd>
        </Row>
      </Section>

      <Section id="visually-hidden" title="VisuallyHidden">
        <p>The button below has an icon plus an accessible name that is not visible:</p>
        <Button iconOnly icon={<Mail size={14} />} aria-label="Open mail" variant="ghost" />
        <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>
          Inspect the button with a screen reader or DOM inspector to see the hidden label inside the loading state.
        </p>
      </Section>

      <Section id="empty-state" title="EmptyState">
        <EmptyState
          icon={<FileText size={32} />}
          title="Start a new letter"
          description="Pick a starter below, or build from scratch by dragging blocks from the sidebar on the left."
        >
          <Button variant="secondary">Blank letter</Button>
          <Button variant="secondary">From template</Button>
          <Button variant="secondary">Import Word</Button>
        </EmptyState>
      </Section>

      <Section id="divider" title="Divider — horizontal and vertical">
        <div>Content above</div>
        <Divider />
        <div>Content below</div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 12, height: 24, marginTop: 12 }}>
          left <Divider orientation="vertical" /> right
        </div>
      </Section>
    </main>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} style={{ marginBottom: 40, padding: 24, background: "var(--surface-card)",
      border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)" }}>
      <h2 style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em",
        color: "var(--text-secondary)", margin: "0 0 16px", fontWeight: 600,
        fontFamily: "var(--font-mono)" }}>{title}</h2>
      <div style={{ display: "grid", gap: 16 }}>{children}</div>
    </section>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>{children}</div>;
}
