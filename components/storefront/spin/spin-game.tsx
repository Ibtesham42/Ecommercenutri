"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Info,
  Loader2,
  LogIn,
  MailCheck,
  ShieldCheck,
  ShoppingBag,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CopyCouponButton } from "@/components/storefront/copy-coupon-button";
import { SpinWheel, rotationFor } from "@/components/storefront/spin/spin-wheel";
import { claimSpinAction, sendSpinVerificationEmail, spinAction } from "@/lib/actions/spin";
import { formatDate, formatDateTime } from "@/lib/format";
import { prefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { PublicCampaign, SpinView } from "@/lib/spin/service";

const SPIN_MS = 4800;

type Phase = "idle" | "requesting" | "spinning" | "claiming" | "done";

/**
 * The /spin game: page header + stage (wheel with its Spin button directly
 * beneath) + one panel that walks the shopper through every state (spin →
 * result → sign in / verify → saved code → used). `showWheel` is false when the
 * campaign has ended but this browser still holds a win — the offer is shown
 * on its own rather than on a one-segment wheel.
 */
export function SpinGame({
  campaign,
  initialView,
  signedIn,
  pendingClaim,
  needsVerification,
  phoneVerifyAvailable,
  header,
  showWheel = true,
}: {
  campaign: PublicCampaign;
  initialView: SpinView | null;
  signedIn: boolean;
  pendingClaim: boolean;
  needsVerification: boolean;
  phoneVerifyAvailable: boolean;
  header?: React.ReactNode;
  showWheel?: boolean;
}) {
  const router = useRouter();
  const percents = campaign.percents;
  const indexOf = (p: number) => Math.max(0, percents.indexOf(p));

  const [view, setView] = useState<SpinView | null>(initialView);
  const [phase, setPhase] = useState<Phase>(
    initialView ? (signedIn && pendingClaim ? "claiming" : "done") : "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  // Before a spin a segment sits squarely under the pointer (reads as intentional).
  const [rotation, setRotation] = useState(() =>
    rotationFor(initialView ? indexOf(initialView.percent) : 0, percents.length, 0, 0),
  );
  const [duration, setDuration] = useState(0);
  // Why the last claim attempt failed. Terminal codes end the claim flow; any
  // other failure (network, timeout) offers a retry — never an endless spinner.
  const [claimError, setClaimError] = useState<string | null>(null);
  // Signed in, but claiming needs a verified email/phone first (server-enforced).
  const [unverified, setUnverified] = useState(needsVerification);
  const claimedOnce = useRef(false);

  async function claim() {
    setPhase("claiming");
    setError(null);
    setErrorCode(null);
    setClaimError(null);
    const res = await claimSpinAction();
    if (res.ok) {
      setView(res.view); // a moved offer explains itself via view.reassignedFrom
      setUnverified(false);
      router.refresh();
    } else if (res.code === "UNVERIFIED") {
      setUnverified(true); // the verify panel explains + offers the recovery path
    } else {
      setError(res.error);
      setErrorCode(res.code ?? null);
      setClaimError(res.code ?? "RETRY");
      if (res.code === "EXPIRED") setView((v) => (v ? { ...v, status: "EXPIRED" } : v));
    }
    setPhase("done");
  }

  // Back from sign-in with an unclaimed win in this browser → claim it.
  useEffect(() => {
    if (!(signedIn && pendingClaim) || claimedOnce.current) return;
    claimedOnce.current = true;
    void claim();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn, pendingClaim]);

  async function spin() {
    if (phase !== "idle") return;
    setError(null);
    setErrorCode(null);
    setPhase("requesting");
    const res = await spinAction();
    if (!res.ok) {
      setError(res.error);
      setErrorCode(res.code ?? null);
      setPhase("idle");
      return;
    }
    if (res.needsVerification) setUnverified(true);
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
  // Only highlight the winning segment once the wheel has come to rest.
  const highlight = showResult && view.status !== "EXPIRED" ? indexOf(view.percent) : null;
  const topPercent = Math.max(0, ...percents);

  // Phones: when the wheel stops, bring the result into view if it landed
  // below the fold. Desktop shows it beside the wheel, so nothing moves there.
  const resultRef = useRef<HTMLDivElement>(null);
  const settledFromSpin = useRef(false);
  useEffect(() => {
    if (phase === "spinning") settledFromSpin.current = true;
    if (phase !== "done" || !settledFromSpin.current) return;
    settledFromSpin.current = false;
    const el = resultRef.current;
    if (!el || window.matchMedia("(min-width: 1024px)").matches) return;
    if (el.getBoundingClientRect().top > window.innerHeight * 0.6) {
      el.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
    }
  }, [phase]);

  const result = (
    <div ref={resultRef} aria-live="polite" className="min-w-0 scroll-mt-24">
      {phase === "claiming" && (
        <p className="flex items-center gap-2.5 text-[15px] text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Saving your offer to your account…
        </p>
      )}
      {phase === "spinning" && <p className="sr-only">Spinning…</p>}
      {showResult && (
        <ResultPanel
          view={view}
          signedIn={signedIn}
          unverified={unverified}
          phoneVerifyAvailable={phoneVerifyAvailable}
          claimError={claimError}
          claimMessage={claimError ? error : null}
          onClaim={claim}
        />
      )}
    </div>
  );

  // No wheel (campaign ended, this browser still holds a win): the offer alone.
  if (!showWheel) {
    return (
      <div className="grid max-w-2xl gap-y-8">
        {header}
        {result}
      </div>
    );
  }

  // Layout: the wheel and its Spin button are ONE unit (the stage) so the
  // control can never drift away from the game. Phones: header → stage →
  // result. Desktop: header + result on the left, the stage on the right; the
  // 1fr spacer rows centre the left column against the stage.
  return (
    <div className="grid gap-y-6 sm:gap-y-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] lg:grid-rows-[1fr_auto_auto_1fr] lg:gap-x-16 xl:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] xl:gap-x-24">
      {header && <div className="lg:col-start-1 lg:row-start-2">{header}</div>}

      <div className="flex flex-col items-center sm:rounded-2xl sm:border sm:border-border/70 sm:bg-oat/40 sm:px-8 sm:pt-10 sm:pb-8 lg:col-start-2 lg:pt-12 lg:row-span-4 lg:row-start-1 lg:self-center lg:px-10">
        {/* Phones: sized from the viewport height too, so wheel + button fit the
            first screen (below the header) without scrolling. */}
        <SpinWheel
          percents={percents}
          rotation={rotation}
          durationMs={duration}
          highlightIndex={highlight}
          className="w-[clamp(13.5rem,calc(100svh-26.5rem),20rem)] max-w-full sm:w-[22rem] lg:w-full"
        />

        {/* Fixed-height control slot directly under the wheel: the button, and
            then its "used" state, occupy the same box — nothing jumps. */}
        <div className="mt-6 flex h-13 w-full max-w-[20rem] items-center justify-center sm:mt-8 sm:max-w-[22rem]">
          {view ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="size-4 text-primary" aria-hidden /> Spin used — one per account
            </p>
          ) : (
            <Button
              type="button"
              onClick={spin}
              disabled={busy}
              aria-describedby="spin-rules"
              className="h-full w-full rounded-xl text-base font-semibold disabled:opacity-80"
            >
              {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {busy ? "Spinning…" : "Spin the wheel"}
            </Button>
          )}
        </div>

        {!view && (
          <div className="mt-4 w-full max-w-[20rem] text-center sm:max-w-[22rem]">
            {error && (
              <Notice tone={toneFor(errorCode)} role="alert" className="mb-4 text-left">
                {error}{" "}
                <Link href="/products" className="font-medium whitespace-nowrap underline underline-offset-4">
                  Continue shopping
                </Link>
              </Notice>
            )}
            <p id="spin-rules" className="text-sm leading-relaxed text-pretty text-muted-foreground">
              {topPercent > 0 && (
                <span className="block font-medium text-foreground">Win up to {topPercent}% off one selected product</span>
              )}
              {signedIn
                ? "One spin per account. Your offer is saved once your email or phone is verified."
                : `One spin per account. Sign in afterwards to claim — your win is held here for ${campaign.claimWindowHours} hours.`}
            </p>
          </div>
        )}
      </div>

      <div className="min-w-0 lg:col-start-1 lg:row-start-3">{result}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Result panel
// ---------------------------------------------------------------------------

const TERMINAL_CLAIM_ERRORS = new Set(["EXPIRED", "NOT_FOUND", "ALREADY_CLAIMED", "CLAIM_LIMIT"]);

type Tone = "info" | "success" | "warning" | "error";

/** Expected situations read as information or a gentle warning — red is for real failures only. */
function toneFor(code: string | null | undefined): Tone {
  switch (code) {
    case "PRIZE_UNAVAILABLE":
    case "NO_STOCK":
    case "RATE_LIMITED":
      return "warning";
    case "NO_CAMPAIGN":
    case "EXPIRED":
    case "CLAIM_LIMIT":
    case "ALREADY_CLAIMED":
    case "NOT_FOUND":
      return "info";
    default:
      return "error";
  }
}

const TONE: Record<Tone, { box: string; icon: LucideIcon; iconClass: string }> = {
  info: { box: "border-border bg-oat/60 text-foreground", icon: Info, iconClass: "text-muted-foreground" },
  success: { box: "border-primary/25 bg-primary/5 text-foreground", icon: CheckCircle2, iconClass: "text-primary" },
  warning: { box: "border-gold/45 bg-gold/10 text-foreground", icon: Clock, iconClass: "text-gold-foreground" },
  error: { box: "border-destructive/30 bg-destructive/5 text-destructive", icon: AlertCircle, iconClass: "" },
};

function Notice({
  tone,
  role,
  className,
  children,
}: {
  tone: Tone;
  role?: "alert" | "status";
  className?: string;
  children: React.ReactNode;
}) {
  const t = TONE[tone];
  const Icon = t.icon;
  return (
    <div role={role} className={cn("flex gap-3 rounded-lg border px-4 py-3 text-sm leading-relaxed", t.box, className)}>
      <Icon className={cn("mt-0.5 size-4 shrink-0", t.iconClass)} aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

const primaryBtn = "h-12 w-full rounded-lg px-6 text-[15px] sm:w-auto";
const secondaryBtn = "h-12 w-full rounded-lg border-foreground/20 bg-transparent px-6 text-[15px] sm:w-auto";

function ResultPanel({
  view,
  signedIn,
  unverified,
  phoneVerifyAvailable,
  claimError,
  claimMessage,
  onClaim,
}: {
  view: SpinView;
  signedIn: boolean;
  unverified: boolean;
  phoneVerifyAvailable: boolean;
  claimError: string | null;
  claimMessage: string | null;
  onClaim: () => void;
}) {
  const sizes = view.variantLabels.length > 0 ? view.variantLabels.join(" · ") : null;
  const used = view.status === "REDEEMED" || Boolean(view.coupon?.used);
  const eyebrow =
    view.status === "EXPIRED" ? "Win expired" : used ? "Offer used" : view.status === "AWARDED" ? "You won" : "Your offer";

  return (
    <div>
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="mt-2 font-heading text-heading leading-tight font-medium text-foreground">
        {view.percent}% off {view.productName}
      </h2>
      <p className="mt-1.5 text-[15px] text-muted-foreground">
        On {view.productName}
        {sizes ? ` (${sizes})` : ""} only — not the rest of your cart.
      </p>

      {view.reassignedFrom && view.status !== "EXPIRED" && (
        <Notice tone="info" className="mt-5">
          {view.reassignedFrom} sold out before your offer was claimed, so we moved your {view.percent}% offer to{" "}
          {view.productName} — same discount.
        </Notice>
      )}

      {/* ---- expired ---- */}
      {view.status === "EXPIRED" && (
        <>
          <Notice tone="info" className="mt-5">
            This win wasn&apos;t claimed by {formatDateTime(view.claimBy)}, so it has expired.
          </Notice>
          <div className="mt-6">
            <Button asChild variant="outline" className={secondaryBtn}>
              <Link href="/products">Continue shopping</Link>
            </Button>
          </div>
        </>
      )}

      {/* ---- won, not yet claimed ---- */}
      {view.status === "AWARDED" && !signedIn && (
        <>
          <p className="mt-5 text-[15px] leading-relaxed text-foreground">
            Sign in or create an account to claim it. We&apos;ll hold this win on this device until{" "}
            <span className="font-medium whitespace-nowrap">{formatDateTime(view.claimBy)}</span>.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button asChild className={primaryBtn}>
              <Link href="/login?callbackUrl=/spin">
                <LogIn className="size-4" aria-hidden /> Sign in to claim
              </Link>
            </Button>
            <Button asChild variant="outline" className={secondaryBtn}>
              <Link href="/register?callbackUrl=%2Fspin">Create an account</Link>
            </Button>
          </div>
        </>
      )}

      {view.status === "AWARDED" && signedIn && unverified && (
        <VerifyToClaim claimBy={view.claimBy} phoneVerifyAvailable={phoneVerifyAvailable} onClaim={onClaim} />
      )}

      {view.status === "AWARDED" && signedIn && !unverified && (
        <>
          {claimError && claimMessage && (
            <Notice tone={toneFor(claimError)} role="alert" className="mt-5">
              {claimMessage}
            </Notice>
          )}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            {/* Signed in but not (yet) claimed: the auto-claim failed or never ran.
                Always offer an explicit action rather than a spinner. */}
            {!(claimError && TERMINAL_CLAIM_ERRORS.has(claimError)) && (
              <Button type="button" onClick={onClaim} className={primaryBtn}>
                {claimError ? "Try again" : "Claim my offer"}
              </Button>
            )}
            {claimError === "ALREADY_CLAIMED" && (
              <Button asChild className={primaryBtn}>
                <Link href="/account">View my saved offer</Link>
              </Button>
            )}
            {claimError && (
              <Button asChild variant="outline" className={secondaryBtn}>
                <Link href="/products">Continue shopping</Link>
              </Button>
            )}
          </div>
        </>
      )}

      {/* ---- claimed: the code ---- */}
      {view.coupon && view.status !== "EXPIRED" && (
        <>
          {used ? (
            <Notice tone="success" className="mt-5">
              You&apos;ve used this offer — thank you for shopping with us.
            </Notice>
          ) : (
            <div className="mt-6 rounded-xl border border-border bg-card px-4 py-4 sm:px-5">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Your code</p>
              <div className="mt-1.5 flex flex-wrap items-center justify-between gap-3">
                <span className="font-mono text-xl font-semibold tracking-[0.14em] text-foreground">{view.coupon.code}</span>
                <CopyCouponButton code={view.coupon.code} />
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Saved to your account · single use
                {view.coupon.expiresAt ? ` · valid till ${formatDate(view.coupon.expiresAt)}` : ""}
              </p>
            </div>
          )}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            {!used && view.productSlug && (
              <Button asChild className={primaryBtn}>
                <Link href={`/products/${view.productSlug}`}>
                  <ShoppingBag className="size-4" aria-hidden /> Shop {view.productName}
                </Link>
              </Button>
            )}
            {used ? (
              <Button asChild variant="outline" className={secondaryBtn}>
                <Link href="/products">Continue shopping</Link>
              </Button>
            ) : (
              <Button asChild variant="outline" className={secondaryBtn}>
                <Link href="/checkout">
                  Go to checkout <ArrowRight className="size-4" aria-hidden />
                </Link>
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/** Recovery path for the verified-claim rule: verify by email link or phone OTP, then claim. */
function VerifyToClaim({
  claimBy,
  phoneVerifyAvailable,
  onClaim,
}: {
  claimBy: string;
  phoneVerifyAvailable: boolean;
  onClaim: () => void;
}) {
  const [sending, setSending] = useState(false);
  const [mail, setMail] = useState<{ ok: boolean; text: string } | null>(null);

  async function sendLink() {
    setSending(true);
    const res = await sendSpinVerificationEmail();
    setMail(res.ok ? { ok: true, text: res.message } : { ok: false, text: res.error });
    setSending(false);
  }

  return (
    <div className="mt-6 border-t border-border pt-5">
      <p className="flex items-center gap-2 text-[15px] font-medium text-foreground">
        <ShieldCheck className="size-4 text-primary" aria-hidden /> Verify your account to claim
      </p>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        To keep offers fair, Spin &amp; Win offers are saved only to accounts with a verified email address or
        phone number. Your win is held until{" "}
        <span className="whitespace-nowrap text-foreground">{formatDateTime(claimBy)}</span>.
      </p>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Button type="button" onClick={sendLink} disabled={sending} className={primaryBtn}>
          {sending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <MailCheck className="size-4" aria-hidden />}
          Email me a verification link
        </Button>
        {phoneVerifyAvailable && (
          <Button asChild variant="outline" className={secondaryBtn}>
            <Link href="/account/profile">Verify my phone number</Link>
          </Button>
        )}
      </div>
      {mail && (
        <Notice tone={mail.ok ? "success" : "error"} role="status" className="mt-4">
          {mail.text}
        </Notice>
      )}
      <p className="mt-5 text-sm text-muted-foreground">
        Already verified?{" "}
        <button
          type="button"
          onClick={onClaim}
          className="rounded-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          I&apos;ve verified — claim my offer
        </button>
      </p>
    </div>
  );
}
