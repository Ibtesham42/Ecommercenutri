"use client";

import dynamic from "next/dynamic";

// CodeMirror/Pyodide only make sense in the browser (they touch `document`
// and load a WASM runtime from a CDN) — `ssr: false` keeps them out of the
// server render entirely, and this indirection exists only because
// `next/dynamic(..., { ssr: false })` isn't allowed directly inside a Server
// Component (app/jnv/code-studio/page.tsx).
const CodeStudioApp = dynamic(() => import("./code-studio-app").then((m) => m.CodeStudioApp), {
  ssr: false,
  loading: () => (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-32 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
      ))}
    </div>
  ),
});

export function CodeStudioLoader() {
  return <CodeStudioApp />;
}
