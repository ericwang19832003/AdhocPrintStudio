import assert from "node:assert/strict";
import test from "node:test";

import {
  buildOutputFileName,
  buildReadinessItems,
  createDraftSummary,
  getCreateActionLabel,
  getMoreActionsLabel,
  getTopbarMenuGroups,
  upsertDraftSummary,
} from "./ux";

test("the primary action describes previewing and creating", () => {
  assert.equal(getCreateActionLabel(false), "Preview & create");
  assert.equal(getCreateActionLabel(true), "Preparing preview...");
});

test("the secondary actions trigger has a clear visible label", () => {
  assert.equal(getMoreActionsLabel(), "More");
});

test("output filenames include the letter title, date, and recipient count", () => {
  const date = new Date("2026-08-23T12:00:00Z");
  assert.equal(
    buildOutputFileName("Payment Reminder / August", "pdf", 125, date),
    "Payment_Reminder_August_2026-08-23_125_letters.pdf"
  );
});

test("output filenames fall back safely for blank titles", () => {
  assert.equal(
    buildOutputFileName("  ", "afp", 1, new Date("2026-08-23T12:00:00Z")),
    "Adhoc_Letter_2026-08-23_1_letter.afp"
  );
});

test("readiness identifies the first incomplete section", () => {
  const items = buildReadinessItems({
    recipientCount: 12,
    mappedFieldCount: 1,
    totalFieldCount: 2,
    mailingComplete: false,
  });

  assert.deepEqual(items, [
    { id: "recipients", label: "12 recipients loaded", complete: true, target: "placeholders" },
    { id: "fields", label: "1 of 2 fill-in fields mapped", complete: false, target: "placeholders" },
    { id: "mailing", label: "Mailing address incomplete", complete: false, target: "tle" },
  ]);
});

test("draft summaries are newest-first and replace matching ids", () => {
  const first = createDraftSummary("first", "First letter", 10);
  const updated = { ...first, title: "Renamed", updatedAt: 20 };
  const second = createDraftSummary("second", "Second letter", 15);

  assert.deepEqual(upsertDraftSummary([first, second], updated), [updated, second]);
});

test("topbar commands are compact, grouped, and do not duplicate title editing", () => {
  const groups = getTopbarMenuGroups();

  assert.deepEqual(groups.map((group) => group.label), ["Document", "Library", "Preferences"]);
  assert.deepEqual(
    groups.flatMap((group) => group.items.map((item) => item.id)),
    ["new", "open", "duplicate", "export", "library", "settings"]
  );
  assert.equal(groups.some((group) => group.items.some((item) => item.id === "rename")), false);
});
