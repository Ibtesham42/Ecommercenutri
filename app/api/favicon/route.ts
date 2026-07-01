import { getStoreSettings } from "@/lib/queries/settings";
import { cldFavicon } from "@/lib/cld";

// Always reflect the current admin-uploaded favicon (no build-time bake).
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Serves the classic `/favicon.ico` path (via a rewrite in next.config).
 * Browsers, bookmarks and crawlers (incl. Google Search) request `/favicon.ico`
 * directly — independent of the `<link rel="icon">` tags in the document head —
 * so without this the classic path 404s and those contexts fall back to a blank
 * or stale icon even though the metadata is correct. We PROXY the bytes (rather
 * than redirect) so every client, including the pickier ones (Safari/iOS), gets
 * a real image response at `/favicon.ico`. Falls back to the generated brand
 * icon when no favicon is configured or the upstream fetch fails.
 */
export async function GET(req: Request) {
  const { favicon } = await getStoreSettings();
  const brand = new URL("/brand-icon", req.url).toString();
  const src = favicon ? cldFavicon(favicon, 48) : brand;

  try {
    const upstream = await fetch(src, { cache: "no-store" });
    if (!upstream.ok) throw new Error(`favicon upstream ${upstream.status}`);
    const body = await upstream.arrayBuffer();
    return new Response(body, {
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? "image/png",
        // Short cache so a freshly-uploaded favicon propagates quickly while the
        // browser tab still caches it between visits.
        "Cache-Control": "public, max-age=3600, must-revalidate",
      },
    });
  } catch {
    // Last resort: send the client to the always-available generated brand icon.
    return Response.redirect(brand, 307);
  }
}
