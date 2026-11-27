import type { CSSProperties } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BlurImage } from "@/components/storefront/blur-image";
import { MithilaFish } from "@/components/storefront/mithila-fish";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { HeroContent } from "@/lib/validations/admin";

/** A real catalogue product photographed for the hero arch (never stock art). */
export type HeroSpotlight = {
  slug: string;
  name: string;
  image: string;
  imageAlt: string | null;
  sizeLabel: string | null;
  price: number;
  fromPrice: boolean;
};

/** Process promises only — what Nutriyet does, not health or purity claims. */
const PROMISES = ["Authentic ingredients", "Thoughtful processing", "Carefully packed"] as const;

/**
 * Type-led homepage hero ("Hero Banner" section). Serif headline + one solid
 * action on the left; on the right a real product photo in a Mithila arch with
 * a caption linking to it. Without a spotlight product (or in the admin
 * preview) the copy simply spans the band. Admin colours/stats still apply.
 */
export function HomeHero({ content, spotlight }: { content: HeroContent; spotlight?: HeroSpotlight | null }) {
  const style: CSSProperties = {};
  if (content.bgColor) style.background = content.bgColor;
  if (content.textColor) style.color = content.textColor;
  const styled = Boolean(content.bgColor || content.textColor);
  const muted = content.textColor ? "opacity-80" : "text-foreground/75";

  return (
    <section data-heat="hero" aria-labelledby="home-hero-title" style={styled ? style : undefined}>
      <div
        className={cn(
          "shop-container grid gap-8 pt-7 pb-2 sm:pt-10 md:gap-10 md:pt-12 md:pb-4 lg:items-center lg:gap-16 lg:pt-14 lg:pb-6 xl:gap-20",
          spotlight && "md:grid-cols-[1.08fr_0.92fr] md:items-end lg:grid-cols-[1.15fr_0.85fr] lg:items-center",
        )}
      >
        <div className="grid content-center gap-5 lg:gap-6 lg:pb-6">
          {content.eyebrow && (
            <p className="eyebrow flex items-center gap-2.5">
              <MithilaFish />
              {content.eyebrow}
            </p>
          )}
          <h1 id="home-hero-title" className="font-heading text-display font-normal">
            {content.title}
            {content.highlight && (
              <>
                {" "}
                <em className="block font-light italic">{content.highlight}</em>
              </>
            )}
          </h1>
          {content.description && (
            <p className={cn("max-w-[34rem] text-base leading-relaxed sm:text-[17px] lg:text-lg", muted)}>
              {content.description}
            </p>
          )}
          {(content.primaryLabel || content.secondaryLabel) && (
            <div className="mt-1 flex flex-wrap items-center gap-x-7 gap-y-4">
              {content.primaryLabel && (
                <Button
                  asChild
                  className="h-12 w-full rounded-xs px-7 text-[15px] font-semibold min-[480px]:w-auto"
                >
                  <Link href={content.primaryHref || "/products"}>{content.primaryLabel}</Link>
                </Button>
              )}
              {content.secondaryLabel && content.secondaryHref && (
                <Link
                  href={content.secondaryHref}
                  className="inline-flex min-h-11 items-center gap-2 text-[15px] font-medium underline decoration-foreground/35 underline-offset-[6px] transition-colors hover:decoration-current"
                >
                  {content.secondaryLabel} <ArrowRight className="size-4" aria-hidden />
                </Link>
              )}
            </div>
          )}
          {content.stats.length > 0 ? (
            <dl className="flex flex-wrap gap-x-10 gap-y-4 border-t border-current/15 pt-5">
              {content.stats.map((s, i) => (
                <div key={i}>
                  <dt className={cn("text-xs", muted)}>{s.label}</dt>
                  <dd className="font-heading text-2xl">{s.value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <ul className={cn("flex flex-wrap gap-x-5 gap-y-2 border-t border-current/15 pt-5 text-[13px]", muted)}>
              {PROMISES.map((p) => (
                <li key={p} className="flex items-center gap-2">
                  <span aria-hidden className="size-1 rounded-full bg-gold" />
                  {p}
                </li>
              ))}
            </ul>
          )}
        </div>

        {spotlight && (
          <figure className="m-0">
            <Link
              href={`/products/${spotlight.slug}`}
              tabIndex={-1}
              aria-hidden
              className="relative block aspect-[4/5] overflow-hidden rounded-t-full bg-oat min-[480px]:aspect-[5/5.4] md:aspect-[3/4.1] lg:aspect-auto lg:h-[min(40rem,calc(100svh-12rem))] lg:min-h-[32rem]"
            >
              <BlurImage
                src={spotlight.image}
                alt=""
                fill
                priority
                sizes="(min-width: 1024px) 40vw, (min-width: 768px) 45vw, 100vw"
                className="object-cover object-[50%_62%]"
              />
              {/* Inner gold hairline echoing the arch (decorative). */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-2.5 rounded-t-full border border-[oklch(0.93_0.04_85/0.75)]"
              />
            </Link>
            <figcaption className="flex items-baseline justify-between gap-3 border-b border-border py-3 text-sm">
              <span className="min-w-0">
                <span className="font-heading text-[17px]">{spotlight.name}</span>
                {spotlight.sizeLabel && <span className="text-muted-foreground"> · {spotlight.sizeLabel}</span>}
              </span>
              <Link
                href={`/products/${spotlight.slug}`}
                className="-my-3 shrink-0 py-3 font-medium underline decoration-foreground/35 underline-offset-[5px] hover:decoration-current"
              >
                {spotlight.fromPrice && "From "}
                {formatPrice(spotlight.price)} — View
                <span className="sr-only"> {spotlight.name}</span>
              </Link>
            </figcaption>
          </figure>
        )}
      </div>
    </section>
  );
}
