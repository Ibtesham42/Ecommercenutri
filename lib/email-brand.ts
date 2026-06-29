import "server-only";
import { getStoreSettings } from "@/lib/queries/settings";
import { cldUrl } from "@/lib/cld";
import { env } from "@/lib/env";
import { siteConfig } from "@/config/site";

/** Placeholder emitted by the email `shell()` where the brand lockup goes;
 *  replaced by `sendEmail` with the admin-uploaded logo (or the wordmark). */
export const EMAIL_BRAND_MARKER = "<!--NUTRIYET_BRAND-->";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function wordmark(name: string): string {
  return `<span style="color:#ffffff;font-size:20px;font-weight:800;letter-spacing:-0.5px">${esc(name)}</span>`;
}

// Short-TTL cache so bulk sends don't hit the DB per recipient, while a logo
// change still propagates within a few minutes (no code change needed).
let cache: { html: string; at: number } | null = null;
const TTL_MS = 5 * 60_000;

/**
 * The brand lockup HTML for the email header — the admin-uploaded logo on a white
 * pill (reads well on the green header for any logo) when set, otherwise the site
 * wordmark. Fail-safe: any error falls back to the wordmark. Auto-reflects an admin
 * logo change within the cache TTL.
 */
export async function getEmailBrandHtml(): Promise<string> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.html;
  try {
    const store = await getStoreSettings();
    const name = store.siteName || siteConfig.name;
    let html: string;
    if (store.logo) {
      let src = cldUrl(store.logo, { h: 56 });
      if (!/^https?:\/\//i.test(src)) src = `${env.appUrl.replace(/\/$/, "")}${src}`;
      html = `<span style="display:inline-block;background:#ffffff;padding:6px 12px;border-radius:8px;line-height:0"><img src="${src}" alt="${esc(name)}" height="24" style="display:block;height:24px;width:auto;max-width:160px" /></span>`;
    } else {
      html = wordmark(name);
    }
    cache = { html, at: Date.now() };
    return html;
  } catch {
    return wordmark(siteConfig.name);
  }
}
