import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cldUrl } from "@/lib/cld";

export type BannerCardData = {
  title?: string | null;
  subtitle?: string | null;
  description?: string | null;
  ctaText?: string | null;
  desktopImage: string;
  mobileImage?: string | null;
  desktopImageDark?: string | null;
  mobileImageDark?: string | null;
};

const DIMS = {
  desktop: { w: 1600, h: 400 },
  tablet: { w: 1200, h: 420 },
  mobile: { w: 800, h: 600 },
} as const;

// Smart, retina-aware crop with auto focal point so nothing important is cut.
const opt = (src: string, dim: { w: number; h: number }) =>
  cldUrl(src, { ...dim, crop: "fill", gravity: "auto", dpr: "auto" });

function resolveVariants(b: BannerCardData) {
  // Mobile falls back to the desktop image (auto-cropped); dark falls back to light.
  const lightDesktop = b.desktopImage;
  const lightMobile = b.mobileImage || b.desktopImage;
  const darkDesktop = b.desktopImageDark || b.desktopImage;
  const darkMobile =
    b.mobileImageDark || b.desktopImageDark || b.mobileImage || b.desktopImage;
  return {
    lightDesktop: opt(lightDesktop, DIMS.desktop),
    lightTablet: opt(lightDesktop, DIMS.tablet),
    lightMobile: opt(lightMobile, DIMS.mobile),
    darkDesktop: opt(darkDesktop, DIMS.desktop),
    darkTablet: opt(darkDesktop, DIMS.tablet),
    darkMobile: opt(darkMobile, DIMS.mobile),
  };
}

function TextOverlay({ banner }: { banner: BannerCardData }) {
  const hasText = banner.title || banner.subtitle || banner.description || banner.ctaText;
  if (!hasText) return null;
  return (
    <>
      <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/35 to-transparent" />
      <div className="absolute inset-0 flex flex-col justify-center gap-1 p-4 sm:gap-1.5 sm:p-6 lg:p-10">
        {banner.subtitle && (
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/80 sm:text-xs">
            {banner.subtitle}
          </span>
        )}
        {banner.title && (
          <h3 className="max-w-[16rem] text-lg font-extrabold leading-tight text-white drop-shadow sm:max-w-md sm:text-2xl lg:max-w-lg lg:text-4xl">
            {banner.title}
          </h3>
        )}
        {banner.description && (
          <p className="line-clamp-2 max-w-[18rem] text-xs text-white/85 drop-shadow sm:max-w-sm sm:text-sm lg:max-w-md">
            {banner.description}
          </p>
        )}
        {banner.ctaText && (
          <span className="mt-1.5 inline-flex w-fit items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-black transition group-hover:gap-2.5 sm:mt-2 sm:px-4 sm:py-2 sm:text-sm">
            {banner.ctaText}
            <ArrowRight className="size-3.5 sm:size-4" />
          </span>
        )}
      </div>
    </>
  );
}

// Responsive banner height: comfortable on phones, taller on large screens so
// uploaded artwork + content read well on every device.
const imgClass = "h-52 w-full object-cover sm:h-60 md:h-56 lg:h-72";

/**
 * Renders a promotional banner image with a text overlay. Shared by the
 * storefront `BannerStrip` and the admin live preview.
 *
 * - Storefront: a responsive `<picture>` with tablet/desktop crops and optional
 *   dark-mode variants (light is the fallback), all auto-optimized via Cloudinary.
 * - Admin preview: pass `preview` to force a single theme/viewport variant.
 */
export function BannerCard({
  banner,
  href,
  preview,
}: {
  banner: BannerCardData;
  href?: string | null;
  preview?: { theme: "light" | "dark"; viewport: "desktop" | "mobile" };
}) {
  const v = resolveVariants(banner);
  const hasDark = Boolean(banner.desktopImageDark || banner.mobileImageDark);

  let media;
  if (preview) {
    const src =
      preview.theme === "dark"
        ? preview.viewport === "mobile"
          ? v.darkMobile
          : v.darkDesktop
        : preview.viewport === "mobile"
          ? v.lightMobile
          : v.lightDesktop;
    media = (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={banner.title ?? "Promotion"} className={imgClass} />
    );
  } else {
    media = (
      <picture>
        {hasDark && (
          <>
            <source media="(prefers-color-scheme: dark) and (min-width: 1024px)" srcSet={v.darkDesktop} />
            <source media="(prefers-color-scheme: dark) and (min-width: 640px)" srcSet={v.darkTablet} />
            <source media="(prefers-color-scheme: dark)" srcSet={v.darkMobile} />
          </>
        )}
        <source media="(min-width: 1024px)" srcSet={v.lightDesktop} />
        <source media="(min-width: 640px)" srcSet={v.lightTablet} />
        <img src={v.lightMobile} alt={banner.title ?? "Promotion"} className={imgClass} loading="lazy" />
      </picture>
    );
  }

  const inner = (
    <div className="hover-lift relative overflow-hidden rounded-2xl shadow-elev-1 group-hover:shadow-elev-2">
      {media}
      <TextOverlay banner={banner} />
    </div>
  );

  if (!href) return inner;
  return (
    <Link href={href} className="group block">
      {inner}
    </Link>
  );
}
