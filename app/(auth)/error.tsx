"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Auth-section error boundary — see app/(storefront)/error.tsx for why this
 *  exists. Keeps the centered logo/background chrome from layout.tsx visible. */
export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[auth] unhandled error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center px-4 text-center">
      <AlertTriangle className="size-9 text-muted-foreground/70" strokeWidth={1.5} />
      <span className="mt-4 block h-0.5 w-9 rounded-full bg-gold" />
      <h1 className="mt-4 font-heading text-xl font-semibold tracking-tight">
        Something went wrong
      </h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        This page hit an unexpected error. Try again, or head back to the homepage.
      </p>
      <div className="mt-6 flex gap-2">
        <Button onClick={reset} className="h-10 rounded-xl px-5 font-semibold">
          <RotateCcw className="size-4" /> Try again
        </Button>
        <Button asChild variant="outline" className="h-10 rounded-xl px-5 font-semibold">
          <Link href="/">Back home</Link>
        </Button>
      </div>
    </div>
  );
}
