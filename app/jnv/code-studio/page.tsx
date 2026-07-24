import type { Metadata } from "next";
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
 *
 * The hero title/intro lives inside `ProjectPicker` (the hub view), not
 * here — once a project is open, `EditorWorkspace` shows the project title
 * instead. Keeping both here would waste a full screen of scroll on mobile
 * before the actual editor is visible (confirmed via a real screenshot).
 */
export default function CodeStudioPage() {
  return (
    <div className="py-8 sm:py-12 2xl:py-16">
      <div className={JNV_CONTAINER}>
        <CodeStudioLoader />
      </div>
    </div>
  );
}
