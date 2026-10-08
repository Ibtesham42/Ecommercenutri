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
    <LegalPageView
      page={page}
      notice={
        returnSettings.returnsEnabled && (
          <p className="flex items-start gap-3 rounded-xl bg-oat px-4 py-3.5 text-sm text-oat-foreground">
            <RotateCcw className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden />
            <span>
              Eligible issues can be reported within{" "}
              <span className="font-semibold">{returnSettings.returnWindowDays} days</span> of delivery —
              see what qualifies below.
            </span>
          </p>
        )
      }
    />
  );
}
