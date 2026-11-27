/** Public reviewer label: first name + last initial ("Priya S."), never a full
 *  surname or email. Plain module — shared by server queries and client lists. */
export function reviewerName(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Nutriyet customer";
  const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);
  const [first, ...rest] = parts;
  const last = rest.at(-1);
  return last ? `${cap(first)} ${last.charAt(0).toUpperCase()}.` : cap(first);
}
