import { valuePropIcon } from "@/components/storefront/home/value-prop-icons";
import { SectionHeading } from "@/components/storefront/section-heading";
import type { WhyChooseUsContent } from "@/lib/validations/admin";

/** Borderless icon + hairline-divider feature list — deliberately not a grid
 *  of shadowed cards (that's `HomeTestimonials`' old template too; two
 *  identical card grids back to back reads like a UI kit, not a considered
 *  page). Echoes `TrustSection`'s restrained divider rhythm further down. */
export function HomeWhyChooseUs({ content }: { content: WhyChooseUsContent }) {
  return (
    <section className="shop-section mx-auto w-full max-w-7xl px-4">
      <SectionHeading title={content.title} subtitle={content.subtitle} />
      <ul className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-4 lg:gap-x-0 lg:divide-x lg:divide-border/60">
        {content.items.map((vp, i) => {
          const Icon = valuePropIcon(vp.icon);
          return (
            <li key={i} className="flex flex-col items-start gap-2.5 lg:px-6 lg:first:pl-0">
              <Icon className="size-6 text-primary" strokeWidth={1.5} aria-hidden />
              <h3 className="font-heading text-lg font-medium">{vp.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{vp.desc}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
