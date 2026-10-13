import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BlurImage } from "@/components/storefront/blur-image";
import { getBlogPosts } from "@/lib/queries/blog";

export const MITHILA_QUOTE =
  "Makhana has been grown in the Mithila region for generations. We bring that heritage to your everyday kitchen — alongside spices and staples chosen with the same care.";

/**
 * Homepage "Our Story" band. Copy is the brand story already published on
 * /about (not new claims). The photograph is the cover of the latest published
 * Journal post tagged "Makhana" — real imagery from our own media library,
 * credited and linked to its article. With no such post, the visual falls back
 * to a typographic pull-quote panel (never a stock or generated image).
 */
/** The brand-story photograph (also used on /about): the latest published
 *  Journal post tagged "Makhana" that has a cover, or null. */
export async function getStoryPhoto() {
  const posts = await getBlogPosts();
  return posts.find((p) => p.coverImage && p.tag?.trim().toLowerCase() === "makhana") ?? null;
}

export async function StoryBand() {
  const photo = await getStoryPhoto();

  return (
    <section className="relative isolate overflow-hidden bg-oat" data-heat="story">
      {/* Photo bleeds off the left edge (desktop) / runs full-width on top (phones). */}
      {photo?.coverImage && (
        <div className="relative aspect-[16/10] bg-muted md:absolute md:inset-y-0 md:left-0 md:aspect-auto md:w-1/2">
          <BlurImage
            src={photo.coverImage}
            alt=""
            fill
            sizes="(min-width: 768px) 50vw, 100vw"
            className="object-cover"
          />
          <div
            aria-hidden
            className="absolute inset-y-0 right-0 hidden w-24 bg-gradient-to-r from-transparent to-oat/50 md:block"
          />
        </div>
      )}

      <div className="shop-container shop-section relative grid items-center gap-10 md:min-h-[28rem] md:grid-cols-2 lg:gap-20">
        {photo?.coverImage ? (
          <div aria-hidden className="hidden md:block" />
        ) : (
          <figure className="rounded-2xl bg-surface-deep px-7 py-10 text-surface-deep-foreground sm:px-10 sm:py-14">
            <p className="eyebrow !text-gold">From the heart of Mithila</p>
            <blockquote className="mt-5 font-heading text-[1.6rem] leading-snug font-normal sm:text-[1.9rem]">
              {MITHILA_QUOTE}
            </blockquote>
          </figure>
        )}

        <div className="max-w-lg">
          <p className="eyebrow">Our story</p>
          <h2 className="mt-4 font-heading text-title font-medium text-foreground">
            From the fields of Bihar
            <span className="block">to your everyday bowl.</span>
          </h2>
          <p className="mt-5 text-base leading-relaxed text-muted-foreground sm:text-[17px]">
            Nutriyet brings together the food traditions of Bihar and Mithila with the convenience
            of modern, everyday shopping. We focus on makhana, spices and other pantry staples that
            feel familiar — sourced and prepared with care, labelled honestly, and shipped straight
            to your door.
          </p>
          <Button asChild className="mt-7 h-11 gap-2 rounded-md px-5 text-sm font-semibold">
            <Link href="/about">
              Read our story <ArrowRight className="size-4" />
            </Link>
          </Button>
          {photo && (
            <p className="mt-5 text-xs text-muted-foreground">
              Photo from the journal ·{" "}
              <Link href={`/blog/${photo.slug}`} className="text-foreground underline-offset-4 hover:underline">
                {photo.title}
              </Link>
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
