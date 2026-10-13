import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BlurImage } from "@/components/storefront/blur-image";
import { getBlogPosts } from "@/lib/queries/blog";

const MITHILA_QUOTE =
  "Makhana has been grown in the Mithila region for generations. We bring that heritage to your everyday kitchen — alongside spices and staples chosen with the same care.";

/**
 * Homepage "Our Story" band. Copy is the brand story already published on
 * /about (not new claims). The photograph is the cover of the latest published
 * Journal post tagged "Makhana" — real imagery from our own media library,
 * credited and linked to its article. With no such post, the visual falls back
 * to a typographic pull-quote panel (never a stock or generated image).
 */
export async function StoryBand() {
  const posts = await getBlogPosts();
  const photo = posts.find((p) => p.coverImage && p.tag?.trim().toLowerCase() === "makhana") ?? null;

  return (
    <section className="bg-oat" data-heat="story">
      <div className="shop-container shop-section grid items-center gap-10 md:grid-cols-2 lg:gap-20">
        {photo?.coverImage ? (
          <figure>
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-muted md:aspect-[4/5] lg:aspect-square">
              <BlurImage
                src={photo.coverImage}
                alt=""
                fill
                sizes="(min-width: 768px) 45vw, 100vw"
                className="object-cover"
              />
            </div>
            <figcaption className="mt-3 text-sm text-muted-foreground">
              From the journal ·{" "}
              <Link href={`/blog/${photo.slug}`} className="text-foreground underline-offset-4 hover:underline">
                {photo.title}
              </Link>
            </figcaption>
          </figure>
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
            Rooted in tradition.
            <span className="block text-primary">Made for today.</span>
          </h2>
          <p className="mt-5 text-base leading-relaxed text-muted-foreground sm:text-[17px]">
            Nutriyet brings together the food traditions of Bihar and Mithila with the convenience
            of modern, everyday shopping. We focus on makhana, spices and other pantry staples that
            feel familiar — sourced and prepared with care, labelled honestly, and shipped straight
            to your door.
          </p>
          {photo?.coverImage && (
            <blockquote className="mt-7 border-l-2 border-sage-deep/50 pl-5 font-heading text-lg leading-snug text-foreground/90 sm:text-xl">
              {MITHILA_QUOTE}
            </blockquote>
          )}
          <Link
            href="/about"
            className="mt-7 inline-flex min-h-11 items-center gap-2 text-[15px] font-semibold text-primary underline-offset-4 hover:underline"
          >
            Read our story <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
