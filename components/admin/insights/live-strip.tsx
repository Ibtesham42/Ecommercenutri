"use client";

import { useEffect, useRef, useState } from "react";
import { Radio, ShoppingCart, PackageCheck, IndianRupee } from "lucide-react";
import { getLiveSnapshot, type LiveSnapshot } from "@/lib/actions/admin/insights";

const POLL_MS = 45_000;

type Snap = Extract<LiveSnapshot, { ok: true }>;

/**
 * Real-time strip: live visitors, today's orders/revenue and the latest
 * cart-adds/orders. Polls a guarded server action every 45s, pauses while the
 * tab is hidden, and silently keeps the last snapshot on failures.
 */
export function LiveStrip() {
  const [snap, setSnap] = useState<Snap | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let disposed = false;
    const refresh = async () => {
      const res = await getLiveSnapshot().catch(() => null);
      if (!disposed && res?.ok) setSnap(res);
    };
    const start = () => {
      if (timer.current) return;
      void refresh();
      timer.current = setInterval(refresh, POLL_MS);
    };
    const stop = () => {
      if (timer.current) {
        clearInterval(timer.current);
        timer.current = null;
      }
    };
    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVisibility);
    start();
    return () => {
      disposed = true;
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  if (!snap) return null;

  return (
    <section className="rounded-2xl border bg-background p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="relative flex size-2.5">
          <span className="absolute inline-flex h-full w-full rounded-full bg-primary/60 motion-safe:animate-ping" />
          <span className="relative inline-flex size-2.5 rounded-full bg-primary" />
        </span>
        <h2 className="font-semibold">Right now</h2>
        <span className="text-xs text-muted-foreground">updates every 45s</span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1">
        <div className="min-w-36 shrink-0 rounded-lg bg-muted/40 p-3">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Radio className="size-3.5 text-primary" /> Live visitors
          </p>
          <p className="mt-1 text-xl font-bold tabular-nums">{snap.liveVisitors}</p>
          <p className="text-[11px] text-muted-foreground">active in the last 5 min</p>
        </div>
        <div className="min-w-36 shrink-0 rounded-lg bg-muted/40 p-3">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <IndianRupee className="size-3.5 text-primary" /> Revenue today
          </p>
          <p className="mt-1 text-xl font-bold tabular-nums">{snap.revenueTodayLabel}</p>
          <p className="text-[11px] text-muted-foreground">{snap.ordersToday} order{snap.ordersToday === 1 ? "" : "s"}</p>
        </div>
        <div className="min-w-52 shrink-0 rounded-lg bg-muted/40 p-3">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShoppingCart className="size-3.5 text-primary" /> Recently added to cart
          </p>
          {snap.latestCartAdds.length === 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">Nothing yet today</p>
          ) : (
            <ul className="mt-1 space-y-0.5 text-sm">
              {snap.latestCartAdds.slice(0, 3).map((c, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span className="min-w-0 truncate">{c.name}</span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">{c.agoLabel}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="min-w-52 shrink-0 rounded-lg bg-muted/40 p-3">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <PackageCheck className="size-3.5 text-primary" /> Recent orders
          </p>
          {snap.latestOrders.length === 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">No orders yet today</p>
          ) : (
            <ul className="mt-1 space-y-0.5 text-sm">
              {snap.latestOrders.slice(0, 3).map((o, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span className="min-w-0 truncate tabular-nums">{o.label}</span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">{o.agoLabel}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
