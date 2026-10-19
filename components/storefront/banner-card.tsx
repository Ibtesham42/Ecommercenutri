import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cldUrl } from "@/lib/cld";
import { cn } from "@/lib/utils";
import { BannerVideo } from "@/components/storefront/banner-video";

export type BannerCardData = {
  title?: string | null;
  subtitle?: string | null;
  description?: string | null;
  ctaText?: string | null;
  desktopImage: string;
  mobileImage?: string | null;
  desktopImageDark?: string | null;
  mobileImageDark?: string | null;
  /** "IMAGE" (default) or "VIDEO". */
  mediaType?: string | null;
  videoUrl?: string | null;
};

// Upper bounds per breakpoint (generous, for future higher-res uploads). With
// c_limit Cloudinary keeps the aspect ratio and never upscales, so the original
// pixels are delivered as-is — no soft enlargement, no cropping.
const DIMS = {
  desktop: { w: 2560, h: 1280 },
  tablet: { w: 1600, h: 1000 },
  mobile: { w: 1200, h: 1500 },
} as const;

const opt = (src: string, dim: { w: number; h: number }) =>
  cldUrl(src, { ...dim, crop: "limit" });

/** Aspect hint (the uploaded banners are 1600×529, ≈3:1) so the box reserves
 *  space before the image loads; the image's real ratio takes over on load. */
const ASPECT_HINT = { width: 1600, height: 529 } as const;

function resolveVariants(b: BannerCardData) {
  // Mobile falls back to the desktop image; dark falls back to light.
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
    // Tiny cover crop used as a blurred backdrop to fill the frame premium-style.
    ambient: cldUrl(b.desktopImage, { w: 200, h: 80, crop: "fill" }),
  };
}

function TextOverlay({ banner }: { banner: BannerCardData }) {
  const hasText = banner.title || banner.subtitle || banner.description || banner.ctaText;
  if (!hasText) return null;
  return (
    <>
      <div className="absolute inset-0 z-[2] bg-gradient-to-r from-black/70 via-black/35 to-transparent" />
      <div className="absolute inset-0 z-[2] flex flex-col justify-center gap-1 p-4 sm:gap-1.5 sm:p-6 lg:p-10">
        {banner.subtitle && (
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/80 sm:text-xs">
            {banner.subtitle}
          </span>
        )}
        {banner.title && (
          <h3 className="max-w-[16rem] font-heading text-lg font-semibold leading-tight tracking-tight text-white drop-shadow sm:max-w-md sm:text-2xl lg:max-w-lg lg:text-4xl">
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

// The artwork sets the height: full width at its own aspect ratio, so it fills
// the frame edge to edge with no letterbox at any width and is never cropped or
// stretched. Only an unusually tall upload hits the max-height cap (tighter on
// phones, so a portrait mobile image never swallows the screen; 1:1 and 4:5
// mobile banners still show in full), where `object-contain` keeps it whole and
// the blurred backdrop fills the sides.
const imgClass =
  "relative z-[1] block h-auto max-h-[min(34rem,62svh)] w-full object-contain sm:max-h-[min(42rem,80svh)]";
// Video fills the frame (object-cover) — the video is the full visual.
const videoClass = "relative z-[1] block h-52 w-full object-cover sm:h-60 md:h-56 lg:h-72";

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
  bleed,
  active = true,
  videoPreload,
}: {
  banner: BannerCardData;
  href?: string | null;
  preview?: { theme: "light" | "dark"; viewport: "desktop" | "mobile" };
  /** Full-bleed (edge-to-edge): drops rounded corners + card shadow. */
  bleed?: boolean;
  /** Slider passes false for off-slides so their video pauses/resets. */
  active?: boolean;
  videoPreload?: "auto" | "metadata" | "none";
}) {
  const isVideo = banner.mediaType === "VIDEO" && !!banner.videoUrl;

  // Video banners: the video IS the full visual — no text overlay, object-cover.
  if (isVideo) {
    const poster = banner.desktopImage
      ? cldUrl(banner.desktopImage, { w: 1600, h: 600, crop: "fill" })
      : undefined;
    const videoInner = (
      <div
        className={cn(
          "relative overflow-hidden bg-black",
          bleed ? "" : "hover-lift rounded-2xl shadow-elev-1 group-hover:shadow-elev-2",
        )}
      >
        <BannerVideo
          src={banner.videoUrl as string}
          poster={poster}
          active={preview ? true : active}
          preload={videoPreload}
          className={videoClass}
        />
      </div>
    );
    if (!href) return videoInner;
    return (
      <Link href={href} className="group block">
        {videoInner}
      </Link>
    );
  }

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
      <img src={src} alt={banner.title ?? "Promotion"} width={ASPECT_HINT.width} height={ASPECT_HINT.height} className={imgClass} />
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
        <img
          src={v.lightMobile}
          alt={banner.title ?? "Promotion"}
          width={ASPECT_HINT.width}
          height={ASPECT_HINT.height}
          sizes="100vw"
          className={imgClass}
          loading="lazy"
        />
      </picture>
    );
  }

  const inner = (
    <div
      className={cn(
        "relative overflow-hidden bg-neutral-100 dark:bg-neutral-900",
        bleed ? "" : "hover-lift rounded-2xl shadow-elev-1 group-hover:shadow-elev-2",
      )}
    >
      {/* Ambient blurred backdrop fills any letterbox space premium-style. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={v.ambient}
        alt=""
        aria-hidden
        className="absolute inset-0 z-0 size-full scale-125 object-cover blur-2xl"
      />
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
