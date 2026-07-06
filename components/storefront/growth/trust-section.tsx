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
    <section className="border-y bg-muted/20" aria-label="Why shop with us">
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:py-10">
        {numbers.length > 0 && (
          <div className="mb-6 grid grid-cols-3 gap-3 sm:mb-8">
            {numbers.map((n) => (
              <div key={n.label} className="rounded-2xl border bg-card p-4 text-center shadow-elev-1">
                <n.icon className="mx-auto size-5 text-gold" />
                <p className="mt-1.5 font-heading text-xl font-bold tabular-nums sm:text-2xl">{n.value}</p>
                <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground sm:text-xs">{n.label}</p>
              </div>
            ))}
          </div>
        )}
        {/* Product promises as one cohesive band (not 6 stamped cards): bare
            gold icons with a refined thin stroke, hairline dividers on desktop
            for rhythm — reads like a considered statement of values, not a
            template grid. */}
        <ul className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-6 lg:gap-x-0 lg:divide-x lg:divide-border/60">
          {BADGES.map((b) => (
            <li
              key={b.label}
              className="flex flex-col items-center gap-2 px-2 text-center lg:px-5"
            >
              <b.icon className="size-5 text-gold" strokeWidth={1.75} aria-hidden />
              <span className="text-xs font-medium leading-snug text-foreground/80 sm:text-[13px]">{b.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
