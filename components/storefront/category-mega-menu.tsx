"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { cldUrl } from "@/lib/cld";
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
  children: { id: string; name: string; slug: string }[];
};

/** Collection shortcuts that used to sit in the old two-row nav — kept one
 *  hover away instead of crowding the single primary row. Existing routes only. */
const COLLECTIONS = [
  { title: "All products", href: "/products" },
  { title: "Best sellers", href: "/products?sort=best-sellers" },
  { title: "New arrivals", href: "/new-arrivals" },
  { title: "Offers", href: "/offers" },
] as const;

/** Shared look for the single primary nav row (header links + this trigger):
 *  plain text, a hairline underline that draws in on hover / sits under the
 *  active section. No pills, no fills. */
export const navLinkClass = (active: boolean) =>
  cn(
    "relative inline-flex h-10 items-center text-[15px] font-medium transition-colors",
    "after:absolute after:inset-x-0 after:bottom-1.5 after:h-px after:origin-left after:bg-current after:transition-transform",
    active
      ? "text-foreground after:scale-x-100"
      : "text-foreground/75 after:scale-x-0 hover:text-foreground hover:after:scale-x-100",
  );

/**
 * Desktop "Categories" flyout: a quiet collections column beside an image-led
 * grid of the real catalog categories (photo when the category has one, its
 * initial on oat when it doesn't — never an invented picture). Radix
 * NavigationMenu provides hover/focus opening, arrow-key movement and Escape.
 * Renders nothing if the catalog has no active categories (keyless-safe).
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

  return (
    <NavigationMenu viewport={false} className={cn("max-w-none", className)}>
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuTrigger
            className={cn(
              navLinkClass(active),
              "gap-1 rounded-none bg-transparent px-0 py-0 hover:bg-transparent focus:bg-transparent data-[state=open]:bg-transparent data-[state=open]:text-foreground data-[state=open]:hover:bg-transparent data-[state=open]:focus:bg-transparent",
            )}
          >
            Categories
          </NavigationMenuTrigger>
          <NavigationMenuContent className="!overflow-hidden !rounded-xl !border-border !p-0 !shadow-elev-3">
            <div className="grid w-[min(92vw,54rem)] grid-cols-[11rem_1fr] bg-popover">
              <div className="border-r border-border bg-oat/60 px-6 py-6">
                <p className="eyebrow">Shop</p>
                <ul className="mt-4 space-y-3">
                  {COLLECTIONS.map((c) => (
                    <li key={c.href}>
                      <NavigationMenuLink asChild>
                        <Link
                          href={c.href}
                          className="block rounded-sm p-0 text-[15px] text-foreground/80 transition-colors hover:bg-transparent hover:text-foreground focus:bg-transparent"
                        >
                          {c.title}
                        </Link>
                      </NavigationMenuLink>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="px-7 py-6">
                <div className="flex items-baseline justify-between">
                  <p className="eyebrow">Categories</p>
                  <NavigationMenuLink asChild>
                    <Link
                      href="/categories"
                      className="inline-flex flex-row items-center gap-1 rounded-sm p-0 text-sm font-medium text-primary hover:bg-transparent hover:underline focus:bg-transparent"
                    >
                      View all <ArrowRight className="size-3.5" />
                    </Link>
                  </NavigationMenuLink>
                </div>
                <ul className="mt-5 grid grid-cols-3 gap-x-6 gap-y-6">
                  {categories.map((category) => (
                    <li key={category.id} className="min-w-0">
                      <NavigationMenuLink asChild>
                        <Link
                          href={`/categories/${category.slug}`}
                          className="group flex flex-row items-center gap-3 rounded-sm p-0 hover:bg-transparent focus:bg-transparent"
                        >
                          <CategoryThumb name={category.name} image={category.image} />
                          <span className="min-w-0 font-heading text-base font-medium leading-snug text-foreground group-hover:text-primary">
                            {category.name}
                          </span>
                        </Link>
                      </NavigationMenuLink>
                      {category.children.length > 0 && (
                        <ul className="mt-2 space-y-1 pl-[3.75rem]">
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
              </div>
            </div>
          </NavigationMenuContent>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  );
}

/** Round category photo, or the category's initial on oat when it has none. */
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
    <span
      className={cn(
        "grid size-12 shrink-0 place-items-center overflow-hidden rounded-full bg-oat ring-1 ring-border",
        className,
      )}
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={cldUrl(image, { w: 96, h: 96, crop: "fill" })}
          alt=""
          loading="eager"
          className="size-full object-cover"
        />
      ) : (
        <span aria-hidden className="font-heading text-lg text-oat-foreground">
          {name.charAt(0)}
        </span>
      )}
    </span>
  );
}
