"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Route-scoped error boundary for the whole AI Marketing admin section
 * (Dashboard/Calendar/Queue/Scheduled/Published/Failed/Campaigns/Analytics/
 * Templates/Settings/Intelligence). Before this, a page failing to load —
 * a Neon cold-start P1001, a transient query error — fell through to
 * Next.js's default error page (a generic crash screen, no retry, no context)
 * since there was no error.tsx anywhere above /admin/insights. Now it shows a
 * friendly fallback with a retry action, and the Social tabs nav (rendered by
 * the layout, a sibling of this boundary) stays usable so an admin can
 * navigate to a different tab instead of being stuck on a dead page.
 */
export default function SocialAdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[admin/social] render error:", error);
  }, [error]);

  return (
    <div className="rounded-2xl border border-dashed p-10 text-center">
      <AlertTriangle className="mx-auto size-10 text-muted-foreground/50" />
      <h2 className="mt-3 font-semibold">This page couldn&apos;t load</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        Something went wrong loading this AI Marketing page — often just a momentary database hiccup.
        Nothing was lost; your drafts, campaigns and scheduled posts are safe.
      </p>
      <Button onClick={reset} variant="outline" className="mt-4 gap-1.5">
        <RefreshCw className="size-4" /> Try again
      </Button>
    </div>
  );
}
