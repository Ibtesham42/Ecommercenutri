/**
 * Tiny user-agent classifier shared by affiliate click logging and the
 * behavioral event tracker. Heuristic, dependency-free — good enough for
 * device/browser breakdowns; not a full UA parser.
 */
export function parseUA(ua: string): { device: string; browser: string } {
  const u = ua.toLowerCase();
  const device = /mobile|iphone|ipod/.test(u)
    ? "mobile"
    : /ipad|tablet/.test(u)
      ? "tablet"
      : /android/.test(u) && !/mobile/.test(u)
        ? "tablet"
        : /android/.test(u)
          ? "mobile"
          : "desktop";
  const browser = /edg\//.test(u)
    ? "Edge"
    : /chrome|crios/.test(u)
      ? "Chrome"
      : /firefox|fxios/.test(u)
        ? "Firefox"
        : /safari/.test(u)
          ? "Safari"
          : "Other";
  return { device, browser };
}

/**
 * Crawlers, link unfurlers, headless browsers and scripted HTTP clients. Analytics
 * beacons from these are dropped so they never inflate traffic, funnels or heatmaps.
 * (Automation that spoofs a normal UA is caught client-side via navigator.webdriver.)
 */
const BOT_UA =
  /(?<!cu)bot(?:[/\s;)_-]|$)|crawl|spider|slurp|headless|lighthouse|pagespeed|gtmetrix|preview|facebookexternalhit|embedly|playwright|puppeteer|phantomjs|selenium|python-|curl\/|wget\/|axios\/|node-fetch|go-http-client|okhttp/i;

export function isBotUA(ua: string | null | undefined): boolean {
  return !ua || BOT_UA.test(ua);
}
