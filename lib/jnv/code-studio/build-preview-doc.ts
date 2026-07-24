/**
 * Pure string-assembly for the live preview iframe — no DOM access, easy to
 * reason about/extend. Combines the student's separate HTML/CSS/JS panes
 * into one document the way a real static site would load them, since the
 * iframe has no actual "style.css"/"script.js" files to fetch (everything is
 * `srcDoc`, never written anywhere). Also injects a small console bridge so
 * `console.log`/errors inside the sandboxed iframe can be shown in the
 * studio's own Console panel via `postMessage`.
 */

const CONSOLE_BRIDGE = `<script>
(function () {
  function stringifyArg(a) {
    if (a instanceof Error) return a.message;
    if (typeof a === "object" && a !== null) { try { return JSON.stringify(a); } catch (e) { return String(a); } }
    return String(a);
  }
  function send(type, args) {
    try {
      var text = Array.prototype.map.call(args, stringifyArg).join(" ");
      parent.postMessage({ source: "jnv-code-studio", type: type, text: text }, "*");
    } catch (e) { /* ignore */ }
  }
  var original = { log: console.log, warn: console.warn, error: console.error };
  console.log = function () { send("log", arguments); original.log.apply(console, arguments); };
  console.warn = function () { send("warn", arguments); original.warn.apply(console, arguments); };
  console.error = function () { send("error", arguments); original.error.apply(console, arguments); };
  window.addEventListener("error", function (e) {
    send("error", [e.message + (e.lineno ? " (line " + e.lineno + ")" : "")]);
  });
  window.addEventListener("unhandledrejection", function (e) {
    var reason = e.reason && e.reason.message ? e.reason.message : e.reason;
    send("error", ["Unhandled promise rejection: " + reason]);
  });
})();
</script>`;

const STYLE_LINK_RE = /<link[^>]*href=["']style\.css["'][^>]*>/i;
const SCRIPT_SRC_RE = /<script[^>]*src=["']script\.js["'][^>]*>\s*<\/script>/i;

export function buildPreviewDocument(html: string, css: string, js: string): string {
  let doc = html && html.trim() ? html : "<!DOCTYPE html><html><head></head><body></body></html>";

  // Inline the CSS wherever a <link href="style.css"> would have gone.
  const styleTag = `<style>\n${css}\n</style>`;
  if (STYLE_LINK_RE.test(doc)) {
    doc = doc.replace(STYLE_LINK_RE, styleTag);
  } else if (/<\/head>/i.test(doc)) {
    doc = doc.replace(/<\/head>/i, `${styleTag}\n</head>`);
  } else if (/<head[^>]*>/i.test(doc)) {
    doc = doc.replace(/(<head[^>]*>)/i, `$1${styleTag}`);
  } else {
    doc = styleTag + doc;
  }

  // Console bridge goes right after <head> so it's active before any inline script runs.
  if (/<head[^>]*>/i.test(doc)) {
    doc = doc.replace(/(<head[^>]*>)/i, `$1${CONSOLE_BRIDGE}`);
  } else {
    doc = CONSOLE_BRIDGE + doc;
  }

  // Inline the JS wherever a <script src="script.js"> would have gone.
  const scriptTag = `<script>\n${js}\n</script>`;
  if (SCRIPT_SRC_RE.test(doc)) {
    doc = doc.replace(SCRIPT_SRC_RE, scriptTag);
  } else if (/<\/body>/i.test(doc)) {
    doc = doc.replace(/<\/body>/i, `${scriptTag}\n</body>`);
  } else {
    doc += scriptTag;
  }

  if (!/<!doctype/i.test(doc)) doc = `<!DOCTYPE html>\n${doc}`;
  return doc;
}
