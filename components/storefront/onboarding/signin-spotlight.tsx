"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Sparkles } from "lucide-react";
import { ONBOARD_SEEN_KEY as SEEN_KEY, shouldRevealSpotlight } from "@/lib/onboarding";

const SHOW_DELAY_MS = 1200; // appear after the page settles (1–2s)
const VISIBLE_MS = 6500; // then linger ~6.5s before fading on its own
const SCROLL_DISMISS_PX = 60;

/**
 * First-visit onboarding spotlight. Wraps the header's Sign in button (rendered
 * only for logged-out visitors) and, once ever, draws a soft brand green→gold
 * breathing ring around it plus a small premium "Join Free – Get 20% OFF" hint.
 *
 * It never blocks interaction (pointer-events: none, zero layout shift), appears
 * after ~1.2s, lingers ~6.5s, and disappears the moment the shopper scrolls,
 * taps anything, presses a key, or taps Sign in — then never returns
 * (localStorage). Reduced-motion aware (a static ring via CSS). Purely additive:
 * the button itself is unchanged.
 */
export function SigninSpotlight({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const done = useRef(false);

  // Stable dismiss handler (marks "seen" once, hides, and is idempotent).
  const finish = useRef(() => {
    if (done.current) return;
    done.current = true;
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* ignore */
    }
    setActive(false);
  });

  // First-visit detection → schedule the reveal.
  useEffect(() => {
    let seen: string | null;
    try {
      seen = localStorage.getItem(SEEN_KEY);
    } catch {
      return; // no storage → don't risk nagging every load
    }
    if (!shouldRevealSpotlight(pathname, seen)) return;
    const t = window.setTimeout(() => setActive(true), SHOW_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [pathname]);

  // While shown: auto-hide timer + dismiss on the first meaningful interaction.
  useEffect(() => {
    if (!active) return;
    const end = finish.current;
    const autoHide = window.setTimeout(end, VISIBLE_MS);
    const onScroll = () => {
      if (window.scrollY > SCROLL_DISMISS_PX) end();
    };
    const onInteract = () => end();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pointerdown", onInteract, { passive: true });
    window.addEventListener("keydown", onInteract);
    window.addEventListener("touchstart", onInteract, { passive: true });
    return () => {
      window.clearTimeout(autoHide);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointerdown", onInteract);
      window.removeEventListener("keydown", onInteract);
      window.removeEventListener("touchstart", onInteract);
    };
  }, [active]);

  return (
    <span className="relative inline-flex">
      {children}
      {active && (
        <>
          <span aria-hidden className="onboard-glow pointer-events-none absolute inset-0 rounded-lg" />
          {/* The hint chip is desktop-only: on mobile it would float over the
              search row (and the announcement bar + coupon strip already carry
              the offer), so the breathing ring alone spotlights the button. */}
          <span
            role="status"
            className="pointer-events-none absolute right-0 top-full z-50 mt-2 hidden items-center gap-1.5 whitespace-nowrap rounded-full bg-surface-deep px-3 py-1.5 text-xs font-semibold text-surface-deep-foreground shadow-elev-2 motion-safe:animate-fade-up lg:flex"
          >
            <Sparkles className="size-3.5 text-gold" aria-hidden />
            Join Free – Get 20% OFF
            <span aria-hidden className="absolute -top-1 right-5 size-2 rotate-45 rounded-[1px] bg-surface-deep" />
          </span>
        </>
      )}
    </span>
  );
}
