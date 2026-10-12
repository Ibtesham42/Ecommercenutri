"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, LogIn, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CopyCouponButton } from "@/components/storefront/copy-coupon-button";
import { SpinWheel, rotationFor } from "@/components/storefront/spin/spin-wheel";
import { claimSpinAction, spinAction } from "@/lib/actions/spin";
import { formatDate, formatDateTime } from "@/lib/format";
import { prefersReducedMotion } from "@/lib/motion";
import type { PublicCampaign, SpinView } from "@/lib/spin/service";

const SPIN_MS = 4800;

type Phase = "idle" | "requesting" | "spinning" | "claiming" | "done";

export function SpinGame({
  campaign,
  initialView,
  signedIn,
  pendingClaim,
}: {
  campaign: PublicCampaign;
  initialView: SpinView | null;
  signedIn: boolean;
  pendingClaim: boolean;
}) {
  const router = useRouter();
  const percents = campaign.percents;
  const indexOf = (p: number) => Math.max(0, percents.indexOf(p));

  const [view, setView] = useState<SpinView | null>(initialView);
  const [phase, setPhase] = useState<Phase>(
    initialView ? (signedIn && pendingClaim ? "claiming" : "done") : "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [rotation, setRotation] = useState(() =>
    initialView ? rotationFor(indexOf(initialView.percent), percents.length, 0, 0) : 0,
  );
  const [duration, setDuration] = useState(0);
  const claimedOnce = useRef(false);

  // Back from sign-in with an unclaimed win in this browser → claim it.
  useEffect(() => {
    if (!(signedIn && pendingClaim) || claimedOnce.current) return;
    claimedOnce.current = true;
    void claimSpinAction().then((res) => {
      if (res.ok) {
        setView(res.view);
        if (res.reassigned) {
          setNote(
            `The product you won just sold out, so we've moved your ${res.view.percent}% offer to ${res.view.productName}.`,
          );
        }
        router.refresh();
      } else {
        setError(res.error);
      }
      setPhase("done");
    });
  }, [signedIn, pendingClaim, router]);

  async function spin() {
    if (phase !== "idle") return;
    setError(null);
    setPhase("requesting");
    const res = await spinAction();
    if (!res.ok) {
      setError(res.error);
      setPhase("idle");
      return;
    }
    const reduced = prefersReducedMotion();
    const jitter = (Math.random() - 0.5) * 2; // cosmetic only
    setDuration(reduced ? 0 : SPIN_MS);
    setRotation((r) => rotationFor(indexOf(res.view.percent), percents.length, r, reduced ? 0 : 5, jitter));
    if (reduced) {
      setView(res.view);
      setPhase("done");
      router.refresh();
      return;
    }
    setPhase("spinning");
    window.setTimeout(() => {
      setView(res.view);
      setPhase("done");
      router.refresh();
    }, SPIN_MS + 150);
  }

  const busy = phase === "requesting" || phase === "spinning" || phase === "claiming";
  const showResult = phase === "done" && view;

  return (
    <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
      <div className="order-2 lg:order-1">
        <div aria-live="polite" className="min-h-6">
          {phase === "claiming" && (
            <p className="flex items-center gap-2 text-[15px] text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden /> Saving your offer to your account…
            </p>
          )}
          {phase === "spinning" && <p className="text-[15px] text-muted-foreground">Spinning…</p>}
          {showResult && <ResultPanel view={view} signedIn={signedIn} />}
          {note && <p className="mt-4 rounded-lg bg-oat px-4 py-3 text-sm text-oat-foreground">{note}</p>}
          {error && (
            <p role="alert" className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}{" "}
              <Link href="/products" className="font-medium underline underline-offset-4">
                Continue shopping
              </Link>
            </p>
          )}
        </div>

        {!view && (
          <div className={error ? "mt-6" : ""}>
            <Button
              type="button"
              onClick={spin}
              disabled={busy}
              className="h-12 w-full rounded-lg px-8 text-[15px] sm:w-auto"
            >
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              {busy ? "Spinning…" : "Spin the wheel"}
            </Button>
            <p className="mt-3 text-sm text-muted-foreground">
              {signedIn
                ? "One spin per account. Your offer is saved to your account straight away."
                : `One spin per account. Sign in after you spin to claim — your win is held on this device for ${campaign.claimWindowHours} hours.`}
            </p>
          </div>
        )}
      </div>

      <div className="order-1 lg:order-2">
        <SpinWheel percents={percents} rotation={rotation} durationMs={duration} />
      </div>
    </div>
  );
}

function ResultPanel({ view, signedIn }: { view: SpinView; signedIn: boolean }) {
  const sizes = view.variantLabels.length > 0 ? ` (${view.variantLabels.join(" · ")})` : "";

  if (view.status === "EXPIRED") {
    return (
      <div>
        <p className="eyebrow">Win expired</p>
        <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
          Your {view.percent}% win on {view.productName} wasn&apos;t claimed in time.
        </p>
        <Button asChild variant="outline" className="mt-5 h-11 rounded-lg">
          <Link href="/products">Continue shopping</Link>
        </Button>
      </div>
    );
  }

  return (
    <div>
      <p className="eyebrow">{view.status === "AWARDED" ? "You won" : "Your offer"}</p>
      <p className="mt-2 font-heading text-heading font-medium text-foreground">
        {view.percent}% off {view.productName}
      </p>
      <p className="mt-1 text-[15px] text-muted-foreground">Applies to {view.productName}{sizes}.</p>

      {view.status === "AWARDED" && (
        <>
          <p className="mt-4 text-[15px] leading-relaxed">
            {signedIn
              ? "Saving it to your account…"
              : `Sign in or create an account to claim it. Your win is held on this device until ${formatDateTime(view.claimBy)}.`}
          </p>
          {!signedIn && (
            <Button asChild className="mt-5 h-12 w-full rounded-lg px-6 text-[15px] sm:w-auto">
              <Link href="/login?callbackUrl=/spin">
                <LogIn className="size-4" aria-hidden /> Sign in to claim
              </Link>
            </Button>
          )}
        </>
      )}

      {view.coupon && (
        <div className="mt-5 rounded-xl border border-border bg-card p-4 sm:p-5">
          {view.coupon.used || view.status === "REDEEMED" ? (
            <p className="text-[15px]">You&apos;ve already used this offer — thank you for shopping with us.</p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">Saved to your account · use at checkout</p>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                <span className="font-mono text-lg font-semibold tracking-[0.12em] text-foreground">
                  {view.coupon.code}
                </span>
                <CopyCouponButton code={view.coupon.code} />
              </div>
              {view.coupon.expiresAt && (
                <p className="mt-2 text-xs text-muted-foreground">Valid till {formatDate(view.coupon.expiresAt)}</p>
              )}
            </>
          )}
        </div>
      )}

      {view.status !== "AWARDED" && view.productSlug && !view.coupon?.used && (
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <Button asChild className="h-12 rounded-lg px-6 text-[15px]">
            <Link href={`/products/${view.productSlug}`}>
              <ShoppingBag className="size-4" aria-hidden /> Shop {view.productName}
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-12 rounded-lg border-foreground/25 bg-transparent px-6 text-[15px]">
            <Link href="/checkout">
              Go to checkout <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
