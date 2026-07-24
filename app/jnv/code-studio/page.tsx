import type { Metadata } from "next";
import { Code2 } from "lucide-react";
import { JNV_CONTAINER } from "@/lib/jnv/ui";
import { CodeStudioLoader } from "@/components/jnv/code-studio/code-studio-loader";

export const metadata: Metadata = {
  title: { absolute: "Code Studio | JNV Smart Class" },
  description: "Learn HTML, CSS, JavaScript and Python with a live editor, instant preview and an AI coding mentor.",
};

/**
 * A separate learning module alongside the Notes Portal — does not touch any
 * of the existing upload/browse/viewer functionality. Everything under here
 * is client-only and local-storage-backed (see docs/jnv-smart-class.md and
 * lib/jnv/code-studio/local-store.ts): there is deliberately no server-side
 * project storage for student code.
 */
export default function CodeStudioPage() {
  return (
    <div className="py-8 sm:py-12 2xl:py-16">
      <div className={JNV_CONTAINER}>
        <div className="mb-8 text-center sm:mb-12">
          <span className="mx-auto mb-3 grid size-12 place-items-center rounded-2xl bg-indigo-600 text-white shadow-elev-1">
            <Code2 className="size-6" />
          </span>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">Code Studio</h1>
          <p className="mx-auto mt-3 max-w-xl text-base text-slate-500 dark:text-slate-400">
            Write HTML, CSS, JavaScript and Python right in your browser — with live preview, console output and an
            AI mentor to help you along the way.
          </p>
        </div>

        <CodeStudioLoader />
      </div>
    </div>
  );
}
