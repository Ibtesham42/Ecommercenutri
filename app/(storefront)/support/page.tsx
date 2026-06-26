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
import { PageBreadcrumb } from "@/components/storefront/page-breadcrumb";

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
    href: "/shipping",
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
    <div className="mx-auto w-full max-w-5xl px-4 py-12">
      <PageBreadcrumb items={[{ name: "Home", href: "/" }, { name: "Support" }]} />

      <header className="mt-6 max-w-2xl">
        <h1 className="text-3xl font-bold sm:text-4xl">How can we help?</h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Browse common topics below, or get in touch — we usually reply within 1–2 business days.
        </p>
      </header>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {RESOURCES.map((r) => (
          <Link
            key={r.title}
            href={r.href}
            className="group rounded-2xl border p-5 transition-shadow hover:shadow-md"
          >
            <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
              <r.icon className="size-6" />
            </span>
            <h2 className="mt-3 flex items-center gap-1 font-semibold group-hover:text-primary">
              {r.title}
              <ArrowRight className="size-4 opacity-0 transition-opacity group-hover:opacity-100" />
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{r.desc}</p>
          </Link>
        ))}
      </div>

      <section className="mt-12 rounded-2xl border bg-accent/30 p-8 text-center">
        <h2 className="text-xl font-semibold">Still need a hand?</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Our team is happy to help with orders, products or nutrition questions.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            <Mail className="size-4" /> Contact us
          </Link>
          {whatsappDigits && (
            <a
              href={`https://wa.me/${whatsappDigits}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border bg-background px-5 py-2.5 text-sm font-semibold transition hover:bg-accent"
            >
              <MessageCircle className="size-4" /> WhatsApp
            </a>
          )}
          <a
            href={`mailto:${store.supportEmail}`}
            className="inline-flex items-center gap-2 rounded-full border bg-background px-5 py-2.5 text-sm font-semibold transition hover:bg-accent"
          >
            <Mail className="size-4" /> {store.supportEmail}
          </a>
        </div>
      </section>
    </div>
  );
}
