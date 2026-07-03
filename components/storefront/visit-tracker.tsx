"use client";

import { useEffect } from "react";
import { trackClient } from "@/components/storefront/behavior-tracker";

const SESSION_KEY = "nut_pv";

/**
 * Records one PAGE_VIEW per browser session — the top-of-funnel "visitor"
 * signal for admin analytics. The referrer is sent only when it's a different
 * origin (external traffic source); same-site navigations stay untracked.
 * Renders nothing; failures never affect the UX.
 */
export function VisitTracker(): null {
  useEffect(() => {
    try {
      if (sessionStorage.getItem(SESSION_KEY)) return;
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      return; // private mode without sessionStorage — skip rather than double-count
    }
    let referrer: string | undefined;
    try {
      if (document.referrer && new URL(document.referrer).origin !== location.origin) {
        referrer = document.referrer;
      }
    } catch {
      /* unparsable referrer — send nothing */
    }
    trackClient({ type: "PAGE_VIEW", referrer });
  }, []);
  return null;
}
