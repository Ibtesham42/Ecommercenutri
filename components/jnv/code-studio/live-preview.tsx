"use client";

import { useEffect, useMemo, useRef } from "react";
import { buildPreviewDocument } from "@/lib/jnv/code-studio/build-preview-doc";

export type ConsoleEntry = { id: string; type: "log" | "warn" | "error"; text: string };

let entryCounter = 0;
function nextEntryId(): string {
  entryCounter += 1;
  return `c${entryCounter}`;
}

/**
 * Sandboxed HTML/CSS/JS preview. `sandbox` deliberately omits
 * `allow-same-origin` — combined with `srcDoc` (never a real URL) this keeps
 * the previewed page in a fully opaque, isolated origin that cannot read
 * cookies/localStorage or reach anything else in the app, no matter what a
 * student's script does. `allow-popups-to-escape-sandbox` pairs with the
 * link-click interception in `build-preview-doc.ts`'s bridge script — links
 * open in a real, unsandboxed new tab instead of navigating the iframe
 * itself (which most real sites refuse to render via X-Frame-Options/CSP).
 */
export function LivePreview({
  html,
  css,
  js,
  onConsoleEntry,
}: {
  html: string;
  css: string;
  js: string;
  onConsoleEntry?: (entry: ConsoleEntry) => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const doc = useMemo(() => buildPreviewDocument(html, css, js), [html, css, js]);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (!iframeRef.current || e.source !== iframeRef.current.contentWindow) return;
      const data = e.data as { source?: string; type?: string; text?: string } | null;
      if (data && data.source === "jnv-code-studio" && data.type && typeof data.text === "string") {
        onConsoleEntry?.({ id: nextEntryId(), type: data.type as ConsoleEntry["type"], text: data.text });
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onConsoleEntry]);

  return (
    <iframe
      ref={iframeRef}
      title="Live preview"
      srcDoc={doc}
      sandbox="allow-scripts allow-modals allow-forms allow-popups allow-popups-to-escape-sandbox"
      className="size-full rounded-lg border-0 bg-white"
    />
  );
}
