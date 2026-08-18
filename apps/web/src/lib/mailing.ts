/**
 * Mailing-address composition from split data columns.
 *
 * The user maps semantic fields (first/last name, street, apt, city, state,
 * ZIP) and the app composes the four mailing lines. Under the hood each line
 * is a template like "{First Name} {Last Name}" — a plain string without
 * braces is a single column name (the legacy mailing_map contract). The
 * backend has a twin resolver (_resolve_mailing_line in print_output.py).
 */

export type MailingFields = {
  first: string;
  last: string;
  street: string;
  apt: string;
  city: string;
  state: string;
  zip: string;
};

export const EMPTY_MAILING_FIELDS: MailingFields = {
  first: "",
  last: "",
  street: "",
  apt: "",
  city: "",
  state: "",
  zip: "",
};

const TOKEN = /\{([^{}]+)\}/g;

/** Build one mailing line from a template; strips artifacts of empty parts. */
export function resolveMailingLine(
  template: string,
  row: Record<string, string>
): string {
  if (!template) return "";
  // An exact column key wins over template parsing — this keeps headers
  // that themselves contain braces working as plain lookups.
  if (template in row) return (row[template] ?? "").trim();
  if (!template.includes("{")) return (row[template] ?? "").trim();
  // Empty tokens leave a sentinel so each one is removed together with its
  // leading separator: "{city}, {state} {zip}" with a blank state yields
  // "Springfield 62704", not "Springfield, 62704".
  let resolved = template.replace(
    TOKEN,
    (_, col: string) => (row[col] ?? "").trim() || "\x00"
  );
  resolved = resolved.replace(/[\s,]*\x00/g, "");
  resolved = resolved.replace(/\s+/g, " ");
  return resolved.replace(/^[\s,]+|[\s,]+$/g, "");
}

/** Derive the 4-line mailing_map templates from the semantic fields.
 *
 * A header containing braces cannot be a {token}; such columns fall back to
 * the plain-column form (which accepts any characters), dropping composition
 * for that line rather than producing a corrupt template.
 */
export function mailingTemplates(f: MailingFields): Record<string, string> {
  const safe = (col: string) => !col.includes("{") && !col.includes("}");
  const t = (col: string) => (col ? (safe(col) ? `{${col}}` : col) : "");
  const nameCol = f.first || f.last;
  return {
    mailing_name:
      f.first && f.last && safe(f.first) && safe(f.last)
        ? `{${f.first}} {${f.last}}`
        : nameCol && safe(nameCol)
          ? `{${nameCol}}`
          : nameCol,
    mailing_addr1: t(f.street),
    mailing_addr2: t(f.apt),
    mailing_addr3: cityLineTemplate(f),
  };
}

/** "City, State ZIP" with separators only between parts that are mapped. */
function cityLineTemplate(f: MailingFields): string {
  const parts = [f.city, f.state, f.zip].filter(Boolean);
  if (parts.length === 0) return "";
  const safe = (col: string) => !col.includes("{") && !col.includes("}");
  if (!parts.every(safe)) return parts[0];
  const stateZip = [f.state, f.zip]
    .filter(Boolean)
    .map((col) => `{${col}}`)
    .join(" ");
  if (!f.city) return stateZip;
  if (!stateZip) return `{${f.city}}`;
  // The comma belongs between city and state; with only a ZIP mapped the
  // conventional form is "City 62704".
  return f.state ? `{${f.city}}, ${stateZip}` : `{${f.city}} ${stateZip}`;
}

const LEGACY_SENTINELS = new Set(["", "__empty__", "__select__"]);

/** Convert a legacy one-column-per-line mailing_map into semantic fields.
 *
 * Legacy drafts predate templates, so every value is a raw column name —
 * including headers that happen to contain braces. Only drafts without
 * mailingFields reach this converter.
 */
export function fieldsFromLegacyMap(
  map: Record<string, string> | undefined
): MailingFields {
  const col = (value?: string) => {
    const v = value ?? "";
    return LEGACY_SENTINELS.has(v) ? "" : v;
  };
  return {
    ...EMPTY_MAILING_FIELDS,
    first: col(map?.mailing_name),
    street: col(map?.mailing_addr1),
    apt: col(map?.mailing_addr2),
    city: col(map?.mailing_addr3),
  };
}

const DETECTORS: Array<[keyof MailingFields, RegExp]> = [
  ["last", /^(last[ _-]?name|lname|surname|last)$/i],
  ["first", /^(first[ _-]?name|fname|first|full[ _-]?name|name|recipient([ _-]?name)?|customer[ _-]?name)$/i],
  ["street", /^(street([ _-]?address)?|address([ _-]?line)?[ _-]?1|addr(ess)?1?|mailing[ _-]?address)$/i],
  ["apt", /^(apt(\.|artment)?([ _-]?(no|num|number))?|suite|unit|address([ _-]?line)?[ _-]?2|addr2)$/i],
  ["city", /^(city|town|city[ _-]?name)$/i],
  ["state", /^(state|province|state[ _-]?name|st)$/i],
  ["zip", /^(zip([ _-]?code)?|postal([ _-]?code)?|postcode)$/i],
];

/** Guess field→column assignments from header names (first match wins). */
export function detectMailingFields(columns: string[]): Partial<MailingFields> {
  const guessed: Partial<MailingFields> = {};
  for (const [field, pattern] of DETECTORS) {
    if (guessed[field]) continue;
    const match = columns.find((c) => pattern.test(c.trim()));
    if (match) guessed[field] = match;
  }
  return guessed;
}
