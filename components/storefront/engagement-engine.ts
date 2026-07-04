/**
 * Engagement tracking engine (heatmap + rage clicks + sampled session replay).
 *
 * Loaded lazily (dynamic import after idle) by <EngagementTracker>, so none of
 * this code is in the critical bundle. Everything is aggregated in memory and
 * flushed as ONE beacon per page visit per sink — no per-interaction network
 * calls. All listeners are passive; failures are swallowed (tracking must
 * never affect the shopping UX).
 *
 * Privacy: heat counters are anonymous aggregates; replay records normalized
 * coordinates/scroll/paths only (never DOM content, text or keys), so
 * passwords, payment details and personal data cannot be captured.
 */

import { trackClient } from "@/components/storefront/behavior-tracker";
import { getClientId } from "@/lib/client-id";

type SectionAgg = { c: number; h: number; t: number; v: number };
type ReplayEv = [number, number, number, number?];

const HOVER_DWELL_MS = 600;
const SECTION_TIME_CAP_MS = 120_000;
const RAGE_WINDOW_MS = 900;
const RAGE_RADIUS_PX = 32;
const RAGE_MIN_CLICKS = 3;
const RAGE_COOLDOWN_MS = 8_000;
const REPLAY_SAMPLE_RATE = 0.25;
const REPLAY_MOVE_MIN_MS = 120;
const REPLAY_MOVE_MIN_PX = 8;
const REPLAY_MAX_MOVES = 800;
const REPLAY_MAX_EVENTS = 900;

let started = false;

// --- Per-page state (reset on route change) ---
let path = "/";
let pageStart = 0;
let heat = new Map<string, SectionAgg>();
let seenView = new WeakSet<Element>();
let visibleSince = new Map<Element, { key: string; since: number }>();
let maxDepth = 0;
let pageClicks = 0;
let pageRage = 0;
let replayEv: ReplayEv[] = [];
let replayMoves = 0;
let flushed = false;

// --- Session state ---
let rageTimes: { t: number; x: number; y: number }[] = [];
let lastRageAt = 0;
let recording = false;
let recordingId = "";
let io: IntersectionObserver | null = null;
let hoverPending: { key: string; timer: number } | null = null;
let lastMove = { t: 0, x: 0, y: 0 };
let rescanTimers: number[] = [];

const now = () => performance.now();

function agg(key: string): SectionAgg {
  let a = heat.get(key);
  if (!a) {
    a = { c: 0, h: 0, t: 0, v: 0 };
    heat.set(key, a);
  }
  return a;
}

function heatKeyOf(el: Element | null): string | null {
  const hit = el?.closest?.("[data-heat]");
  return hit?.getAttribute("data-heat") || null;
}

function depthPct(): number {
  const doc = document.documentElement;
  const total = Math.max(1, doc.scrollHeight - window.innerHeight);
  return Math.max(0, Math.min(100, Math.round(((window.scrollY || 0) / total) * 100)));
}

function beacon(url: string, payload: unknown): void {
  try {
    const body = JSON.stringify(payload);
    if (navigator.sendBeacon?.(url, body)) return;
    void fetch(url, { method: "POST", body, keepalive: true }).catch(() => {});
  } catch {
    /* ignore */
  }
}

/** Close open visible-time intervals into the aggregates. */
function settleVisibleTime(): void {
  const t = now();
  for (const [el, v] of visibleSince) {
    const a = agg(v.key);
    a.t = Math.min(SECTION_TIME_CAP_MS, a.t + (t - v.since));
    visibleSince.set(el, { key: v.key, since: t });
  }
}

function flushPage(): void {
  if (flushed) return;
  flushed = true;
  settleVisibleTime();
  const dur = Math.round(now() - pageStart);

  const sections = [...heat.entries()]
    .filter(([, a]) => a.c || a.h || a.v || a.t > 500)
    .slice(0, 30)
    .map(([k, a]) => ({ k, c: a.c, h: a.h, t: Math.round(a.t), v: a.v }));

  if (dur > 1000 || sections.length) {
    beacon("/api/heat", { path, sections, scrollDepth: Math.max(maxDepth, depthPct()), timeMs: dur });
  }

  if (recording && (replayEv.length > 2 || dur > 3000)) {
    beacon("/api/replay", {
      id: recordingId,
      cid: getClientId() || undefined,
      path,
      w: Math.min(5000, Math.max(200, window.innerWidth)),
      h: Math.min(5000, Math.max(200, window.innerHeight)),
      dur: Math.min(3_600_000, dur),
      ev: replayEv.slice(0, REPLAY_MAX_EVENTS),
      clicks: Math.min(500, pageClicks),
      rage: Math.min(100, pageRage),
    });
  }
}

function resetPage(nextPath: string): void {
  path = nextPath;
  pageStart = now();
  heat = new Map();
  seenView = new WeakSet();
  visibleSince = new Map();
  maxDepth = 0;
  pageClicks = 0;
  pageRage = 0;
  replayEv = [];
  replayMoves = 0;
  flushed = false;
  observeSections();
}

function observeSections(): void {
  for (const t of rescanTimers) clearTimeout(t);
  rescanTimers = [];
  const scan = () => {
    if (!io) return;
    io.disconnect();
    // Cap observed nodes so pages with huge grids stay cheap.
    const els = document.querySelectorAll("[data-heat]");
    for (let i = 0; i < els.length && i < 150; i++) io.observe(els[i]);
  };
  // App Router swaps DOM after navigation; lazy sections mount later still.
  rescanTimers.push(window.setTimeout(scan, 350), window.setTimeout(scan, 2500));
}

function onIntersect(entries: IntersectionObserverEntry[]): void {
  const t = now();
  for (const e of entries) {
    const key = e.target.getAttribute("data-heat");
    if (!key) continue;
    if (e.isIntersecting) {
      if (!seenView.has(e.target)) {
        seenView.add(e.target);
        agg(key).v++;
      }
      if (!visibleSince.has(e.target)) visibleSince.set(e.target, { key, since: t });
    } else {
      const v = visibleSince.get(e.target);
      if (v) {
        const a = agg(v.key);
        a.t = Math.min(SECTION_TIME_CAP_MS, a.t + (t - v.since));
        visibleSince.delete(e.target);
      }
    }
  }
}

function rageLabel(el: Element | null): string {
  const key = heatKeyOf(el);
  if (key) return key;
  if (!el) return "unknown";
  const target = (el.closest("button, a, [role='button'], input, [disabled]") ?? el) as HTMLElement;
  const name =
    target.getAttribute("aria-label") ||
    target.getAttribute("name") ||
    target.id ||
    target.tagName.toLowerCase();
  return name.slice(0, 50);
}

function onClick(ev: MouseEvent): void {
  const t = now();
  const target = ev.target instanceof Element ? ev.target : null;
  pageClicks++;

  const key = heatKeyOf(target);
  if (key) agg(key).c++;

  if (recording && replayEv.length < REPLAY_MAX_EVENTS) {
    replayEv.push([
      Math.round(t - pageStart),
      1,
      Math.round((ev.clientX / window.innerWidth) * 1000),
      Math.round((ev.clientY / window.innerHeight) * 1000),
    ]);
  }

  // Rage detection: bursts of clicks in one small spot.
  rageTimes = rageTimes.filter(
    (c) => t - c.t < RAGE_WINDOW_MS && Math.hypot(c.x - ev.clientX, c.y - ev.clientY) < RAGE_RADIUS_PX,
  );
  rageTimes.push({ t, x: ev.clientX, y: ev.clientY });
  if (rageTimes.length >= RAGE_MIN_CLICKS && Date.now() - lastRageAt > RAGE_COOLDOWN_MS) {
    lastRageAt = Date.now();
    pageRage++;
    rageTimes = [];
    trackClient({ type: "RAGE_CLICK", source: rageLabel(target), path });
  }
}

function onMouseOver(ev: MouseEvent): void {
  const key = heatKeyOf(ev.target instanceof Element ? ev.target : null);
  if (hoverPending) {
    if (hoverPending.key === key) return;
    clearTimeout(hoverPending.timer);
    hoverPending = null;
  }
  if (!key) return;
  hoverPending = {
    key,
    timer: window.setTimeout(() => {
      agg(key).h++;
      hoverPending = null;
    }, HOVER_DWELL_MS),
  };
}

let scrollScheduled = false;
function onScroll(): void {
  if (scrollScheduled) return;
  scrollScheduled = true;
  requestAnimationFrame(() => {
    scrollScheduled = false;
    const d = depthPct();
    if (d > maxDepth) maxDepth = d;
    if (recording && replayEv.length < REPLAY_MAX_EVENTS) {
      const last = replayEv[replayEv.length - 1];
      if (!last || last[1] !== 2 || Math.abs(last[2] - d) >= 3) {
        replayEv.push([Math.round(now() - pageStart), 2, d]);
      }
    }
  });
}

function onPointerMove(ev: PointerEvent): void {
  if (!recording || replayMoves >= REPLAY_MAX_MOVES) return;
  const t = now();
  if (t - lastMove.t < REPLAY_MOVE_MIN_MS) return;
  if (Math.hypot(ev.clientX - lastMove.x, ev.clientY - lastMove.y) < REPLAY_MOVE_MIN_PX) return;
  lastMove = { t, x: ev.clientX, y: ev.clientY };
  replayMoves++;
  replayEv.push([
    Math.round(t - pageStart),
    0,
    Math.round((ev.clientX / window.innerWidth) * 1000),
    Math.round((ev.clientY / window.innerHeight) * 1000),
  ]);
}

function initReplaySampling(): void {
  try {
    let flag = sessionStorage.getItem("nut_rec");
    if (flag !== "1" && flag !== "0") {
      flag = Math.random() < REPLAY_SAMPLE_RATE ? "1" : "0";
      sessionStorage.setItem("nut_rec", flag);
    }
    if (flag === "1") {
      recordingId = sessionStorage.getItem("nut_rec_id") ?? crypto.randomUUID();
      sessionStorage.setItem("nut_rec_id", recordingId);
      recording = true;
    }
  } catch {
    recording = false; // no sessionStorage — skip replay, heat still works
  }
}

/** Called by the shell whenever the route changes (including the first). */
export function routeChange(nextPath: string): void {
  if (!started) return;
  if (nextPath === path && pageStart) return;
  if (pageStart) flushPage();
  resetPage(nextPath);
}

export function start(initialPath: string): void {
  if (started || typeof window === "undefined") return;
  started = true;
  initReplaySampling();

  // Count an impression as soon as ANY part of a section enters the viewport —
  // large / below-the-fold sections (footer, hero) rarely hit a high ratio, so
  // a 0.4 threshold starved them of impressions and made their click-rate
  // wildly unstable. The [0, 0.5] thresholds still let us prefer the more-
  // visible state for time-in-view accounting.
  io = new IntersectionObserver(onIntersect, { threshold: [0, 0.5] });

  document.addEventListener("click", onClick, { capture: true, passive: true });
  window.addEventListener("scroll", onScroll, { passive: true });
  if (window.matchMedia?.("(hover: hover) and (pointer: fine)").matches) {
    document.addEventListener("mouseover", onMouseOver, { passive: true });
  }
  if (recording) window.addEventListener("pointermove", onPointerMove, { passive: true });

  // Flush when the page is being left/hidden — the only reliable exit hooks.
  window.addEventListener("pagehide", flushPage);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      flushPage();
    } else {
      // Back from the background: keep counting on the same page, and restamp
      // visible-since so the hidden period never counts as time-in-view.
      flushed = false;
      heat = new Map();
      replayEv = [];
      replayMoves = 0;
      pageClicks = 0;
      pageRage = 0;
      pageStart = now();
      const t = now();
      for (const [el, v] of visibleSince) visibleSince.set(el, { key: v.key, since: t });
    }
  });

  resetPage(initialPath);
}
