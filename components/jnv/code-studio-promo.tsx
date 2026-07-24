import Link from "next/link";
import { Code2, ArrowRight } from "lucide-react";

/**
 * Server-renderable promo card for the new Code Studio module — deliberately
 * a plain link, not a client component, so the JNV home page never pulls in
 * CodeMirror/Pyodide just to advertise the feature.
 */
export function CodeStudioPromo() {
  return (
    <Link
      href="/jnv/code-studio"
      className="group flex items-center gap-4 rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-600 to-violet-600 p-5 text-white shadow-elev-1 transition-transform hover-lift dark:border-indigo-900"
    >
      <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-white/15">
        <Code2 className="size-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-bold">New: Code Studio</span>
        <span className="block text-sm text-indigo-100">
          Write &amp; run HTML, CSS, JavaScript and Python right in your browser — with an AI coding mentor.
        </span>
      </span>
      <ArrowRight className="size-5 shrink-0 transition-transform group-hover:translate-x-1" />
    </Link>
  );
}
