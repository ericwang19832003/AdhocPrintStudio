# Vary logo / return address / tagline by data — design

**Goal:** a business user can say "letters for the North branch get the North
logo" without a manual: pick a column, confirm the value→asset matches, done.

**Starting point (code audit):** the engine already exists end-to-end —
`logoMode/taglineMode/returnMode` state, per-row resolution
(`getLogoForRow`, MergePreview `assetsForRow`), `dynamic_logo/tagline/return`
generate payloads honored by both AFP and PDF routes, and fuzzy auto-matching
(`autoMatchAssets`) that prefills value→asset maps when a column is chosen.
What's missing is 100% UI: nothing ever calls `setLogoMode`/`setLogoColumn`,
so the feature is unreachable. The mode/column/map state is also not saved
in the letter draft.

## Approaches considered

1. **Mode controls inside each library flyout.** Colocated but cramped
   (280px panel), and three separate implementations.
2. **A "rules" section in the Data panel.** Data-centric, but a user who is
   *picking a logo* never finds it.
3. **One shared "Vary by data" modal, opened from a small mode bar in each
   asset flyout** — recommended. The bar keeps discovery where the user
   already is (choosing the asset); the modal gives the mapping table the
   room it needs; one component serves all three asset types.

## Design (approach 3)

### Mode bar (top of Logo / Return address / Tagline flyouts)
- Static (default): `Same for every letter` + button `Vary by data…`
  - No data file yet → clicking shows the existing "upload data first"
    toast and routes to the Data panel.
- Dynamic: `Varies by <column>` + `Edit rule` + `Turn off`.
- Picking an item from the list in dynamic mode still sets the
  static/default asset (used for unmatched values) — the bar says so.

### VaryByDataModal (shared, one per asset type at a time)
1. **Column picker** — "Which column decides the logo?" Dropdown of data
   columns; next to it, live count: "4 values: North, South, East, West".
   Columns with >30 unique values show a warning ("pick a column with a
   small set of categories") but are not blocked.
2. **Mapping table** — one row per unique value:
   `<value> → <asset dropdown>` prefilled by the existing auto-matcher
   (logos additionally show a 20px thumbnail). Unmatched rows default to
   "Use default".
3. **Default row** — "Any other value → current selection (or None)".
4. Footer: `Cancel` / `Save rule`. Saving sets mode=dynamic, column, map.

### Feedback loops (why no manual is needed)
- READY TO SEND? checklist: "Logo set" becomes ok with detail
  "Varies by <column>" when a rule is active.
- Merge preview already resolves assets per recipient — clicking through
  recipients shows each branch's logo/address/tagline immediately.

### Persistence
Extend `LetterDraft` with
`assetRules?: { logo?: Rule; tagline?: Rule; return?: Rule }` where
`Rule = { column: string; valueMap: Record<string, string> }` (present =
dynamic). Restore on load. (Value maps store library item ids; the return
payload builder already converts ids to content lines at generate time.)

## Out of scope
Multi-column conditions, value ranges ("amount > 100"), per-page rules,
backend changes (none needed).

## Verification
Browser: upload CSV with a Branch column, set a logo rule, confirm
auto-match prefill, preview shows different logos per recipient, generate
PDF succeeds, rule survives reload, Turn off restores static. Lint/build,
API tests untouched.
