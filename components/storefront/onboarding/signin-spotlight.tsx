"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const SEEN_KEY = "nut_onboard_signin";
const SHOW_DELAY_MS = 900; // let the page settle first
const AUTO_HIDE_MS = 8000;
const SCROLL_DISMISS_PX = 140;

/** Where a first-visit nudge would distract from the task at hand. */
const HIDE_ON = ["/checkout"];

/**
 * First-visit onboarding spotlight. Wraps the header's Sign in button (rendered
 * only for logged-out visitors) and, once ever, draws a soft brand-green→gold
 * breathing ring around it plus a small "New here? Sign up" hint. It never
 * blocks interaction (pointer-events: none), adds no layout shift, and quietly
 * disappears after a few seconds, on the first real scroll, or the moment the
 * shopper taps Sign in — then never returns. Fully reduced-motion aware (a
 * static ring via CSS). Purely additive: the button itself is unchanged.
 */
export function SigninSpotlight({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const done = useRef(false);

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

  useEffect(() => {
    if (HIDE_ON.some((p) => pathname.startsWith(p))) return;
    try {
      if (localStorage.getItem(SEEN_KEY) === "1") return;
    } catch {
      return; // no storage → don't risk nagging every load
    }
    const t = window.setTimeout(() => setActive(true), SHOW_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [pathname]);

  useEffect(() => {
    if (!active) return;
    const end = finish.current;
    const t = window.setTimeout(end, AUTO_HIDE_MS);
    const onScroll = () => {
      if (window.scrollY > SCROLL_DISMISS_PX) end();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("scroll", onScroll);
    };
  }, [active]);

  return (
    // Capturing the click means tapping the Sign in button dismisses the nudge
    // before navigation, without changing the button's own behavior.
    <span className="relative inline-flex" onClickCapture={() => finish.current()}>
      {children}
      {active && (
        <>
          <span aria-hidden className="onboard-glow pointer-events-none absolute inset-0 rounded-lg" />
          <span
            role="status"
            className="pointer-events-none absolute right-0 top-[calc(100%+0.5rem)] z-50 whitespace-nowrap rounded-full border bg-popover px-3 py-1.5 text-xs font-medium text-popover-foreground shadow-elev-2 motion-safe:animate-fade-up"
          >
            New here? <span className="font-semibold text-primary">Sign up</span>
            <span
              aria-hidden
              className="absolute -top-1 right-4 size-2 rotate-45 rounded-[1px] border-l border-t bg-popover"
            />
          </span>
        </>
      )}
    </span>
  );
}
