/**
 * Minimal RFC 4180 CSV parsing.
 *
 * The app previously split lines on "," in six places, which corrupted any
 * quoted field containing a comma (e.g. `"123 Main St, Apt 4"`) — a common
 * shape for mailing data. All client-side CSV reads go through here now.
 */

/** Parse a full CSV text into rows of fields. Handles quotes, escaped quotes, CRLF. */
export function parseCsv(text: string, maxRows?: number): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      pushField();
    } else if (ch === "\n") {
      pushRow();
      if (maxRows !== undefined && rows.length >= maxRows) return rows;
    } else if (ch !== "\r") {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) pushRow();
  return rows;
}

/** Header row of a CSV text: trimmed, empty cells dropped. */
export function parseCsvHeader(text: string): string[] {
  const first = parseCsv(text, 1)[0] ?? [];
  return first.map((v) => v.trim()).filter(Boolean);
}
