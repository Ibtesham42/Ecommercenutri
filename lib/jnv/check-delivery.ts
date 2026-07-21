import { cached } from "@/lib/redis";

/**
 * Best-effort check that a resource's file URL is actually deliverable —
 * added after discovering all seeded PDFs 401 in this environment
 * (Cloudinary's "Restricted media types" account setting blocking PDF/ZIP
 * delivery, confirmed via raw/signed/authenticated delivery all failing
 * identically — an account-console fix, not a code fix). Fail-open: a
 * network hiccup or slow response must never make a WORKING file look
 * broken, so only an explicit 401/403 counts as blocked. Redis-cached
 * briefly (5 min) so this HEAD request doesn't re-fire on every page view —
 * short TTL so the banner disappears quickly once the account setting is
 * fixed, without needing a manual cache-bust.
 */
export async function isJnvDeliveryBlocked(url: string): Promise<boolean> {
  return cached(`jnv:delivery-blocked:${url}`, 300, () => checkDelivery(url));
}

async function checkDelivery(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, { method: "HEAD", signal: controller.signal });
    clearTimeout(timer);
    return res.status === 401 || res.status === 403;
  } catch {
    return false;
  }
}
