"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";

/**
 * Module-wide error boundary for /jnv — without this, ANY unhandled error
 * anywhere under the route (a bad query param, a transient Neon cold-start
 * that both the query's own retry AND this boundary would need to fail,
 * etc.) fell straight through to Next.js's bare default error page, with
 * no JNV branding and no way back except manually editing the URL.
 */
export default function JnvError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[jnv] unhandled error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <span className="grid size-16 place-items-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
        <AlertTriangle className="size-8" />
      </span>
      <h1 className="mt-4 text-xl font-bold">Something went wrong</h1>
      <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
        This page hit an unexpected error. Try again, or head back to the class list.
      </p>
      <div className="mt-6 flex gap-2">
        <button
          type="button"
          onClick={reset}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <RotateCcw className="size-4" /> Try again
        </button>
        <Link
          href="/jnv"
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-blue-300 hover:text-blue-700 dark:border-slate-700 dark:text-slate-300"
        >
          Back to classes
        </Link>
      </div>
    </div>
  );
}
