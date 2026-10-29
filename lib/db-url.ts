/**
 * Normalize a connection string pasted into a hosting dashboard. The 2026-10-27
 * outage was `DATABASE_URL` saved WITH its surrounding quotes, which Prisma
 * rejects ("the URL must start with the protocol postgresql://"). Strips
 * whitespace, one pair of matching quotes and an accidentally pasted
 * `DATABASE_URL=` prefix. Returns undefined for blank input so Prisma keeps
 * its own (clearer) "missing env var" error.
 *
 * Also enforces `pgbouncer=true` on Supabase's transaction pooler (:6543).
 * Without it Prisma uses named prepared statements, which collide across the
 * pooler's shared connections — measured 15/24 concurrent transactions failing
 * with `prepared statement "sN" does not exist` (intermittent save errors).
 */
export function normalizeDbUrl(raw: string | undefined): string | undefined {
  if (raw == null) return undefined;
  let v = raw.trim().replace(/^[A-Z_]+=/, "").trim();
  const q = v[0];
  if ((q === '"' || q === "'") && v.endsWith(q) && v.length >= 2) v = v.slice(1, -1).trim();
  if (!v) return undefined;
  return withPoolerFlag(v);
}

function withPoolerFlag(url: string): string {
  try {
    const u = new URL(url);
    const isTxPooler = u.hostname.endsWith(".pooler.supabase.com") && u.port === "6543";
    if (!isTxPooler || u.searchParams.get("pgbouncer") === "true") return url;
    return `${url}${u.search ? "&" : "?"}pgbouncer=true`;
  } catch {
    return url; // let Prisma report a malformed URL itself
  }
}
