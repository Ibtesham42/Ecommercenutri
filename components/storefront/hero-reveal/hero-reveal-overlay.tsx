"use client";

import { Component, useEffect, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { cldUrl } from "@/lib/cld";
import type { HeroRevealSettings } from "@/lib/hero-reveal";
import { packetClipPath } from "@/lib/hero-reveal-config";
import { cn } from "@/lib/utils";
import { useInView } from "../showcase/use-in-view";

/**
 * Hero "Product Reveal" overlay — the tiny always-renderable shell. Decorative
 * only (`aria-hidden`, `pointer-events-none`), absolutely positioned over the
 * hero slider so it never shifts layout or blocks swipe/arrows/CTAs. The rAF
 * physics engine is a separate lazy chunk that mounts only once the hero has
 * scrolled into view; reduced-motion users get a static opened packet and the
 * engine chunk never loads. A failure inside the engine renders nothing — the
 * hero must never blank.
 */

const RevealEngine = dynamic(() => import("./reveal-engine"), { ssr: false });

class RevealErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** Reduced-motion fallback: the opened packet at rest (no rAF, no engine). */
function StaticPacket({ src }: { src: string }) {
  return (
    <div className="absolute inset-0">
      <div
        className="absolute bottom-[2%] left-1/2 h-[5%] w-[45%] -translate-x-1/2 rounded-[50%] opacity-30 blur-[6px]"
        style={{ background: "radial-gradient(ellipse at center, rgba(0,0,0,0.35), transparent 70%)" }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element -- decorative sprite */}
      <img
        src={src}
        alt=""
        draggable={false}
        className="absolute bottom-[2%] left-1/2 h-[62%] w-[52%] origin-bottom -translate-x-1/2 rotate-[8deg] object-contain object-bottom"
        style={{ clipPath: packetClipPath() }}
      />
    </div>
  );
}

export function HeroRevealOverlay({
  settings,
  side = "right",
  preview = false,
}: {
  settings: HeroRevealSettings;
  side?: "left" | "right";
  preview?: boolean;
}) {
  const [reduced, setReduced] = useState(false);
  const [armed, setArmed] = useState(preview); // mount the engine only once seen
  const { ref, active } = useInView<HTMLDivElement>();

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const set = () => setReduced(mq.matches);
    set();
    mq.addEventListener("change", set);
    return () => mq.removeEventListener("change", set);
  }, []);

  useEffect(() => {
    if (active) setArmed(true);
  }, [active]);

  if (!settings.enabled || !settings.packetImage) return null;

  return (
    <div ref={ref} aria-hidden className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
      <div
        className={cn(
          // Stage box: small top corner on mobile (slide copy/dots are
          // bottom-anchored there), larger bottom corner from md up (clears
          // the right-4/left-4 arrows). Sizes track STAGE in hero-reveal-config.
          "absolute h-[170px] w-[150px] md:h-[280px] md:w-[260px] lg:h-[340px] lg:w-[340px]",
          side === "right"
            ? "right-3 top-3 md:bottom-5 md:right-12 md:top-auto lg:right-16"
            : "left-3 top-3 md:bottom-5 md:left-12 md:top-auto lg:left-16",
        )}
        style={{ contain: "strict" }}
      >
        {reduced ? (
          <StaticPacket src={cldUrl(settings.packetImage, { w: 480, crop: "fit" })} />
        ) : (
          armed && (
            <RevealErrorBoundary>
              <RevealEngine settings={settings} active={active || preview} />
            </RevealErrorBoundary>
          )
        )}
      </div>
    </div>
  );
}
