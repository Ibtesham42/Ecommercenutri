"use client";

/** RFC-4180 cell escaping (quotes wrap, internal quotes doubled). */
function cell(value: string): string {
  const v = value ?? "";
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/**
 * Build a CSV from headers + rows and trigger a browser download. Used for
 * "Export selected" in admin bulk bars (Excel opens CSV natively). A UTF-8 BOM
 * is prepended so ₹ / accented text render correctly in Excel.
 */
export function downloadCsv(filename: string, headers: string[], rows: string[][]) {
  const lines = [headers, ...rows].map((r) => r.map(cell).join(","));
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `${filename}-${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
