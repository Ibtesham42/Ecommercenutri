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
