"use client";

import { useEffect } from "react";

/**
 * Registers the service worker in production only. Kept out of dev to avoid
 * caching surprises during local work.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      typeof navigator === "undefined" ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }
    const onLoad = () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          // Proactively check for a newer SW so clients with a stale worker
          // (e.g. an alias origin that now redirects) pick up the fix promptly.
          reg.update().catch(() => {});
        })
        .catch(() => {
          /* registration is best-effort */
        });
    };
    window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);

  return null;
}
