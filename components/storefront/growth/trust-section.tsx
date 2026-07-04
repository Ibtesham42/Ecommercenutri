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
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {BADGES.map((b) => (
            <li
              key={b.label}
              className="flex items-center gap-2.5 rounded-xl border bg-card px-3.5 py-3 shadow-elev-1 sm:flex-col sm:gap-2 sm:py-4 sm:text-center"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                <b.icon className="size-4.5" />
              </span>
              <span className="text-xs font-semibold leading-tight sm:text-[13px]">{b.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
