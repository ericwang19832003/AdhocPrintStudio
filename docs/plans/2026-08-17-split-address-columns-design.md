# Mailing address from split columns — design

**Problem:** real data files carry the mailing address in whatever shape the
source system produced: first/last name separate or combined, street, apt or
suite, city, state, and ZIP often in their own columns. Today each of the 4
mailing slots (name, addr1, addr2, city/state/zip line) maps to exactly ONE
column, so split files cannot be mapped at all without editing the spreadsheet.

## Approaches considered

1. **Free-form templates per line** ("{first} {last}") typed by the user —
   maximum power, but business users should not hand-author template syntax.
2. **Multi-select column pickers per line** — handles joining, but the user
   still thinks in "lines" instead of what their data contains, and comma
   rules for the city line get awkward.
3. **Structured address form (recommended):** the user maps semantic fields —
   name (one or two columns), street, apt/suite, city, state, ZIP — and the
   app composes correct mailing lines using postal conventions. Combined
   shapes still work: a single full-name column goes in the name field, a
   combined "City, ST 12345" column goes in the city field with state/ZIP
   left unmapped.

## Design (approach 3)

### Data panel — "Index fields" tab becomes "Mailing address"
A familiar address form, every field a column dropdown (blank = not mapped):
- **Recipient name**: `Name or first name` + `Last name` ("set both if first
  and last names are separate columns")
- **Street address**
- **Apt / Suite** (optional — the line is skipped when empty)
- **City / State / ZIP**: three dropdowns in one row ("if they're combined
  in one column, map just City")

On upload, header-name heuristics prefill the form (first_name, lname,
surname, street, address1, apt, suite, unit, city, town, state, zip,
postal…). Only unset fields are prefilled.

### Under the hood — line templates, backward compatible
The existing `mailing_map` contract is upgraded, not replaced: each of the 4
slots now holds either a plain column name (legacy — still works everywhere)
or a template with `{Column}` tokens composed by the form:
- name: `{First Name} {Last Name}` (or `{Full Name}`)
- addr1: `{Street}` · addr2: `{Apt}` · addr3: `{City}, {State} {Zip}`

One resolver (TS + Python twins, ~10 lines): substitute tokens with trimmed
row values, collapse whitespace, strip dangling commas/spaces left by empty
parts ("Springfield, IL 62704" stays right when apt or state is missing).

`mailingFields` becomes the single source of truth in the frontend;
`mailing_map` templates are derived from it. Old drafts and AI auto-map
suggestions (plain column names) convert losslessly into the form
(name→name field, addr1→street, addr2→apt, addr3→city).

### Touched consumers
- Backend `print_output.py` (AFP + PDF): resolve templates when building
  mailing lines; TLE index data flows from those lines unchanged.
- Backend `preflight.py`: required-field checks now validate the *resolved
  line* per row (name line empty = error), which is more accurate than the
  old single-column check.
- Frontend: generate payload, merge preview (per-row resolver, recipient
  list shows the composed name), canvas recipient sample, draft persistence.

## Out of scope
Address validation/CASS, country formats beyond US-style lines, multi-line
street addresses.

## Verification
API tests for the resolver + a split-columns generate test; browser pass
with a CSV using first/last/street/apt/city/state/zip columns → form
auto-prefills, preview shows composed lines, PDF generates; legacy
single-column file still maps; old draft loads correctly.
