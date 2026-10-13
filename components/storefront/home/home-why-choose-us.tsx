import { valuePropIcon } from "@/components/storefront/home/value-prop-icons";
import { SectionHeading } from "@/components/storefront/section-heading";
import type { WhyChooseUsContent } from "@/lib/validations/admin";

/** Borderless icon + hairline-divider feature list — deliberately not a grid
 *  of shadowed cards (that's `HomeTestimonials`' old template too; two
 *  identical card grids back to back reads like a UI kit, not a considered
 *  page). The homepage's one sage-ground section: it ties the page body to the
 *  brand green without another beige band or a dark block. */
export function HomeWhyChooseUs({ content }: { content: WhyChooseUsContent }) {
  return (
    <section className="bg-sage text-sage-foreground">
      <div className="shop-container shop-section">
        <SectionHeading title={content.title} subtitle={content.subtitle} />
        <ul className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-4 lg:gap-x-0 lg:divide-x lg:divide-sage-deep/20">
          {content.items.map((vp, i) => {
            const Icon = valuePropIcon(vp.icon);
            return (
              <li key={i} className="flex flex-col items-start gap-2.5 lg:px-6 lg:first:pl-0">
                <Icon className="size-6 text-sage-deep" strokeWidth={1.5} aria-hidden />
                <h3 className="font-heading text-lg font-medium text-foreground">{vp.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{vp.desc}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
