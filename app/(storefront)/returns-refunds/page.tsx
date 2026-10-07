import type { Metadata } from "next";
import { RotateCcw } from "lucide-react";
import { buildMetadata } from "@/lib/seo";
import { getLegalPage } from "@/lib/queries/content";
import { getReturnSettings } from "@/lib/queries/settings";
import { LegalPageView } from "@/components/storefront/legal-page-view";

export const metadata: Metadata = buildMetadata({
  title: "Returns & Refunds Policy",
  description: "How returns, replacements and refunds work for Nutriyet orders.",
  path: "/returns-refunds",
});

// Return window is a live, admin-configurable setting — render per request so
// this page never drifts from the real value (see lib/queries/settings.ts).
export const dynamic = "force-dynamic";

export default async function ReturnsRefundsPage() {
  const [page, returnSettings] = await Promise.all([
    getLegalPage("returns-refunds"),
    getReturnSettings(),
  ]);

  return (
    <>
      {returnSettings.returnsEnabled && (
        <div className="mx-auto w-full max-w-3xl px-4 pt-12">
          <div className="flex items-center gap-3 rounded-2xl border border-primary/25 bg-primary/5 p-4 text-sm font-medium text-primary">
            <RotateCcw className="size-5 shrink-0" aria-hidden />
            <span>
              Eligible issues can be reported within{" "}
              <span className="font-semibold">{returnSettings.returnWindowDays} days</span> of delivery —
              see what qualifies below.
            </span>
          </div>
        </div>
      )}
      <LegalPageView page={page} />
    </>
  );
}
