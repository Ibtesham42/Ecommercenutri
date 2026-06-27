"use client";

import type { ReactNode } from "react";
import { trackClient } from "@/components/storefront/behavior-tracker";

/** Wraps a recommendation strip and records a RECO_CLICK (with its source) when a
 *  shopper clicks through to a product — powering the admin click-rate analytics.
 *  Uses event delegation so it works for any grid without instrumenting cards. */
export function RecoClickArea({
  source,
  children,
}: {
  source: string;
  children: ReactNode;
}) {
  return (
    <div
      onClickCapture={(e) => {
        const link = (e.target as HTMLElement).closest?.('a[href^="/products/"]');
        if (link) trackClient({ type: "RECO_CLICK", source });
      }}
    >
      {children}
    </div>
  );
}
