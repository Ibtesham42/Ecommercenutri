import type { Metadata } from "next";
import Link from "next/link";
import {
  Megaphone,
  Link2,
  QrCode,
  Ticket,
  BarChart3,
  Wallet,
  IndianRupee,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getMyAffiliate } from "@/lib/queries/affiliate";
import { getAffiliateSettings } from "@/lib/queries/settings";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/storefront/reveal";
import { formatPrice } from "@/lib/format";
import { siteConfig } from "@/config/site";
import { buildMetadata } from "@/lib/seo";

// buildMetadata for full parity (OG + Twitter card, not just canonical) — the
// public affiliate page is a recruitment landing page people share.
export const metadata: Metadata = buildMetadata({
  title: "Affiliate Program — Earn with Nutriyet",
  description:
    "Join the Nutriyet affiliate program. Share your link, QR code and coupon, and earn commission on every sale you refer. Free to join, real-time tracking, easy payouts.",
  path: "/affiliate",
});

const steps = [
  {
    icon: CheckCircle2,
    title: "Apply in minutes",
    body: "Tell us who you are and how you'll promote Nutriyet. Approval is usually within a couple of days.",
  },
  {
    icon: Link2,
    title: "Get your toolkit",
    body: "Once approved you receive a unique referral link, a scannable QR code and your own discount coupon.",
  },
  {
    icon: Megaphone,
    title: "Share & promote",
    body: "Post your link or coupon on Instagram, YouTube, your blog or WhatsApp. Use our ready-made marketing kit.",
  },
  {
    icon: Wallet,
    title: "Earn & get paid",
    body: "Earn commission on every referred order. Track it live and withdraw to UPI or your bank.",
  },
];

const features = [
  { icon: Link2, title: "Personal referral link", body: "A clean link that attributes every click and order to you, with a configurable tracking window." },
  { icon: QrCode, title: "QR code", body: "Download a QR for offline promotion — flyers, packaging, events and stories." },
  { icon: Ticket, title: "Your own coupon", body: "A branded discount code so your audience saves while you earn — works alongside your link." },
  { icon: BarChart3, title: "Real-time dashboard", body: "Clicks, unique visitors, orders, conversion, revenue and earnings — updated as they happen." },
  { icon: Wallet, title: "Simple payouts", body: "Request a payout to UPI or bank once you cross the minimum. No invoices, no chasing." },
  { icon: Sparkles, title: "Marketing kit", body: "Banners, logos and captions ready to share, curated by the Nutriyet team." },
];

export default async function AffiliateLandingPage() {
  const [user, settings] = await Promise.all([getCurrentUser(), getAffiliateSettings()]);
  const affiliate = user?.id ? await getMyAffiliate(user.id) : null;

  const commission =
    settings.affiliateDefaultCommissionType === "PERCENT"
      ? `${settings.affiliateDefaultCommissionValue}%`
      : formatPrice(settings.affiliateDefaultCommissionValue);

  // Smart CTA: middleware sends logged-out visitors to login (callbackUrl → back here).
  const enrolled = affiliate && affiliate.status !== "REJECTED";
  const ctaHref = "/account/affiliate";
  const ctaLabel = !user
    ? "Apply now — it's free"
    : enrolled
      ? "Go to your dashboard"
      : "Apply now — it's free";

  const faqs = [
    {
      q: "How much can I earn?",
      a: `You earn ${commission} commission on the value of every order placed through your link or coupon (commission rates can be customised per partner). There's no cap.`,
    },
    {
      q: "Is it free to join?",
      a: "Yes — applying is completely free. There are no fees, ever.",
    },
    {
      q: "When do my earnings become payable?",
      a: "A commission is confirmed once the order is delivered and its return window has passed, so it's protected against cancellations and returns. After that it's available to withdraw.",
    },
    {
      q: "How do I get paid?",
      a: `Add your UPI or bank details in your dashboard and request a payout once your approved balance reaches ${formatPrice(settings.affiliateMinPayout)}. We process it and notify you.`,
    },
    {
      q: "Who can apply?",
      a: "Influencers, nutritionists, gym partners, bloggers and content creators — anyone with an audience that cares about health and nutrition.",
    },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:py-14">
      {/* Hero */}
      <section className="overflow-hidden rounded-3xl border bg-gradient-to-br from-primary/10 via-background to-gold/10 p-8 shadow-elev-2 sm:p-12">
        <Reveal>
          <span className="inline-flex items-center gap-1.5 rounded-full border bg-background/70 px-3 py-1 text-xs font-medium text-primary">
            <Megaphone className="size-3.5" /> Nutriyet Partner Program
          </span>
          <h1 className="mt-4 max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
            Earn <span className="text-primary">{commission} commission</span> sharing the
            products you love.
          </h1>
          <p className="mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
            Join the {siteConfig.name} affiliate program. Get your own link, QR code and coupon,
            promote India&rsquo;s AI nutrition marketplace, and earn on every sale you refer.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            {settings.affiliateEnabled || enrolled ? (
              <Button asChild size="lg" className="gap-2">
                <Link href={ctaHref}>
                  <Sparkles className="size-4" /> {ctaLabel}
                </Link>
              </Button>
            ) : (
              <Button size="lg" disabled className="gap-2">
                Applications paused
              </Button>
            )}
            <Button asChild variant="outline" size="lg">
              <Link href="#how-it-works">See how it works</Link>
            </Button>
          </div>
          <div className="mt-8 flex flex-wrap gap-6 text-sm">
            <div className="flex items-center gap-2">
              <IndianRupee className="size-4 text-primary" />
              <span className="font-medium">{commission} per sale</span>
            </div>
            <div className="flex items-center gap-2">
              <BarChart3 className="size-4 text-primary" />
              <span className="font-medium">Real-time tracking</span>
            </div>
            <div className="flex items-center gap-2">
              <Wallet className="size-4 text-primary" />
              <span className="font-medium">UPI &amp; bank payouts</span>
            </div>
          </div>
        </Reveal>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="mt-16 scroll-mt-24">
        <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
          How it works
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-center text-sm text-muted-foreground">
          From application to your first payout in four simple steps.
        </p>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <Reveal key={s.title} delay={i * 60}>
              <div className="h-full rounded-2xl border p-5 shadow-elev-1 hover-lift">
                <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <s.icon className="size-5" />
                </div>
                <p className="mt-4 text-xs font-semibold text-primary">Step {i + 1}</p>
                <h3 className="mt-1 font-semibold">{s.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{s.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* What you get */}
      <section className="mt-16">
        <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
          Everything you need to succeed
        </h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <Reveal key={f.title} delay={i * 50}>
              <div className="h-full rounded-2xl border p-5 shadow-elev-1">
                <div className="flex size-11 items-center justify-center rounded-xl bg-gold/15 text-gold-foreground">
                  <f.icon className="size-5 text-gold" />
                </div>
                <h3 className="mt-4 font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{f.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="mt-16">
        <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
          Frequently asked questions
        </h2>
        <div className="mx-auto mt-8 max-w-3xl divide-y rounded-2xl border">
          {faqs.map((f) => (
            <details key={f.q} className="group p-5 [&_summary]:cursor-pointer">
              <summary className="flex items-center justify-between gap-3 font-medium marker:content-['']">
                {f.q}
                <span className="text-muted-foreground transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-2 text-sm text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="mt-16 rounded-3xl border bg-primary/5 p-8 text-center shadow-elev-1 sm:p-12">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Ready to start earning?
        </h2>
        <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
          Join hundreds of creators promoting better nutrition. It takes two minutes to apply.
        </p>
        {settings.affiliateEnabled || enrolled ? (
          <Button asChild size="lg" className="mt-6 gap-2">
            <Link href={ctaHref}>
              <Sparkles className="size-4" /> {ctaLabel}
            </Link>
          </Button>
        ) : (
          <p className="mt-6 text-sm text-muted-foreground">
            Applications are paused right now — please check back soon.
          </p>
        )}
      </section>
    </div>
  );
}
