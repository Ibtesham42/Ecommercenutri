"use client";

import { useEffect } from "react";

export type TrackPayload = {
  type:
    | "PRODUCT_VIEW"
    | "CATEGORY_VIEW"
    | "SEARCH"
    | "CART_ADD"
    | "RECO_CLICK"
    | "CLICK"
    | "PAGE_VIEW"
    | "CHECKOUT_START";
  productId?: string;
  categoryId?: string;
  query?: string;
  source?: string;
  referrer?: string;
};

/** Fire-and-forget client tracking — safe to call from anywhere. Uses keepalive
 *  so it survives navigation; failures are swallowed (tracking never blocks UX). */
export function trackClient(payload: TrackPayload): void {
  try {
    void fetch("/api/track", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}

/** Records a single event once when mounted (e.g. a product/category/search view). */
export function BehaviorTracker({ event }: { event: TrackPayload }) {
  const key = JSON.stringify(event);
  useEffect(() => {
    trackClient(event);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return null;
}
