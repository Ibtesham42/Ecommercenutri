"use client";

import { useEffect } from "react";

function readCookie(name: string): string | null {
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}

/**
 * Logs a referral click once per session when a `nut_ref` cookie is present (set by
 * middleware for `?ref=` visits, or by the /ref/[code] route). Mirrors the
 * BehaviorTracker beacon. Server-side dedupe (per anon, 24h) makes this idempotent.
 */
export function AffiliateTracker() {
  useEffect(() => {
    const code = readCookie("nut_ref");
    if (!code) return;
    const key = `nut_ref_click_${code}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      /* sessionStorage unavailable — server dedupe still applies */
    }
    try {
      void fetch("/api/affiliate/click", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code,
          landingPath: location.pathname,
          referrer: document.referrer || undefined,
        }),
        keepalive: true,
      }).catch(() => {});
    } catch {
      /* ignore */
    }
  }, []);
  return null;
}
