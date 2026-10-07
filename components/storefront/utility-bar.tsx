import Link from "next/link";
import { formatPrice } from "@/lib/format";
import { OfferBar } from "@/components/storefront/growth/offer-bar";
import { DeliverTo } from "@/components/storefront/deliver-to";
import { ThemeToggle } from "@/components/theme-toggle";

const UTILITY_LINKS = [
  { title: "Track Order", href: "/track" },
  { title: "Bulk Enquiry", href: "/b2b#inquiry" },
  { title: "Help", href: "/support" },
] as const;

/**
 * The thin deep-green strip above the header. Scrolls away (not sticky), so
 * the sticky chrome stays a single compact row. Left: the admin-enabled growth
 * offer when it's showing, otherwise the free-shipping line from the real
 * pricing settings. Right (desktop): delivery location + service links + theme.
 */
export function UtilityBar({
  offerText,
  freeShippingThreshold,
  freeShippingEnabled = true,
}: {
  /** Growth sticky-bar copy when the admin has enabled it, else null. */
  offerText: string | null;
  /** Paise — StoreSetting.freeShippingThreshold. */
  freeShippingThreshold?: number | null;
  freeShippingEnabled?: boolean;
}) {
  const shippingLine =
    freeShippingEnabled && freeShippingThreshold
      ? `Free shipping on orders above ${formatPrice(freeShippingThreshold)}`
      : "Delivering across India";
  const shipping = <p className="truncate text-center sm:text-left">{shippingLine}</p>;

  return (
    <div className="bg-surface-deep text-[12.5px] text-surface-deep-foreground/85">
      <div className="mx-auto flex h-8 w-full max-w-7xl items-center justify-center gap-6 px-4 sm:justify-between lg:h-9">
        <div className="min-w-0 flex-1 sm:flex-none">
          {offerText ? (
            <OfferBar text={offerText} variant="inline" fallback={shipping} />
          ) : (
            shipping
          )}
        </div>
        <nav aria-label="Customer service" className="hidden items-center lg:flex">
          <DeliverTo
            className="mr-3 px-0 py-0 text-[12.5px] text-surface-deep-foreground/85 hover:bg-transparent hover:text-surface-deep-foreground [&_.text-foreground]:text-surface-deep-foreground [&_svg]:text-current"
            freeShippingThreshold={freeShippingThreshold}
            freeShippingEnabled={freeShippingEnabled}
          />
          {UTILITY_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="border-l border-surface-deep-foreground/20 px-3 leading-none transition-colors hover:text-surface-deep-foreground hover:underline hover:underline-offset-4"
            >
              {l.title}
            </Link>
          ))}
          <span className="ml-1 border-l border-surface-deep-foreground/20 pl-1 [&_button]:size-8 [&_button]:text-surface-deep-foreground/80 [&_button:hover]:bg-transparent [&_button:hover]:text-surface-deep-foreground [&_svg]:size-4">
            <ThemeToggle />
          </span>
        </nav>
      </div>
    </div>
  );
}
