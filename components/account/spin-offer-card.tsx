import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowRight } from "lucide-react";
import { trackEvent } from "@/lib/recommendations/events";
import { SPIN_COOKIE, claimPendingSpinForUser, getUsableSpinOffer } from "@/lib/spin/service";

/**
 * Account dashboard card for a saved Spin & Win offer. Also claims a win made
 * before signing in when the shopper lands here instead of back on /spin
 * (e.g. email sign-up, which returns to the login page without a callback).
 */
export async function SpinOfferCard({ userId }: { userId: string }) {
  const jar = await cookies();
  if (await claimPendingSpinForUser(userId, jar.get(SPIN_COOKIE)?.value)) {
    await trackEvent({ type: "SPIN_AUTH", userId, source: "spin-win" });
    await trackEvent({ type: "SPIN_CLAIM", userId, source: "spin-win-account" });
  }
  const offer = await getUsableSpinOffer(userId).catch(() => null);
  if (!offer) return null;
  return (
    <section
      aria-label="Your Spin & Win offer"
      className="flex flex-col gap-3 rounded-xl border border-border bg-oat px-5 py-4 text-oat-foreground sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="min-w-0">
        <p className="eyebrow">Spin &amp; Win offer saved</p>
        <p className="mt-1 text-[15px] text-foreground">{offer.label}</p>
        <p className="mt-0.5 text-sm">
          Code <span className="font-mono font-semibold tracking-wider text-foreground">{offer.code}</span> · one tap
          to apply at checkout
        </p>
      </div>
      <Link
        href="/spin"
        className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        View offer <ArrowRight className="size-4" aria-hidden />
      </Link>
    </section>
  );
}
