import type { Metadata } from "next";
import Link from "next/link";
import {
  Truck,
  Mail,
  Sparkles,
  RotateCcw,
  ShieldCheck,
  FileText,
  PackageSearch,
  MessageCircle,
  ArrowRight,
} from "lucide-react";
import { buildMetadata } from "@/lib/seo";
import { getStoreSettings } from "@/lib/queries/settings";
import { CONTENT_PAGE_CLASS, PageHeader } from "@/components/storefront/page-header";

export const metadata: Metadata = buildMetadata({
  title: "Help & Support",
  description: "Find answers, track an order, or reach the Nutriyet team.",
  path: "/support",
});

const RESOURCES = [
  {
    icon: PackageSearch,
    title: "Track your order",
    desc: "Check delivery status with your order number and email.",
    href: "/track",
  },
  {
    icon: Truck,
    title: "Shipping & Returns",
    desc: "Delivery timelines, free-shipping threshold and returns.",
    href: "/shipping",
  },
  {
    icon: RotateCcw,
    title: "Refunds",
    desc: "How and when refunds are processed for eligible orders.",
    href: "/returns-refunds",
  },
  {
    icon: Sparkles,
    title: "Ask the AI assistant",
    desc: "Get instant nutrition and product guidance, 24/7.",
    href: "/assistant",
  },
  {
    icon: ShieldCheck,
    title: "Privacy Policy",
    desc: "What data we collect and how we protect it.",
    href: "/privacy",
  },
  {
    icon: FileText,
    title: "Terms of Service",
    desc: "The terms that govern your use of Nutriyet.",
    href: "/terms",
  },
];

// Reads admin-editable store contact details — render per request.
export const dynamic = "force-dynamic";

export default async function SupportPage() {
  const store = await getStoreSettings();
  const whatsappDigits = store.whatsapp?.replace(/[^\d]/g, "");

  return (
    <div className={CONTENT_PAGE_CLASS}>
      <PageHeader
        crumbs={[{ name: "Home", href: "/" }, { name: "Support" }]}
        eyebrow="Help centre"
        title="How can we help?"
        lede="Browse common topics below, or get in touch — we usually reply within 1–2 business days."
      />

      <ul className="mt-10 grid gap-x-10 sm:mt-12 sm:grid-cols-2 lg:grid-cols-3">
        {RESOURCES.map((r) => (
          <li key={r.title} className="border-t border-border">
            <Link href={r.href} className="group flex items-start gap-4 py-6 outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <r.icon className="mt-0.5 size-5 shrink-0 text-terracotta" strokeWidth={1.5} aria-hidden />
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 font-heading text-subheading font-medium group-hover:text-primary">
                  {r.title}
                  <ArrowRight className="size-4 shrink-0 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden />
                </span>
                <span className="mt-1 block text-[15px] leading-relaxed text-muted-foreground">{r.desc}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <section
        aria-labelledby="support-contact"
        className="mt-14 rounded-xl bg-surface-deep p-6 text-surface-deep-foreground sm:mt-16 sm:p-10"
      >
        <h2 id="support-contact" className="font-heading text-heading font-medium">
          Still need a hand?
        </h2>
        <p className="mt-2 max-w-md text-[15px] leading-relaxed text-surface-deep-foreground/80">
          Our team is happy to help with orders, products or nutrition questions.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link
            href="/contact"
            className="inline-flex h-12 items-center gap-2 rounded-lg bg-gold px-5 text-[15px] font-medium text-gold-foreground outline-none transition-colors hover:bg-gold/90 focus-visible:ring-3 focus-visible:ring-gold/50"
          >
            <Mail className="size-4" aria-hidden /> Contact us
          </Link>
          {whatsappDigits && (
            <a
              href={`https://wa.me/${whatsappDigits}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 items-center gap-2 rounded-lg border border-white/25 px-5 text-[15px] font-medium outline-none transition-colors hover:bg-white/10 focus-visible:ring-3 focus-visible:ring-gold/50"
            >
              <MessageCircle className="size-4" aria-hidden /> WhatsApp
            </a>
          )}
          <a
            href={`mailto:${store.supportEmail}`}
            className="inline-flex min-h-12 max-w-full items-center gap-2 rounded-lg border border-white/25 px-5 text-[15px] font-medium outline-none transition-colors [overflow-wrap:anywhere] hover:bg-white/10 focus-visible:ring-3 focus-visible:ring-gold/50"
          >
            <Mail className="size-4 shrink-0" aria-hidden /> {store.supportEmail}
          </a>
        </div>
      </section>
    </div>
  );
}
