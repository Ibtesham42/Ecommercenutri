"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";

export type CategoryNavNode = {
  id: string;
  name: string;
  slug: string;
  children: { id: string; name: string; slug: string }[];
};

/** Desktop-only hover/focus flyout listing every top-level category as a
 *  column with its subcategories underneath — the department-discovery
 *  pattern a flat nav link can't provide. Renders nothing if the catalog has
 *  no active categories yet (keyless/empty-DB safe). */
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
              "rounded-md border-b-2 border-transparent bg-transparent px-2.5 py-1.5 text-sm font-medium tracking-[-0.01em] transition-colors",
              active ? "border-primary font-semibold text-primary" : "text-foreground/70",
            )}
          >
            Categories
          </NavigationMenuTrigger>
          <NavigationMenuContent>
            <div className="w-[min(90vw,48rem)] p-5">
              <div className="grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
                {categories.map((category) => (
                  <div key={category.id} className="min-w-0">
                    <Link
                      href={`/categories/${category.slug}`}
                      className="font-heading text-[15px] font-semibold text-foreground hover:text-primary"
                    >
                      {category.name}
                    </Link>
                    {category.children.length > 0 && (
                      <ul className="mt-2 space-y-1.5">
                        {category.children.map((child) => (
                          <li key={child.id}>
                            <Link
                              href={`/categories/${child.slug}`}
                              className="text-sm text-muted-foreground hover:text-primary"
                            >
                              {child.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-4 border-t border-border/60 pt-3">
                <Link
                  href="/categories"
                  className="text-sm font-semibold text-primary hover:underline"
                >
                  View all categories →
                </Link>
              </div>
            </div>
          </NavigationMenuContent>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  );
}
