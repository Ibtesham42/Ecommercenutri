import { ShieldCheck, Leaf, Package, Sprout, Truck, MapPin, Star, Users, BadgeCheck } from "lucide-react";
import { getTrustStats } from "@/lib/queries/trust";

/**
 * Premium trust section (below the hero). Static badges are always-true product
 * promises; the numeric stats are REAL database values shown only when they
 * clear a credibility threshold (getTrustStats) — never fabricated. Renders as a
 * server component; degrades gracefully to just the badges when no stat qualifies.
 */

const BADGES = [
  { icon: ShieldCheck, label: "Premium Quality" },
  { icon: Package, label: "Secure Payments" },
  { icon: Leaf, label: "Freshly Packed" },
  { icon: Sprout, label: "No Artificial Preservatives" },
  { icon: Truck, label: "Fast Shipping" },
  { icon: MapPin, label: "Made in India" },
];

const nf = new Intl.NumberFormat("en-IN");

export async function TrustSection() {
  const stats = await getTrustStats();

  const numbers: { icon: typeof Star; value: string; label: string }[] = [];
  if (stats.ordersDelivered)
    numbers.push({ icon: BadgeCheck, value: `${nf.format(stats.ordersDelivered)}+`, label: "Orders Delivered" });
  if (stats.reviewCount)
    numbers.push({
      icon: Star,
      value: stats.avgRating ? `${stats.avgRating.toFixed(1)}★` : `${nf.format(stats.reviewCount)}`,
      label: stats.avgRating ? `From ${nf.format(stats.reviewCount)} verified reviews` : "Verified Reviews",
    });
  if (stats.returningCustomers)
    numbers.push({ icon: Users, value: `${nf.format(stats.returningCustomers)}+`, label: "Returning Customers" });

  return (
    // `trust-strip` lets globals.css trim the neighbouring sections' padding so the
    // strip reads as a compact band between them, not a section of its own.
    <section className="trust-strip border-y border-border bg-background" aria-label="Why shop with us">
      <div className="shop-container py-4 sm:py-5">
        {numbers.length > 0 && (
          <div className="mb-4 grid grid-cols-3 gap-3 sm:mb-5">
            {numbers.map((n) => (
              <div key={n.label} className="p-2 text-center">
                <n.icon className="mx-auto size-5 text-primary" strokeWidth={1.6} />
                <p className="mt-1.5 font-heading text-xl font-medium tabular-nums sm:text-2xl">{n.value}</p>
                <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground sm:text-xs">{n.label}</p>
              </div>
            ))}
          </div>
        )}
        {/* Product promises as one compact band (not 6 stamped cards): bare
            thin-stroke icons, hairline dividers from md up. Phones: 2 rows × 3,
            icon above label. md+: one row; lg+: icon beside label, so the strip
            is a single short line. */}
        <ul className="grid grid-cols-3 gap-x-2 gap-y-3 md:grid-cols-6 md:gap-x-0 md:divide-x md:divide-border/60">
          {BADGES.map((b) => (
            <li
              key={b.label}
              className="flex flex-col items-center justify-center gap-1 px-1 text-center md:px-2 lg:flex-row lg:gap-2 lg:px-3 lg:text-left"
            >
              <b.icon className="size-4 shrink-0 text-primary lg:size-[18px]" strokeWidth={1.6} aria-hidden />
              <span className="text-[11px] font-medium leading-tight text-balance text-foreground/80 sm:text-xs lg:text-[13px] lg:leading-snug">
                {b.label}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
