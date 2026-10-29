/**
 * Where a campaign click-tracking link may send the shopper: any same-origin
 * path, or exactly the campaign's own admin-authored CTA. Everything else
 * (other hosts, `//host`, `javascript:`) falls back to the home page, so the
 * tracker can't be abused as an open redirect.
 */
export function resolveClickDestination(to: string, base: string, ctaUrl: string | null): string {
  try {
    const origin = new URL(base).origin;
    const target = new URL(to, base);
    if (target.origin === origin) return target.toString();
    if (ctaUrl && target.toString() === new URL(ctaUrl, base).toString()) return target.toString();
  } catch {
    // fall through
  }
  return base;
}
