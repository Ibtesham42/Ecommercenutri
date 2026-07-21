import type { Metadata } from "next";
import { JnvAiToolkitManager } from "@/components/admin/jnv/jnv-ai-toolkit-manager";

export const metadata: Metadata = { title: "JNV Smart Class — AI Toolkit", robots: { index: false } };

export default function JnvAiToolkitPage() {
  return (
    <div>
      <p className="mb-4 text-sm text-muted-foreground">
        Generate lesson plans, question papers, worksheets and more with Byte — review and edit
        the result before saving, printing or sharing it.
      </p>
      <JnvAiToolkitManager />
    </div>
  );
}
