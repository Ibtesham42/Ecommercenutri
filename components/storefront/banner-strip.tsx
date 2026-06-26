import { getBanners, bannerHref } from "@/lib/queries/banners";
import type { BannerPosition } from "@/lib/banners";
import { BannerCard } from "@/components/storefront/banner-card";
import { BannerSlider } from "@/components/storefront/banner-slider";
import { cn } from "@/lib/utils";

/** Renders the active banners for a placement. Server component; renders nothing
 *  when there are none (placements stay fully additive). A single banner renders
 *  statically; multiple banners become a swipeable auto-advancing slider. */
export async function BannerStrip({
  position,
  className,
  fullBleed,
}: {
  position: BannerPosition;
  className?: string;
  /** Edge-to-edge (no max-width / side padding / rounded corners). */
  fullBleed?: boolean;
}) {
  const banners = await getBanners(position);
  if (banners.length === 0) return null;

  return (
    <div className={cn(fullBleed ? "w-full" : "mx-auto w-full max-w-7xl px-4", className)}>
      {banners.length === 1 ? (
        <BannerCard banner={banners[0]} href={bannerHref(banners[0])} bleed={fullBleed} />
      ) : (
        <BannerSlider banners={banners.map((b) => ({ ...b, href: bannerHref(b) }))} bleed={fullBleed} />
      )}
    </div>
  );
}
