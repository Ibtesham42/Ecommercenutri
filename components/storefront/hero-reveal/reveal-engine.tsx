"use client";

import { Fragment, useEffect, useMemo, useRef } from "react";
import { cldUrl } from "@/lib/cld";
import type { HeroRevealSettings } from "@/lib/hero-reveal";
import {
  BASE_STAGE_H,
  DEFAULT_PIECE_SPRITE,
  MOUTH,
  PHYSICS,
  STAGE,
  TIMELINE,
  packetClipPath,
  speedToStaggerMs,
  speedToTimeScale,
  stripClipPath,
} from "@/lib/hero-reveal-config";
import { stepPiece, type PieceState } from "./physics";

/**
 * The lazy "Product Reveal" chunk — one rAF master clock drives the packet
 * phases (entrance → wobble → rip → tilt) and the falling-piece physics, then
 * holds, fades and loops. All per-frame writes go straight to element refs
 * (transform/opacity only — composited, no layout), so React renders once per
 * cycle geometry, not per frame. The parent shell gates mounting (in-view,
 * reduced-motion, error boundary); this component only ever runs when wanted.
 */

const easeOutCubic = (p: number) => 1 - Math.pow(1 - p, 3);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const rand = (a: number, b: number) => a + Math.random() * (b - a);

/** Progress 0..1 of a timeline phase at scaled-clock second `t`. */
const phase = (t: number, p: { start: number; dur: number }) =>
  clamp01((t - p.start) / p.dur);

type Geometry = {
  w: number;
  h: number;
  /** Stage-height scale factor vs the 320px reference. */
  k: number;
  /** Packet box (px) + bottom-center pivot. */
  pw: number;
  ph: number;
  cx: number;
  floorY: number;
};

type EngineState = {
  geo: Geometry | null;
  mode: "idle" | "run" | "hold" | "fade";
  /** Scaled timeline clock (s) for "run"; real elapsed (s) for idle/hold/fade. */
  clock: number;
  pieces: PieceState[];
};

export default function RevealEngine({
  settings,
  active,
}: {
  settings: HeroRevealSettings;
  active: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const packetWrapRef = useRef<HTMLDivElement>(null);
  const stripWrapRef = useRef<HTMLDivElement>(null);
  const packetShadowRef = useRef<HTMLDivElement>(null);
  const pieceRefs = useRef<(HTMLImageElement | null)[]>([]);
  const pieceShadowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const state = useRef<EngineState>({ geo: null, mode: "idle", clock: 0, pieces: [] });
  const activeRef = useRef(active);
  activeRef.current = active;

  const packetSrc = useMemo(
    () => cldUrl(settings.packetImage, { w: 480, crop: "fit" }),
    [settings.packetImage],
  );
  const pieceSrc = useMemo(
    () =>
      settings.pieceImage
        ? cldUrl(settings.pieceImage, { w: 64, crop: "fit" })
        : DEFAULT_PIECE_SPRITE,
    [settings.pieceImage],
  );

  // Piece slots are fixed per mount; small (mobile) stages cap the count.
  const slots = settings.pieceCount;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const s = state.current;
    const timeScale = speedToTimeScale(settings.speed);
    const staggerSec = speedToStaggerMs(settings.speed) / 1000;

    /** (Re)compute geometry + reset the whole cycle. */
    const init = () => {
      const rect = root.getBoundingClientRect();
      if (rect.width < 40 || rect.height < 40) return;
      const k = rect.height / BASE_STAGE_H;
      const geo: Geometry = {
        w: rect.width,
        h: rect.height,
        k,
        pw: rect.width * 0.52,
        ph: rect.height * 0.62,
        cx: rect.width / 2,
        floorY: rect.height - 6 * k,
      };
      s.geo = geo;
      s.mode = "idle";
      s.clock = 0;

      const smallStage = rect.width < STAGE.tablet.w;
      const count = Math.min(slots, smallStage ? STAGE.mobileMaxPieces : slots);
      s.pieces = Array.from({ length: count }, (_, i) => ({
        x: 0,
        y: 0,
        // Pour direction is +x; a couple of pieces dribble slightly backwards.
        vx: rand(PHYSICS.spawnVx[0], PHYSICS.spawnVx[1]) * (Math.random() < 0.2 ? -0.4 : 1) * k,
        vy: rand(PHYSICS.spawnVy[0], PHYSICS.spawnVy[1]) * k,
        rot: rand(0, 360),
        spin: rand(PHYSICS.spawnSpin[0], PHYSICS.spawnSpin[1]),
        size: rand(PHYSICS.pieceSize[0], PHYSICS.pieceSize[1]) * k,
        bounces: 0,
        grounded: false,
        resting: false,
        born: TIMELINE.spawnStart + i * staggerSec,
        alive: false,
      }));

      // Static layout: packet + strip share one box pivoting at bottom-center.
      const left = `${geo.cx - geo.pw / 2}px`;
      const top = `${geo.floorY - geo.ph}px`;
      for (const el of [packetWrapRef.current, stripWrapRef.current]) {
        if (!el) continue;
        el.style.left = left;
        el.style.top = top;
        el.style.width = `${geo.pw}px`;
        el.style.height = `${geo.ph}px`;
        el.style.opacity = "0";
      }
      const shadow = packetShadowRef.current;
      if (shadow) {
        const sw = geo.pw * 0.85;
        const sh = 16 * k;
        shadow.style.left = `${geo.cx - sw / 2}px`;
        shadow.style.top = `${geo.floorY - sh / 2}px`;
        shadow.style.width = `${sw}px`;
        shadow.style.height = `${sh}px`;
        shadow.style.opacity = "0";
      }
      for (const el of [...pieceRefs.current, ...pieceShadowRefs.current]) {
        if (el) el.style.display = "none";
      }
      root.style.opacity = "1";
    };

    /** Mouth point in stage coords under the current packet tilt. */
    const mouthPoint = (geo: Geometry, tiltDeg: number) => {
      const rad = (tiltDeg * Math.PI) / 180;
      const dx0 = (MOUTH.x - 0.5 + rand(-MOUTH.xJitter, MOUTH.xJitter)) * geo.pw;
      const dy0 = -geo.ph * (1 - MOUTH.y);
      return {
        x: geo.cx + dx0 * Math.cos(rad) - dy0 * Math.sin(rad),
        y: geo.floorY + dx0 * Math.sin(rad) + dy0 * Math.cos(rad),
      };
    };

    const frame = (dt: number) => {
      const geo = s.geo;
      if (!geo) return;

      if (s.mode === "idle") {
        s.clock += dt;
        if (s.clock >= settings.delaySec) {
          s.mode = "run";
          s.clock = 0;
        }
        return;
      }

      if (s.mode === "hold") {
        s.clock += dt; // real seconds — the admin delay is wall-clock
        if (s.clock >= settings.delaySec) {
          s.mode = "fade";
          s.clock = 0;
        }
        return;
      }

      if (s.mode === "fade") {
        s.clock += dt * timeScale;
        const p = clamp01(s.clock / TIMELINE.fadeOut);
        if (rootRef.current) rootRef.current.style.opacity = String(1 - p);
        if (p >= 1) init(); // loop: fresh randomness each cycle
        return;
      }

      // --- mode === "run": one scaled clock drives packet phases + physics ---
      s.clock += dt * timeScale;
      const t = s.clock;

      const pe = easeOutCubic(phase(t, TIMELINE.entrance));
      const pw = phase(t, TIMELINE.wobble);
      const pr = phase(t, TIMELINE.rip);
      const pt = easeOutCubic(phase(t, TIMELINE.tilt));

      const tilt = TIMELINE.tilt.deg * pt;
      const wobble = pw > 0 && pw < 1 ? Math.sin(pw * Math.PI * 3) * 1.6 * (1 - pw) : 0;
      const rise = (1 - pe) * 24 * geo.k;
      const scale = 0.96 + 0.04 * pe;

      const packet = packetWrapRef.current;
      if (packet) {
        packet.style.opacity = String(pe);
        packet.style.transform = `translate3d(0, ${rise}px, 0) scale(${scale}) rotate(${tilt + wobble}deg)`;
      }
      const strip = stripWrapRef.current;
      if (strip) {
        // Rides with the packet until the rip, then flies off and fades.
        const fly = easeOutCubic(pr);
        strip.style.opacity = String(pe * (pr < 0.6 ? 1 : 1 - (pr - 0.6) / 0.4));
        strip.style.transform =
          pr <= 0
            ? `translate3d(0, ${rise}px, 0) scale(${scale}) rotate(${wobble}deg)`
            : `translate3d(${14 * geo.k * fly}px, ${rise - 40 * geo.k * fly}px, 0) scale(${scale}) rotate(${-26 * fly}deg)`;
      }
      const shadow = packetShadowRef.current;
      if (shadow) shadow.style.opacity = String(0.3 * pe);

      // Pieces: spawn on schedule, integrate, paint.
      const params = {
        gravity: PHYSICS.gravity * geo.k,
        restitution: PHYSICS.restitution,
        maxBounces: PHYSICS.maxBounces,
        bounceCutoff: PHYSICS.bounceCutoff * geo.k,
        rollDecel: PHYSICS.rollDecel * geo.k,
        restVx: PHYSICS.restVx * geo.k,
        floorY: geo.floorY,
      };
      let allResting = true;
      s.pieces.forEach((piece, i) => {
        if (!piece.alive) {
          if (t >= piece.born) {
            const m = mouthPoint(geo, tilt);
            piece.x = m.x;
            piece.y = m.y;
            piece.alive = true;
            const el = pieceRefs.current[i];
            const sh = pieceShadowRefs.current[i];
            if (el) {
              el.style.display = "block";
              el.style.width = `${piece.size}px`;
              el.style.height = `${piece.size}px`;
              el.style.willChange = "transform";
            }
            if (sh) sh.style.display = "block";
          } else {
            allResting = false;
            return;
          }
        }

        const wasResting = piece.resting;
        stepPiece(piece, dt * timeScale, params);
        if (!piece.resting) allResting = false;

        const el = pieceRefs.current[i];
        if (el) {
          el.style.transform = `translate3d(${piece.x - piece.size / 2}px, ${piece.y - piece.size / 2}px, 0) rotate(${piece.rot}deg)`;
          if (piece.resting && !wasResting) el.style.willChange = "auto";
        }
        const sh = pieceShadowRefs.current[i];
        if (sh) {
          // Shadow sharpens + darkens as the piece approaches the ground.
          const heightFrac = clamp01((params.floorY - piece.size / 2 - piece.y) / (geo.h * 0.5));
          const sw = piece.size * (1 + 0.5 * heightFrac);
          sh.style.width = `${sw}px`;
          sh.style.height = `${piece.size * 0.28}px`;
          sh.style.opacity = String(0.28 - 0.22 * heightFrac);
          sh.style.transform = `translate3d(${piece.x - sw / 2}px, ${geo.floorY - piece.size * 0.14}px, 0)`;
        }
      });

      // Cycle complete once the rip is done and every piece has settled.
      if (allResting && pr >= 1 && s.pieces.length > 0) {
        s.mode = "hold";
        s.clock = 0;
      }
    };

    init();

    // rAF loop — the delta clamp prevents a huge integration jump after a
    // stall, and `last` resets whenever `active` flips back on (no time jump).
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (!activeRef.current) return; // paused: keep `last` fresh, do nothing
      frame(dt);
    };
    raf = requestAnimationFrame(loop);

    const ro = new ResizeObserver(() => init());
    ro.observe(root);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [settings.speed, settings.delaySec, settings.pieceCount, slots]);

  const shadowBg = "radial-gradient(ellipse at center, rgba(0,0,0,0.35), transparent 70%)";

  return (
    <div ref={rootRef} className="absolute inset-0" style={{ opacity: 0 }}>
      <div
        ref={packetShadowRef}
        className="absolute rounded-[50%]"
        style={{ background: shadowBg, filter: "blur(6px)", opacity: 0 }}
      />
      <div ref={packetWrapRef} className="absolute" style={{ transformOrigin: "50% 100%", opacity: 0 }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- transform-driven sprite */}
        <img
          src={packetSrc}
          alt=""
          draggable={false}
          className="size-full object-contain object-bottom"
          style={{ clipPath: packetClipPath() }}
        />
      </div>
      <div ref={stripWrapRef} className="absolute" style={{ transformOrigin: "50% 12%", opacity: 0 }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- transform-driven sprite */}
        <img
          src={packetSrc}
          alt=""
          draggable={false}
          className="size-full object-contain object-bottom"
          style={{ clipPath: stripClipPath() }}
        />
      </div>
      {Array.from({ length: slots }, (_, i) => (
        <Fragment key={i}>
          <div
            ref={(el) => {
              pieceShadowRefs.current[i] = el;
            }}
            className="absolute left-0 top-0 rounded-[50%]"
            style={{ background: shadowBg, filter: "blur(3px)", display: "none" }}
          />
          {/* eslint-disable-next-line @next/next/no-img-element -- transform-driven sprite */}
          <img
            ref={(el) => {
              pieceRefs.current[i] = el;
            }}
            src={pieceSrc}
            alt=""
            draggable={false}
            className="absolute left-0 top-0"
            style={{ display: "none" }}
          />
        </Fragment>
      ))}
    </div>
  );
}
