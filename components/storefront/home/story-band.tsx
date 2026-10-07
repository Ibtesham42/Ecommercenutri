import Link from "next/link";
import { ArrowRight } from "lucide-react";

/**
 * Homepage "Our Story" band. Copy is the brand story already published on
 * /about (not new claims). No lifestyle photograph exists in the media library
 * yet, so the visual is a typographic pull-quote panel rather than a stock or
 * generated image — swap in a real photo here once one is uploaded.
 */
export function StoryBand() {
  return (
    <section className="bg-oat" data-heat="story">
      <div className="shop-section mx-auto grid w-full max-w-7xl items-center gap-10 px-4 md:grid-cols-2 lg:gap-16">
        <figure className="rounded-2xl bg-surface-deep px-7 py-10 text-surface-deep-foreground sm:px-10 sm:py-14">
          <p className="eyebrow !text-gold">From the heart of Mithila</p>
          <blockquote className="mt-5 font-heading text-[1.6rem] leading-snug font-normal sm:text-[1.9rem]">
            Makhana has been grown in the Mithila region for generations. We bring that heritage to
            your everyday kitchen — alongside spices and staples chosen with the same care.
          </blockquote>
        </figure>

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
