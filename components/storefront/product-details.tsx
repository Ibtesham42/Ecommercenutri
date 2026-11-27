import { Minus, Plus } from "lucide-react";

/**
 * PDP details, set under the buy box: Description / Why you'll love it /
 * Ingredients / Nutrition as native disclosure rows divided by hairlines.
 * Closed sections stay in the server HTML (crawlable, readable without JS).
 * Server component; variant-aware bits come in as nodes.
 */
export function ProductDetails({
  description,
  benefits,
  ingredients,
  nutrition,
}: {
  /** Variant-aware description (client island). */
  description: React.ReactNode;
  benefits?: string | null;
  ingredients?: string | null;
  /** Nutrition table + label image, or null when the product has none. */
  nutrition?: React.ReactNode;
}) {
  const benefitItems = (benefits ?? "")
    .split(/\r?\n/)
    .map((l) => l.replace(/^[-•*\s]+/, "").trim())
    .filter(Boolean);

  return (
    <section aria-label="Product details" className="mt-8 border-t border-foreground">
      <Detail title="Description" open>
        {description}
      </Detail>
      {benefitItems.length > 0 && (
        <Detail title="Why you'll love it" open>
          <ul className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
            {benefitItems.map((b) => (
              <li key={b} className="flex gap-2.5 text-foreground/85">
                <span aria-hidden className="mt-[0.6em] size-1 shrink-0 rounded-full bg-foreground/60" />
                {b}
              </li>
            ))}
          </ul>
        </Detail>
      )}
      {ingredients && (
        <Detail title="Ingredients">
          <p className="whitespace-pre-line">{ingredients}</p>
        </Detail>
      )}
      {nutrition && (
        <Detail title="Nutrition">
          <div className="space-y-5">{nutrition}</div>
        </Detail>
      )}
    </section>
  );
}

function Detail({ title, open, children }: { title: string; open?: boolean; children: React.ReactNode }) {
  return (
    <details open={open} className="group border-b border-border">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <h2 className="font-heading text-lg font-normal text-foreground">{title}</h2>
        <Plus aria-hidden className="size-4 shrink-0 text-foreground/70 group-open:hidden" />
        <Minus aria-hidden className="hidden size-4 shrink-0 text-foreground/70 group-open:block" />
      </summary>
      <div className="pb-6 text-[15px] leading-relaxed text-muted-foreground">{children}</div>
    </details>
  );
}
