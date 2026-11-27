"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { cldUrl } from "@/lib/cld";
import { MithilaFish } from "@/components/storefront/mithila-fish";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";

export type CategoryNavNode = {
  id: string;
  name: string;
  slug: string;
  image?: string | null;
  /** Active products in the category (incl. subcategories). */
  productCount: number;
  children: { id: string; name: string; slug: string; productCount: number }[];
};

/** Collection shortcuts — existing routes only. */
const COLLECTIONS = [
  { title: "All products", href: "/products" },
  { title: "Best sellers", href: "/products?sort=best-sellers" },
  { title: "New arrivals", href: "/new-arrivals" },
  { title: "Offers", href: "/offers" },
] as const;

export const countLabel = (n: number) => `${n} ${n === 1 ? "product" : "products"}`;

/** Primary nav link look: plain text, a hairline that sits under the active
 *  section and draws in on hover. No pills, no fills. */
export const navLinkClass = (active: boolean) =>
  cn(
    "relative inline-flex h-11 items-center whitespace-nowrap text-[15px] transition-colors",
    "after:absolute after:inset-x-0 after:bottom-1 after:h-px after:origin-left after:bg-current motion-safe:after:transition-transform",
    active
      ? "text-foreground after:scale-x-100"
      : "text-foreground/80 after:scale-x-0 hover:text-foreground hover:after:scale-x-100",
  );

/**
 * "Shop" flyout (tablet + desktop): a full-width editorial panel under the
 * header — the real categories as a serif index with live product counts,
 * collections, and up to two category photos. Radix NavigationMenu provides
 * hover/focus/tap opening, arrow keys and Escape. The Root and Item are made
 * `static` so the panel positions against the sticky header, not the trigger.
 * Renders nothing when no category has products (keyless-safe).
 */
export function CategoryMegaMenu({
  categories,
  active = false,
  className,
}: {
  categories: CategoryNavNode[];
  active?: boolean;
  className?: string;
}) {
  if (categories.length === 0) return null;
  const half = Math.ceil(categories.length / 2);
  const columns = [categories.slice(0, half), categories.slice(half)];
  const featured = categories.filter((c) => c.image).slice(0, 2);

  return (
    // Radix wraps the list in an inline `position: relative` div — override it so
    // the panel's containing block is the sticky header (full-width panel).
    <NavigationMenu viewport={false} className={cn("static max-w-none flex-none [&>div]:!static", className)}>
      <NavigationMenuList>
        <NavigationMenuItem className="static">
          <NavigationMenuTrigger
            className={cn(
              navLinkClass(active),
              "gap-0.5 rounded-none bg-transparent px-0 py-0 font-normal hover:bg-transparent focus:bg-transparent data-[state=open]:bg-transparent data-[state=open]:text-foreground data-[state=open]:after:scale-x-100 data-[state=open]:hover:bg-transparent data-[state=open]:focus:bg-transparent",
            )}
          >
            Shop
          </NavigationMenuTrigger>
          <NavigationMenuContent className="!inset-x-0 !top-full !mt-0 !w-auto !rounded-none !bg-popover !p-0 !shadow-[0_24px_40px_-28px_oklch(0.25_0.02_155/0.28)] !ring-0 border-b border-border md:!absolute">
            <div className="shop-container grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_11rem] gap-x-10 py-9 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_10rem_minmax(0,1.15fr)]">
              <p className="eyebrow col-span-full mb-4 flex items-center gap-2.5">
                <MithilaFish />
                Shop by category
              </p>
              {columns.map((col, i) => (
                <ul key={i} className="min-w-0">
                  {col.map((category) => (
                    <li key={category.id} className="border-b border-border">
                      <NavigationMenuLink asChild>
                        <Link
                          href={`/categories/${category.slug}`}
                          className="group flex flex-row items-baseline justify-between gap-4 rounded-none px-0 py-2.5 hover:bg-transparent focus:bg-transparent"
                        >
                          <span className="font-heading text-xl leading-snug text-foreground transition-colors group-hover:text-primary">
                            {category.name}
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {countLabel(category.productCount)}
                          </span>
                        </Link>
                      </NavigationMenuLink>
                      {category.children.length > 0 && (
                        <ul className="-mt-1 flex flex-wrap gap-x-4 gap-y-1 pb-2.5">
                          {category.children.map((child) => (
                            <li key={child.id}>
                              <NavigationMenuLink asChild>
                                <Link
                                  href={`/categories/${child.slug}`}
                                  className="block rounded-sm p-0 text-sm text-muted-foreground hover:bg-transparent hover:text-foreground focus:bg-transparent"
                                >
                                  {child.name}
                                </Link>
                              </NavigationMenuLink>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              ))}
              <ul className="min-w-0 space-y-0.5">
                {COLLECTIONS.map((c) => (
                  <li key={c.href}>
                    <NavigationMenuLink asChild>
                      <Link
                        href={c.href}
                        className="block rounded-sm px-0 py-2 text-[15px] text-foreground/80 hover:bg-transparent hover:text-foreground hover:underline hover:underline-offset-4 focus:bg-transparent"
                      >
                        {c.title}
                      </Link>
                    </NavigationMenuLink>
                  </li>
                ))}
              </ul>
              {featured.length > 0 && (
                <div className="hidden grid-cols-2 gap-4 lg:grid">
                  {featured.map((c) => (
                    <NavigationMenuLink asChild key={c.id}>
                      <Link
                        href={`/categories/${c.slug}`}
                        className="group !flex !flex-col !items-stretch !gap-0 rounded-none p-0 hover:bg-transparent focus:bg-transparent"
                      >
                        <span className="block aspect-[4/5] w-full overflow-hidden bg-oat">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={cldUrl(c.image!, { w: 360, h: 450, crop: "fit" })}
                            alt=""
                            loading="lazy"
                            className="size-full object-contain mix-blend-multiply motion-safe:transition-transform motion-safe:duration-700 motion-safe:group-hover:scale-[1.03]"
                          />
                        </span>
                        <span className="mt-2 flex items-center gap-1 text-sm text-foreground">
                          Shop {c.name}
                          <ArrowRight className="size-3.5 opacity-60" aria-hidden />
                        </span>
                      </Link>
                    </NavigationMenuLink>
                  ))}
                </div>
              )}
            </div>
          </NavigationMenuContent>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  );
}

/** Category photo (white cut-outs sit on the page ground via multiply), or the
 *  category's initial on oat when it has none — never an invented picture. */
export function CategoryThumb({
  name,
  image,
  className,
}: {
  name: string;
  image?: string | null;
  className?: string;
}) {
  return (
    <span className={cn("grid size-11 shrink-0 place-items-center overflow-hidden", !image && "bg-oat", className)}>
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={cldUrl(image, { w: 96, h: 96, crop: "fit" })}
          alt=""
          loading="lazy"
          className="size-full object-contain mix-blend-multiply"
        />
      ) : (
        <span aria-hidden className="font-heading text-lg text-oat-foreground">
          {name.charAt(0)}
        </span>
      )}
    </span>
  );
}
