export type DataSection = "placeholders" | "tle" | "preview";

export type ReadinessItem = {
  id: "recipients" | "fields" | "mailing";
  label: string;
  complete: boolean;
  target: DataSection;
};

export type DraftSummary = {
  id: string;
  title: string;
  updatedAt: number;
};

export type TopbarCommandId = "new" | "open" | "duplicate" | "export" | "library" | "settings";

export type TopbarMenuGroup = {
  label: "Document" | "Library" | "Preferences";
  items: Array<{ id: TopbarCommandId; label: string }>;
};

export function getTopbarMenuGroups(): TopbarMenuGroup[] {
  return [
    {
      label: "Document",
      items: [
        { id: "new", label: "New letter" },
        { id: "open", label: "Open recent" },
        { id: "duplicate", label: "Duplicate" },
        { id: "export", label: "Export Word" },
      ],
    },
    { label: "Library", items: [{ id: "library", label: "Manage library" }] },
    { label: "Preferences", items: [{ id: "settings", label: "Settings" }] },
  ];
}

export function getCreateActionLabel(busy: boolean): string {
  return busy ? "Preparing preview..." : "Preview & create";
}

export function getMoreActionsLabel(): string {
  return "More";
}

export function buildOutputFileName(
  title: string,
  format: "pdf" | "afp",
  recipientCount: number,
  now = new Date()
): string {
  const safeTitle = title
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "Adhoc_Letter";
  const date = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
  const countLabel = recipientCount === 1 ? "1_letter" : `${recipientCount}_letters`;
  return `${safeTitle}_${date}_${countLabel}.${format}`;
}

export function buildReadinessItems(input: {
  recipientCount: number;
  mappedFieldCount: number;
  totalFieldCount: number;
  mailingComplete: boolean;
}): ReadinessItem[] {
  const { recipientCount, mappedFieldCount, totalFieldCount, mailingComplete } = input;
  return [
    {
      id: "recipients",
      label: recipientCount === 1 ? "1 recipient loaded" : `${recipientCount} recipients loaded`,
      complete: recipientCount > 0,
      target: "placeholders",
    },
    {
      id: "fields",
      label:
        totalFieldCount === 0
          ? "No fill-in fields needed"
          : mappedFieldCount === totalFieldCount
            ? `All ${totalFieldCount} fill-in fields mapped`
            : `${mappedFieldCount} of ${totalFieldCount} fill-in fields mapped`,
      complete: totalFieldCount === 0 || mappedFieldCount === totalFieldCount,
      target: "placeholders",
    },
    {
      id: "mailing",
      label: mailingComplete ? "Mailing address complete" : "Mailing address incomplete",
      complete: mailingComplete,
      target: "tle",
    },
  ];
}

export function createDraftSummary(id: string, title: string, updatedAt = Date.now()): DraftSummary {
  return { id, title: title.trim() || "Untitled letter", updatedAt };
}

export function upsertDraftSummary(items: DraftSummary[], item: DraftSummary): DraftSummary[] {
  return [item, ...items.filter((candidate) => candidate.id !== item.id)]
    .sort((a, b) => b.updatedAt - a.updatedAt);
}
