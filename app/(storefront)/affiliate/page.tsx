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
  ArrowRight,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getMyAffiliate } from "@/lib/queries/affiliate";
import { getAffiliateSettings } from "@/lib/queries/settings";
import { Reveal } from "@/components/storefront/reveal";
import { SectionHeading } from "@/components/storefront/section-heading";
import { FaqList } from "@/components/storefront/faq-list";
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

  const canApply = settings.affiliateEnabled || enrolled;
  const goldCta =
    "inline-flex h-12 items-center gap-2 rounded-lg bg-gold px-6 text-[15px] font-medium text-gold-foreground outline-none transition-colors hover:bg-gold/90 focus-visible:ring-3 focus-visible:ring-gold/50";

  return (
    <div>
      {/* Hero — forest colour block, same language as /b2b */}
      <section className="bg-surface-deep text-surface-deep-foreground">
        <div className="shop-container py-14 md:py-20 lg:py-24">
          <Reveal>
            <p className="eyebrow !text-gold">Nutriyet partner program</p>
            <h1 className="mt-3 max-w-3xl font-heading text-title [overflow-wrap:anywhere]">
              Earn <span className="text-gold">{commission} commission</span> sharing the products you
              love.
            </h1>
            <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-surface-deep-foreground/80 sm:text-base">
              Join the {siteConfig.name} affiliate program. Get your own link, QR code and coupon,
              promote India&rsquo;s AI nutrition marketplace, and earn on every sale you refer.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              {canApply ? (
                <Link href={ctaHref} className={goldCta}>
                  {ctaLabel} <ArrowRight className="size-4" />
                </Link>
              ) : (
                <span className="inline-flex h-12 items-center rounded-lg border border-white/25 px-6 text-[15px] text-surface-deep-foreground/70">
                  Applications paused
                </span>
              )}
              <Link
                href="#how-it-works"
                className="inline-flex h-12 items-center rounded-lg border border-white/25 px-6 text-[15px] font-medium outline-none transition-colors hover:bg-white/10 focus-visible:ring-3 focus-visible:ring-gold/50"
              >
                See how it works
              </Link>
            </div>
            <ul className="mt-10 flex max-w-2xl flex-wrap gap-x-8 gap-y-3 border-t border-white/15 pt-5 text-[15px]">
              <li className="flex items-center gap-2">
                <IndianRupee className="size-4 text-gold" strokeWidth={1.75} aria-hidden /> {commission} per sale
              </li>
              <li className="flex items-center gap-2">
                <BarChart3 className="size-4 text-gold" strokeWidth={1.75} aria-hidden /> Real-time tracking
              </li>
              <li className="flex items-center gap-2">
                <Wallet className="size-4 text-gold" strokeWidth={1.75} aria-hidden /> UPI &amp; bank payouts
              </li>
            </ul>
          </Reveal>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="shop-container shop-section scroll-mt-28">
        <SectionHeading
          eyebrow="How it works"
          title="Four steps to your first payout"
          subtitle="From application to your first payout in four simple steps."
        />
        <ol className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-10">
          {steps.map((step, i) => (
            <li key={step.title} className="border-t border-foreground/80 pt-5">
              <Reveal delay={i * 60}>
                <span className="flex items-center justify-between">
                  <span className="font-heading text-subheading text-muted-foreground tabular-nums">0{i + 1}</span>
                  <step.icon className="size-5 text-terracotta" strokeWidth={1.5} aria-hidden />
                </span>
                <h3 className="mt-4 text-[15px] font-semibold">{step.title}</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">{step.body}</p>
              </Reveal>
            </li>
          ))}
        </ol>
      </section>

      {/* What you get */}
      <section className="bg-oat">
        <div className="shop-container shop-section">
          <SectionHeading eyebrow="Your toolkit" title="Everything you need to succeed" />
          <div className="grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <Reveal key={f.title} delay={i * 50}>
                <div className="h-full border-t border-foreground/15 py-6">
                  <f.icon className="size-5 text-terracotta" strokeWidth={1.5} aria-hidden />
                  <h3 className="mt-4 font-heading text-subheading font-medium">{f.title}</h3>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-oat-foreground">{f.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ + final CTA */}
      <section className="shop-container shop-section grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-16">
        <div>
          <SectionHeading eyebrow="FAQ" title="Frequently asked questions" />
          <FaqList items={faqs} />
        </div>
        <aside className="h-fit rounded-xl bg-surface-deep p-6 text-surface-deep-foreground sm:p-8 lg:sticky lg:top-28">
          <h2 className="font-heading text-subheading font-medium">Ready to start earning?</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-surface-deep-foreground/80">
            Join creators promoting better nutrition. It takes two minutes to apply.
          </p>
          {canApply ? (
            <Link href={ctaHref} className={`${goldCta} mt-6 w-full justify-center`}>
              {ctaLabel}
            </Link>
          ) : (
            <p className="mt-6 text-sm text-surface-deep-foreground/70">
              Applications are paused right now — please check back soon.
            </p>
          )}
        </aside>
      </section>
    </div>
  );
}
