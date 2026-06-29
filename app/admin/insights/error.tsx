"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Route-scoped error boundary for AI Insights. If the dashboard ever throws, this
 * shows a friendly fallback (with retry) instead of a global crash — and the rest of
 * the admin panel (layout, nav, other sections) stays fully functional.
 */
export default function InsightsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[admin/insights] render error:", error);
  }, [error]);

  return (
    <div className="rounded-2xl border border-dashed p-10 text-center">
      <AlertTriangle className="mx-auto size-10 text-muted-foreground/50" />
      <h2 className="mt-3 font-semibold">Insights couldn&apos;t load</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        Something went wrong building your business intelligence dashboard. Your data is safe — this
        only affects this page.
      </p>
      <Button onClick={reset} variant="outline" className="mt-4 gap-1.5">
        <RefreshCw className="size-4" /> Try again
      </Button>
    </div>
  );
}
