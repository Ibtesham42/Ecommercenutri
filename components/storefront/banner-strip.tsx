import { getBanners, bannerHref } from "@/lib/queries/banners";
import type { BannerPosition } from "@/lib/banners";
import { BannerCard } from "@/components/storefront/banner-card";
import { cn } from "@/lib/utils";

/** Renders all active banners for a placement. Server component; renders nothing
 *  when there are no active banners (so placements are fully additive). */
export async function BannerStrip({
  position,
  className,
}: {
  position: BannerPosition;
  className?: string;
}) {
  const banners = await getBanners(position);
  if (banners.length === 0) return null;

  return (
    <div className={cn("mx-auto w-full max-w-7xl space-y-4 px-4", className)}>
      {banners.map((b) => (
        <BannerCard key={b.id} banner={b} href={bannerHref(b)} />
      ))}
    </div>
  );
}
