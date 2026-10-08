import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * PDP details: Description / Benefits / Ingredients as native disclosure
 * sections (open by default, collapsible) beside an optional nutrition column.
 * Unlike tabs, every section's copy is in the server HTML — crawlable and
 * readable without JS. Server component; variant-aware bits come in as nodes.
 */
export function ProductDetails({
  name,
  description,
  benefits,
  ingredients,
  nutrition,
}: {
  name: string;
  /** Variant-aware description (client island). */
  description: React.ReactNode;
  benefits?: string | null;
  ingredients?: string | null;
  /** Nutrition table + label image, or null when the product has none. */
  nutrition?: React.ReactNode;
}) {
  return (
    <section aria-labelledby="product-details-heading" className="mt-16 border-t border-border pt-10 lg:mt-24 lg:pt-14">
      <p className="eyebrow">The details</p>
      <h2 id="product-details-heading" className="mt-2 font-heading text-heading text-foreground">
        About {name}
      </h2>
      <div
        className={cn(
          "mt-8",
          nutrition && "lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-start lg:gap-16",
        )}
      >
        <div className="max-w-3xl border-t border-border">
          <Detail title="Description">{description}</Detail>
          {benefits && (
            <Detail title="Benefits">
              <p className="whitespace-pre-line">{benefits}</p>
            </Detail>
          )}
          {ingredients && (
            <Detail title="Ingredients">
              <p className="whitespace-pre-line">{ingredients}</p>
            </Detail>
          )}
        </div>
        {nutrition && <div className="mt-10 space-y-5 lg:mt-0">{nutrition}</div>}
      </div>
    </section>
  );
}

function Detail({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details open className="group border-b border-border">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <h3 className="font-heading text-lg font-medium text-foreground">{title}</h3>
        <ChevronDown
          aria-hidden
          className="size-5 shrink-0 text-muted-foreground motion-safe:transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="pb-6 text-[15px] leading-relaxed text-muted-foreground">{children}</div>
    </details>
  );
}
