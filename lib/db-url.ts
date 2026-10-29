/**
 * Normalize a connection string pasted into a hosting dashboard. The 2026-10-27
 * outage was `DATABASE_URL` saved WITH its surrounding quotes, which Prisma
 * rejects ("the URL must start with the protocol postgresql://"). Strips
 * whitespace, one pair of matching quotes and an accidentally pasted
 * `DATABASE_URL=` prefix. Returns undefined for blank input so Prisma keeps
 * its own (clearer) "missing env var" error.
 */
export function normalizeDbUrl(raw: string | undefined): string | undefined {
  if (raw == null) return undefined;
  let v = raw.trim().replace(/^[A-Z_]+=/, "").trim();
  const q = v[0];
  if ((q === '"' || q === "'") && v.endsWith(q) && v.length >= 2) v = v.slice(1, -1).trim();
  return v || undefined;
}
