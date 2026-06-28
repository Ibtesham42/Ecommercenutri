/** Minimal CSV serializer (RFC-4180-style escaping). Values are stringified;
 *  cells containing quotes, commas or newlines are quoted and quotes doubled. */
export type CsvColumn<T> = {
  header: string;
  value: (row: T) => unknown;
};

function escapeCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const head = columns.map((c) => escapeCell(c.header)).join(",");
  const body = rows.map((r) => columns.map((c) => escapeCell(c.value(r))).join(","));
  return [head, ...body].join("\r\n");
}
