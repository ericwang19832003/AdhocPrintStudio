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
  if (!template.includes("{")) return (row[template] ?? "").trim();
  let resolved = template.replace(TOKEN, (_, col: string) => (row[col] ?? "").trim());
  resolved = resolved.replace(/\s+/g, " ");
  resolved = resolved.replace(/\s*,\s*(?=,)/g, "");
  return resolved.replace(/^[\s,]+|[\s,]+$/g, "");
}

/** Derive the 4-line mailing_map templates from the semantic fields. */
export function mailingTemplates(f: MailingFields): Record<string, string> {
  const t = (col: string) => (col ? `{${col}}` : "");
  const nameCol = f.first || f.last;
  return {
    mailing_name:
      f.first && f.last ? `{${f.first}} {${f.last}}` : t(nameCol),
    mailing_addr1: t(f.street),
    mailing_addr2: t(f.apt),
    mailing_addr3:
      f.city || f.state || f.zip
        ? `${t(f.city)}, ${t(f.state)} ${t(f.zip)}`.trim()
        : "",
  };
}

const LEGACY_SENTINELS = new Set(["", "__empty__", "__select__"]);

/** Convert a legacy one-column-per-line mailing_map into semantic fields. */
export function fieldsFromLegacyMap(
  map: Record<string, string> | undefined
): MailingFields {
  const col = (value?: string) => {
    const v = value ?? "";
    return LEGACY_SENTINELS.has(v) || v.includes("{") ? "" : v;
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
