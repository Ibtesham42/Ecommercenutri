"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";
import { Leaf, Gift, Sparkles, Salad, ClipboardCheck } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { trackClient } from "@/components/storefront/behavior-tracker";
import { revealWelcomeCoupon } from "@/lib/actions/quiz";
import { cn } from "@/lib/utils";

const SEEN_KEY = "nut_welcome_seen";
const DAY_MS = 86_400_000;
const DELAY_MS = 10_000;
const SCROLL_TRIGGER = 0.4;

const HIDE_ON = ["/checkout", "/quiz", "/login", "/register"];

const FADE_DELAYS = ["fade-delay-1", "fade-delay-2", "fade-delay-3"];

/**
 * Smart welcome popup — first-time, logged-out visitors only, never during
 * checkout, at most once per 24h. Triggers after 10s OR 40% scroll (whichever
 * first). All timers/listeners are cleaned up; renders nothing when ineligible.
 */
export function WelcomePopup({
  isLoggedIn,
  title,
  subtitle,
  couponPercent,
}: {
  isLoggedIn: boolean;
  title: string;
  subtitle: string;
  couponPercent: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const firedRef = useRef(false);

  const eligible = useCallback(() => {
    if (isLoggedIn) return false;
    if (HIDE_ON.some((p) => pathname.startsWith(p))) return false;
    try {
      const at = Number(localStorage.getItem(SEEN_KEY) || 0);
      if (at && Date.now() - at < DAY_MS) return false;
    } catch {
      /* storage blocked — allow */
    }
    return true;
  }, [isLoggedIn, pathname]);

  useEffect(() => {
    if (!eligible()) return;

    const fire = () => {
      if (firedRef.current) return;
      firedRef.current = true;
      try {
        localStorage.setItem(SEEN_KEY, String(Date.now()));
      } catch {
        /* ignore */
      }
      setOpen(true);
      trackClient({ type: "POPUP_VIEW", path: pathname });
    };

    const timer = window.setTimeout(fire, DELAY_MS);
    const onScroll = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      if (max > 0 && window.scrollY / max >= SCROLL_TRIGGER) fire();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
    };
  }, [eligible, pathname]);

  async function claim() {
    trackClient({ type: "POPUP_CONVERT", source: "claim-coupon" });
    setOpen(false);
    try {
      const { code, percent } = await revealWelcomeCoupon();
      navigator.clipboard?.writeText(code).catch(() => {});
      toast.success(`${percent}% OFF — code ${code} copied. Apply it at checkout!`, {
        icon: <ClipboardCheck className="size-4" />,
        duration: 6000,
      });
    } catch {
      router.push("/quiz");
    }
  }

  function assessment() {
    trackClient({ type: "POPUP_CONVERT", source: "take-assessment" });
    setOpen(false);
    router.push("/quiz");
  }

  const benefits = [
    {
      icon: Sparkles,
      title: "Free AI health check",
      desc: "60 seconds to your personal wellness score",
    },
    {
      icon: Salad,
      title: "Snacks picked for you",
      desc: "Matched to your goal, not generic bestsellers",
    },
    {
      icon: Gift,
      title: `${couponPercent}% welcome reward`,
      desc: "Unlocked on your first order",
    },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-sm gap-0 overflow-hidden rounded-3xl border-none p-0">
        <div className="surface-rich relative px-6 pt-8 pb-7 text-center text-surface-deep-foreground">
          <Sparkles className="badge-breathe absolute top-8 left-7 size-4 text-gold/40" aria-hidden />
          <Sparkles className="absolute right-9 bottom-7 size-3 text-gold/25" aria-hidden />
          <div className="relative mx-auto size-14">
            <div className="absolute inset-0 rounded-2xl bg-gold/25 blur-xl" aria-hidden />
            <span className="relative grid size-14 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/15">
              <Leaf className="size-7 text-gold" />
            </span>
          </div>
          <p className="mt-4 text-[11px] font-semibold tracking-[0.18em] text-gold uppercase">
            A welcome gift for you
          </p>
          <DialogTitle className="mt-1.5 font-heading text-[26px] leading-tight font-bold text-surface-deep-foreground">
            {title}
          </DialogTitle>
          <DialogDescription className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-surface-deep-foreground/80">
            {subtitle}
          </DialogDescription>
        </div>

        <div className="p-5 sm:p-6">
          <ul className="space-y-2.5">
            {benefits.map((b, i) => (
              <li
                key={b.title}
                className={cn(
                  "animate-fade-up hover-lift flex items-start gap-3 rounded-2xl bg-secondary/60 px-4 py-3.5 shadow-elev-1 dark:bg-secondary/40",
                  FADE_DELAYS[i],
                )}
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <b.icon className="size-4.5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{b.title}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{b.desc}</span>
                </span>
              </li>
            ))}
          </ul>

          <div className="animate-fade-up fade-delay-4 mt-5 space-y-2.5">
            <Button
              onClick={assessment}
              className="btn-rich h-auto min-h-12 w-full gap-2 py-2.5 text-[15px] font-semibold whitespace-normal shadow-elev-2"
            >
              <Sparkles className="size-4" /> Start My Free Health Assessment
            </Button>
            <Button
              onClick={claim}
              variant="outline"
              className="btn-rich btn-rich-gold h-auto min-h-11 w-full gap-2 border-gold/40 bg-gold/10 py-2.5 font-semibold whitespace-normal hover:bg-gold/15"
            >
              <Gift className="size-4 text-gold" /> Unlock My {couponPercent}% Welcome Reward
            </Button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mx-auto block px-4 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Maybe later
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
