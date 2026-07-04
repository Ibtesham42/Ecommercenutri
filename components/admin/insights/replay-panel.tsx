"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, Loader2, Smartphone, Monitor, Tablet, ShoppingCart, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getReplayDetail } from "@/lib/actions/admin/insights";
import type { ReplayDetail, ReplaySummary, ReplayPage } from "@/lib/queries/engagement";
import { cn } from "@/lib/utils";

function fmtClock(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function fmtWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

const DEVICE_ICON = { mobile: Smartphone, tablet: Tablet, desktop: Monitor } as const;

/** List of recorded sessions + the dependency-free replay player dialog. */
export function ReplayPanel({ items }: { items: ReplaySummary[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ReplayDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function open(id: string) {
    setOpenId(id);
    setDetail(null);
    setError(null);
    setLoading(true);
    const res = await getReplayDetail(id).catch(() => null);
    setLoading(false);
    if (res?.ok) setDetail(res.replay);
    else setError(res && !res.ok ? res.error : "Couldn't load the recording.");
  }

  if (items.length === 0) {
    return (
      <p className="py-5 text-center text-sm text-muted-foreground">
        No recordings yet — a sample of shopper sessions is recorded automatically as visitors browse.
      </p>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="py-2 pr-3 font-medium">When</th>
              <th className="py-2 pr-3 font-medium">Device</th>
              <th className="py-2 pr-3 text-right font-medium">Duration</th>
              <th className="py-2 pr-3 text-right font-medium">Pages</th>
              <th className="py-2 pr-3 text-right font-medium">Clicks</th>
              <th className="py-2 pr-3 font-medium">Signals</th>
              <th className="py-2 text-right font-medium" />
            </tr>
          </thead>
          <tbody>
            {items.map((r) => {
              const Icon = DEVICE_ICON[(r.device as keyof typeof DEVICE_ICON) ?? "desktop"] ?? Monitor;
              return (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="py-2 pr-3 whitespace-nowrap">{fmtWhen(r.startedAt)}</td>
                  <td className="py-2 pr-3">
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                      <Icon className="size-3.5" /> {r.device ?? "?"}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">{fmtClock(r.duration)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{r.pageCount}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{r.clickCount}</td>
                  <td className="py-2 pr-3">
                    <span className="flex flex-wrap gap-1">
                      {r.purchased ? (
                        <Badge className="text-[10px]">Purchased</Badge>
                      ) : r.reachedCheckout ? (
                        <Badge variant="secondary" className="gap-1 text-[10px]">
                          <ShoppingCart className="size-3" /> Checkout abandoned
                        </Badge>
                      ) : null}
                      {r.rageCount > 0 && (
                        <Badge variant="destructive" className="gap-1 text-[10px]">
                          <AlertTriangle className="size-3" /> {r.rageCount} rage
                        </Badge>
                      )}
                      {r.signedIn && (
                        <Badge variant="outline" className="text-[10px]">
                          Signed in
                        </Badge>
                      )}
                    </span>
                  </td>
                  <td className="py-2 text-right">
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => open(r.id)}>
                      <Play className="size-3.5" /> Replay
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={!!openId} onOpenChange={(o) => !o && setOpenId(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Session replay</DialogTitle>
          </DialogHeader>
          {loading ? (
            <div className="grid h-64 place-items-center">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <p className="py-10 text-center text-sm text-muted-foreground">{error}</p>
          ) : detail ? (
            <ReplayPlayer detail={detail} />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Canvas-free player: renders the recorded viewport as a schematic page
 * (path bar + wireframe + scroll indicator) and animates the cursor, clicks
 * and scrolling on a rAF timeline with scrubbing and speed control.
 */
function ReplayPlayer({ detail }: { detail: ReplayDetail }) {
  const pages = detail.pages;
  const offsets = useMemo(() => {
    const out: number[] = [];
    let acc = 0;
    for (const p of pages) {
      out.push(acc);
      acc += Math.max(1, p.dur);
    }
    return out;
  }, [pages]);
  const total = useMemo(
    () => pages.reduce((n, p) => n + Math.max(1, p.dur), 0),
    [pages],
  );

  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const raf = useRef<number | null>(null);
  const last = useRef<number | null>(null);

  useEffect(() => {
    if (!playing) {
      if (raf.current) cancelAnimationFrame(raf.current);
      last.current = null;
      return;
    }
    const tick = (ts: number) => {
      if (last.current !== null) {
        setT((cur) => {
          const next = cur + (ts - last.current!) * speed;
          if (next >= total) {
            setPlaying(false);
            return total;
          }
          return next;
        });
      }
      last.current = ts;
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      last.current = null;
    };
  }, [playing, speed, total]);

  // Locate the current page + local time.
  let pageIdx = 0;
  for (let i = 0; i < pages.length; i++) {
    if (t >= offsets[i]) pageIdx = i;
  }
  const page: ReplayPage | undefined = pages[pageIdx];
  const localT = page ? Math.min(t - offsets[pageIdx], page.dur) : 0;

  // Cursor position: latest move/click sample at or before localT (with a
  // linear interpolation to the next one for smooth motion).
  let cx = 500;
  let cy = 300;
  let scroll = 0;
  const recentClicks: { x: number; y: number; age: number }[] = [];
  if (page) {
    let prevPt: { t: number; x: number; y: number } | null = null;
    let nextPt: { t: number; x: number; y: number } | null = null;
    for (const ev of page.ev) {
      const [dt, kind, a, b] = ev;
      if (kind === 2) {
        if (dt <= localT) scroll = a;
        continue;
      }
      const pt = { t: dt, x: a, y: b ?? 0 };
      if (dt <= localT) {
        prevPt = pt;
        if (kind === 1 && localT - dt < 600) recentClicks.push({ x: a, y: b ?? 0, age: localT - dt });
      } else if (!nextPt) {
        nextPt = pt;
      }
    }
    if (prevPt && nextPt && nextPt.t > prevPt.t) {
      const f = Math.min(1, (localT - prevPt.t) / (nextPt.t - prevPt.t));
      cx = prevPt.x + (nextPt.x - prevPt.x) * f;
      cy = prevPt.y + (nextPt.y - prevPt.y) * f;
    } else if (prevPt) {
      cx = prevPt.x;
      cy = prevPt.y;
    } else if (nextPt) {
      cx = nextPt.x;
      cy = nextPt.y;
    }
  }

  const isMobileViewport = page ? page.h > page.w : false;

  return (
    <div className="space-y-3">
      {/* Path bar */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-md border bg-muted/40 px-2 py-1 font-mono">{page?.path ?? "—"}</span>
        <span className="text-muted-foreground">
          page {pageIdx + 1}/{pages.length} · {detail.device ?? "?"} · {fmtWhen(detail.startedAt)}
        </span>
      </div>

      {/* Schematic viewport */}
      <div
        className={cn(
          "relative mx-auto overflow-hidden rounded-xl border bg-muted/20",
          isMobileViewport ? "h-[420px] w-[236px]" : "h-[340px] w-full max-w-[604px]",
        )}
      >
        {/* Page wireframe (static, schematic) */}
        <div className="pointer-events-none absolute inset-0 p-3 opacity-40">
          <div className="h-5 w-full rounded bg-muted" />
          <div className="mt-2 h-16 w-full rounded bg-muted/70" />
          <div className="mt-2 grid grid-cols-3 gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-12 rounded bg-muted/60" />
            ))}
          </div>
          <div className="mt-2 h-3 w-2/3 rounded bg-muted/50" />
          <div className="mt-1.5 h-3 w-1/2 rounded bg-muted/50" />
        </div>

        {/* Scroll position track */}
        <div className="absolute inset-y-2 right-1.5 w-1 rounded-full bg-muted/60">
          <div
            className="absolute w-full rounded-full bg-primary/70 transition-[top] duration-150"
            style={{ top: `${Math.min(85, scroll * 0.85)}%`, height: "15%" }}
          />
        </div>

        {/* Click ripples */}
        {recentClicks.map((c, i) => (
          <span
            key={`${pageIdx}-${i}-${c.x}-${c.y}`}
            className="pointer-events-none absolute size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary"
            style={{
              left: `${c.x / 10}%`,
              top: `${c.y / 10}%`,
              opacity: Math.max(0, 1 - c.age / 600),
              transform: `translate(-50%,-50%) scale(${0.5 + c.age / 400})`,
            }}
          />
        ))}

        {/* Cursor */}
        <span
          className="pointer-events-none absolute z-10 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_0_3px_rgba(255,255,255,0.7)]"
          style={{ left: `${cx / 10}%`, top: `${cy / 10}%` }}
        />
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            if (!playing && t >= total) setT(0);
            setPlaying((p) => !p);
          }}
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="tabular-nums"
          onClick={() => setSpeed((s) => (s === 1 ? 2 : s === 2 ? 4 : 1))}
        >
          {speed}×
        </Button>
        <input
          type="range"
          min={0}
          max={total}
          value={Math.round(t)}
          onChange={(e) => {
            setT(Number(e.target.value));
            setPlaying(false);
          }}
          className="min-w-0 flex-1 accent-primary"
          aria-label="Seek"
        />
        <span className="text-xs tabular-nums text-muted-foreground">
          {fmtClock(t)} / {fmtClock(total)}
        </span>
      </div>
    </div>
  );
}
