import { getSpinTeaser } from "@/lib/spin/service";
import { cn } from "@/lib/utils";
import { SpinEntryLink } from "@/components/storefront/spin/spin-entry-link";

/**
 * Quiet, explicit Spin & Win entry point — a single band the shopper chooses
 * to tap. Never a popup/overlay. Renders nothing unless a campaign is live.
 */
export async function SpinEntryBand({
  source,
  className,
  contained = true,
}: {
  source: string;
  className?: string;
  /** false when the caller already sits inside a shop-container. */
  contained?: boolean;
}) {
  const teaser = await getSpinTeaser();
  if (!teaser) return null;
  return (
    <section aria-label="Spin & Win" className={cn(contained && "shop-container", className)}>
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-oat px-5 py-5 text-oat-foreground sm:flex-row sm:items-center sm:justify-between sm:px-7">
        <div className="min-w-0">
          <p className="eyebrow">Spin &amp; Win</p>
          <p className="mt-1.5 font-heading text-subheading font-medium text-foreground">
            One spin. Up to {teaser.topPercent}% off a selected favourite.
          </p>
          <p className="mt-1 text-sm">Offers on selected products, while stock lasts.</p>
        </div>
        <SpinEntryLink source={source} />
      </div>
    </section>
  );
}
