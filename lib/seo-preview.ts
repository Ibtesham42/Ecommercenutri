/**
 * Client-safe SEO preview types + helpers (no server imports), shared by the
 * live preview panel, the URL tester and the server-side meta scraper.
 */

export type PreviewData = {
  title: string;
  description: string;
  image: string;
  siteName: string;
  domain: string;
  url: string;
  favicon: string;
  twitterCard: "summary" | "summary_large_image";
};

/** Resolve a possibly-relative URL against a base (for absolute OG image src). */
export function absolutize(url: string, base: string): string {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  try {
    return new URL(url, base).toString();
  } catch {
    return url;
  }
}

/** Host of a URL, best-effort. */
export function hostOf(url: string, fallback = "nutriyet.in"): string {
  try {
    return new URL(url).host;
  } catch {
    return fallback;
  }
}
