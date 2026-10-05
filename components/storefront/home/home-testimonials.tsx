import { Star } from "lucide-react";
import { SectionHeading } from "@/components/storefront/section-heading";
import type { TestimonialsContent } from "@/lib/validations/admin";

/** Editorial pull-quotes — a large serif quote mark + hairline-divided
 *  attribution, no card shadow/border chrome. Deliberately not the same
 *  shadowed-card-grid template as `HomeWhyChooseUs` above it. */
export function HomeTestimonials({ content }: { content: TestimonialsContent }) {
  return (
    <section className="border-t bg-muted/30">
      <div className="mx-auto w-full max-w-7xl px-4 py-14 max-sm:py-9">
        <SectionHeading title={content.title} subtitle={content.subtitle} />
        <div className="scroll-rail -mx-4 gap-6 px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-8 sm:px-0">
          {content.items.map((t, i) => (
            <figure key={i} className="w-[78vw] max-w-sm shrink-0 sm:w-auto sm:max-w-none">
              <span aria-hidden className="block font-heading text-5xl leading-none text-primary/25">
                &ldquo;
              </span>
              <blockquote className="-mt-2 text-[15px] leading-relaxed text-foreground/90">
                {t.text}
              </blockquote>
              <figcaption className="mt-4 flex items-center gap-2 border-t border-border/60 pt-3">
                <div className="flex gap-0.5">
                  {Array.from({ length: Math.max(0, Math.min(5, t.rating)) }).map((_, j) => (
                    <Star key={j} className="size-3.5 fill-gold text-gold" />
                  ))}
                </div>
                <span className="text-sm font-semibold">{t.name}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
