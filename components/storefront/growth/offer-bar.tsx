"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";
import { Sparkles, X, Gift, ClipboardCheck } from "lucide-react";
import { trackClient } from "@/components/storefront/behavior-tracker";
import { revealWelcomeCoupon } from "@/lib/actions/quiz";

const DISMISS_KEY = "nut_offerbar_dismissed";
const DAY_MS = 86_400_000;

/** Hidden on flows where a promo bar would distract or is irrelevant. */
const HIDE_ON = ["/checkout", "/quiz", "/login", "/register"];

/**
 * Dismissible sticky top offer bar. Renders in normal document flow at the very
 * top (scrolls away — deliberately NOT fixed, so it never fights the sticky
 * header). Remembers dismissal for 24h. Admin-toggleable via growth settings.
 */
export function OfferBar({ text }: { text: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (HIDE_ON.some((p) => pathname.startsWith(p))) {
      setShow(false);
      return;
    }
    try {
      const at = Number(localStorage.getItem(DISMISS_KEY) || 0);
      setShow(!(at && Date.now() - at < DAY_MS));
    } catch {
      setShow(true);
    }
  }, [pathname]);

  if (!show) return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setShow(false);
  }

  async function getCoupon() {
    trackClient({ type: "STICKY_CLICK", source: "get-coupon" });
    try {
      const { code, percent } = await revealWelcomeCoupon();
      navigator.clipboard?.writeText(code).catch(() => {});
      toast.success(`${percent}% OFF — code ${code} copied. Apply it at checkout!`, { icon: <ClipboardCheck className="size-4" /> });
    } catch {
      router.push("/quiz");
    }
  }

  function takeAssessment() {
    trackClient({ type: "STICKY_CLICK", source: "take-assessment" });
    router.push("/quiz");
  }

  return (
    <div className="surface-rich relative text-surface-deep-foreground">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 py-2 pr-10 sm:justify-center">
        <Sparkles className="hidden size-4 shrink-0 text-gold sm:block" />
        <p className="min-w-0 flex-1 truncate text-xs font-medium sm:flex-none sm:text-sm">{text}</p>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={getCoupon}
            className="inline-flex items-center gap-1 rounded-full bg-gold px-3 py-1 text-xs font-semibold text-gold-foreground transition-transform hover:brightness-105 motion-safe:active:scale-95"
          >
            <Gift className="size-3.5" /> Get Coupon
          </button>
          <button
            type="button"
            onClick={takeAssessment}
            className="hidden rounded-full border border-white/30 px-3 py-1 text-xs font-semibold transition-colors hover:bg-white/10 sm:inline-flex"
          >
            Take Assessment
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss offer"
        className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-surface-deep-foreground/70 transition-colors hover:bg-white/10 hover:text-surface-deep-foreground"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
