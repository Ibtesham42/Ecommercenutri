import Link from "next/link";
import { Star } from "lucide-react";
import { SectionHeading } from "@/components/storefront/section-heading";
import { getHomeReviews, MIN_HOME_REVIEWS } from "@/lib/queries/trust";
import type { TestimonialsContent } from "@/lib/validations/admin";

/**
 * Customer words on the homepage: genuine approved reviews only (never the
 * editable sample quotes). The admin editor still sets the heading. Renders
 * nothing until enough real reviews exist.
 */
export async function HomeTestimonials({ content }: { content: TestimonialsContent }) {
  const reviews = await getHomeReviews();
  if (reviews.length < MIN_HOME_REVIEWS) return null;

  return (
    <section className="bg-oat" data-heat="testimonials">
      <div className="shop-container shop-section">
        <SectionHeading title={content.title} subtitle={content.subtitle} />
        <ul className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-6 overflow-x-auto overscroll-x-contain px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-x-10 sm:gap-y-12 sm:overflow-visible sm:px-0 lg:grid-cols-3 [&::-webkit-scrollbar]:hidden">
          {reviews.map((r) => (
            <li key={r.id} className="w-[80vw] max-w-sm shrink-0 snap-start sm:w-auto sm:max-w-none">
              <figure className="m-0 flex h-full flex-col">
                <div className="flex gap-0.5" role="img" aria-label={`Rated ${r.rating} out of 5`}>
                  {Array.from({ length: r.rating }).map((_, j) => (
                    <Star key={j} className="size-3.5 fill-gold text-gold" aria-hidden />
                  ))}
                </div>
                <blockquote className="mt-4 font-heading text-lg leading-snug text-foreground sm:text-xl">
                  &ldquo;{r.text}&rdquo;
                </blockquote>
                <figcaption className="mt-auto pt-5 text-sm">
                  <span className="block border-t border-border pt-3 font-semibold">
                    {r.author}
                    {r.verifiedPurchase && (
                      <span className="ml-2 font-normal text-muted-foreground">Verified purchase</span>
                    )}
                  </span>
                  <Link
                    href={`/products/${r.product.slug}`}
                    className="mt-0.5 inline-block text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  >
                    {r.product.name}
                  </Link>
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
