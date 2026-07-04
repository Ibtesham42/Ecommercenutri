"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";
import { PartyPopper, Gift, Sparkles, Salad, ClipboardCheck } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { trackClient } from "@/components/storefront/behavior-tracker";
import { revealWelcomeCoupon } from "@/lib/actions/quiz";

const SEEN_KEY = "nut_welcome_seen";
const DAY_MS = 86_400_000;
const DELAY_MS = 10_000;
const SCROLL_TRIGGER = 0.4;

const HIDE_ON = ["/checkout", "/quiz", "/login", "/register"];

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
    { icon: Gift, text: `Get ${couponPercent}% OFF your first order` },
    { icon: Sparkles, text: "Free AI health assessment" },
    { icon: Salad, text: "Personalized snack recommendations" },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-sm overflow-hidden rounded-3xl p-0">
        <div className="surface-rich px-6 py-7 text-center text-surface-deep-foreground">
          <span className="mx-auto grid size-14 place-items-center rounded-full bg-white/10">
            <PartyPopper className="size-7 text-gold" />
          </span>
          <h2 className="mt-3 font-heading text-2xl font-bold">{title}</h2>
          <p className="mx-auto mt-1.5 max-w-xs text-sm text-surface-deep-foreground/80">{subtitle}</p>
        </div>
        <div className="p-6">
          <ul className="space-y-2.5">
            {benefits.map((b) => (
              <li key={b.text} className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 text-sm font-medium">
                <b.icon className="size-4 shrink-0 text-primary" /> {b.text}
              </li>
            ))}
          </ul>
          <div className="mt-5 space-y-2">
            <Button onClick={claim} className="h-12 w-full gap-2 text-base font-semibold shadow-elev-1">
              <Gift className="size-4" /> Claim My {couponPercent}% OFF
            </Button>
            <Button onClick={assessment} variant="outline" className="h-11 w-full gap-1.5">
              <Sparkles className="size-4" /> Take Free Assessment
            </Button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mx-auto block pt-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Maybe later
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
