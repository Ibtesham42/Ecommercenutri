import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getBanners, bannerHref, type BannerData } from "@/lib/queries/banners";
import type { BannerPosition } from "@/lib/banners";
import { cldUrl } from "@/lib/cld";
import { cn } from "@/lib/utils";

function BannerCard({ banner }: { banner: BannerData }) {
  const href = bannerHref(banner);
  const desktop = cldUrl(banner.desktopImage, { w: 1600, h: 400, crop: "fill" });
  const mobile = cldUrl(banner.mobileImage || banner.desktopImage, {
    w: 800,
    h: 480,
    crop: "fill",
  });
  const hasText = banner.title || banner.subtitle || banner.description || banner.ctaText;

  const inner = (
    <div className="relative overflow-hidden rounded-2xl">
      <picture>
        <source media="(min-width: 768px)" srcSet={desktop} />
        <img
          src={mobile}
          alt={banner.title ?? "Promotion"}
          className="h-44 w-full object-cover sm:h-52 md:h-44 lg:h-48"
          loading="lazy"
        />
      </picture>
      {hasText && (
        <>
          <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/25 to-transparent" />
          <div className="absolute inset-0 flex flex-col justify-center gap-1.5 p-6 sm:p-8">
            {banner.subtitle && (
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-white/80">
                {banner.subtitle}
              </span>
            )}
            {banner.title && (
              <h3 className="max-w-md text-xl font-extrabold leading-tight text-white drop-shadow sm:text-2xl lg:text-3xl">
                {banner.title}
              </h3>
            )}
            {banner.description && (
              <p className="max-w-sm text-sm text-white/85 drop-shadow">
                {banner.description}
              </p>
            )}
            {banner.ctaText && (
              <span
                className={cn(
                  "mt-2 inline-flex w-fit items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition",
                  href && "group-hover:gap-2.5",
                )}
              >
                {banner.ctaText}
                <ArrowRight className="size-4" />
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );

  if (!href) return inner;
  return (
    <Link href={href} className="group block">
      {inner}
    </Link>
  );
}

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
        <BannerCard key={b.id} banner={b} />
      ))}
    </div>
  );
}
