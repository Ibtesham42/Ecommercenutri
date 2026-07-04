"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";
import { Gift, X, PartyPopper, Copy, Check, Sparkles, ArrowRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { trackClient } from "@/components/storefront/behavior-tracker";
import { revealWelcomeCoupon } from "@/lib/actions/quiz";

const DISMISS_KEY = "nut_offerbar_dismissed";
const DAY_MS = 86_400_000;

/** Hidden on flows where a promo bar would distract or is irrelevant. */
const HIDE_ON = ["/checkout", "/quiz", "/login", "/register"];

/**
 * Dismissible top offer bar. Renders in normal document flow at the very top
 * (scrolls away — deliberately NOT fixed, so it never fights the sticky header).
 * Mobile-first: a compact single row with a short headline + one primary CTA,
 * expanding to the full message + both CTAs on larger screens. "Get coupon"
 * opens a clear confirmation dialog (with the code + copy + the assessment link)
 * so the user always gets an unmistakable "you've got it" moment, and the
 * assessment stays reachable on mobile. Remembers dismissal for 24h.
 */
export function OfferBar({ text }: { text: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [show, setShow] = useState(false);
  const [open, setOpen] = useState(false);
  const [coupon, setCoupon] = useState<{ code: string; percent: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

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

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setShow(false);
  }

  async function getCoupon() {
    if (loading) return;
    setLoading(true);
    trackClient({ type: "STICKY_CLICK", source: "get-coupon" });
    try {
      const c = await revealWelcomeCoupon();
      setCoupon(c);
      setCopied(false);
      setOpen(true);
      // Best-effort auto-copy (works on the tap gesture over HTTPS).
      navigator.clipboard?.writeText(c.code).then(() => setCopied(true)).catch(() => {});
    } catch {
      router.push("/quiz");
    } finally {
      setLoading(false);
    }
  }

  function copyCode() {
    if (!coupon) return;
    navigator.clipboard?.writeText(coupon.code).then(
      () => {
        setCopied(true);
        toast.success("Coupon copied!");
      },
      () => toast.error("Couldn't copy — please note the code."),
    );
  }

  function takeAssessment() {
    trackClient({ type: "STICKY_CLICK", source: "take-assessment" });
    setOpen(false);
    router.push("/quiz");
  }

  if (!show) return null;

  return (
    <>
      <div className="surface-rich text-surface-deep-foreground">
        <div className="mx-auto flex w-full max-w-7xl items-center gap-2 px-3 py-2 sm:justify-center sm:gap-3 sm:px-4">
          <Gift className="size-4 shrink-0 text-gold" aria-hidden />
          {/* Short headline on mobile, full message from sm up. */}
          <p className="min-w-0 flex-1 truncate text-[13px] font-medium sm:flex-none sm:text-sm">
            <span className="sm:hidden">20% OFF + FREE Health Score</span>
            <span className="hidden sm:inline">{text}</span>
          </p>
          <button
            type="button"
            onClick={getCoupon}
            disabled={loading}
            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full bg-gold px-3.5 text-xs font-semibold text-gold-foreground shadow-sm transition-transform hover:brightness-105 disabled:opacity-70 motion-safe:active:scale-95"
          >
            <Gift className="size-3.5" />
            <span className="sm:hidden">Get</span>
            <span className="hidden sm:inline">Get Coupon</span>
          </button>
          <button
            type="button"
            onClick={takeAssessment}
            className="hidden h-8 shrink-0 items-center rounded-full border border-white/30 px-3.5 text-xs font-semibold transition-colors hover:bg-white/10 sm:inline-flex"
          >
            Take Assessment
          </button>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss offer"
            className="grid size-8 shrink-0 place-items-center rounded-full text-surface-deep-foreground/70 transition-colors hover:bg-white/10 hover:text-surface-deep-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      {/* Clear confirmation: the user sees exactly what they got. */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm overflow-hidden rounded-3xl p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Your welcome coupon</DialogTitle>
          </DialogHeader>
          <div className="surface-rich px-6 py-6 text-center text-surface-deep-foreground">
            <span className="mx-auto grid size-14 place-items-center rounded-full bg-white/10">
              <PartyPopper className="size-7 text-gold" />
            </span>
            <h2 className="mt-3 font-heading text-2xl font-bold">You&apos;ve got {coupon?.percent ?? 20}% OFF!</h2>
            <p className="mt-1 text-sm text-surface-deep-foreground/80">Use this code on your first order.</p>
          </div>
          <div className="p-6">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-primary/40 bg-primary/5 p-3">
              <span className="font-mono text-xl font-bold tracking-[0.2em] text-primary">{coupon?.code}</span>
              <Button size="sm" variant="outline" onClick={copyCode} className="shrink-0 gap-1.5">
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Apply it at checkout. {copied ? "Already copied to your clipboard." : ""}
            </p>
            <Button onClick={() => setOpen(false)} className="mt-4 h-11 w-full font-semibold">
              Got it
            </Button>
            <button
              type="button"
              onClick={takeAssessment}
              className="mx-auto mt-3 flex items-center justify-center gap-1.5 text-sm font-medium text-primary transition-colors hover:underline"
            >
              <Sparkles className="size-4" /> Take the free Health Assessment <ArrowRight className="size-3.5" />
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
