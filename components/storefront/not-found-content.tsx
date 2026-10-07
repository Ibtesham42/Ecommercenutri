import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

const POPULAR = [
  { label: "Categories", href: "/categories" },
  { label: "Best sellers", href: "/products?sort=best-sellers" },
  { label: "Offers", href: "/offers" },
  { label: "Track order", href: "/track" },
] as const;

/**
 * Shared 404 body for both not-found boundaries — the storefront one (inside
 * header/footer, for a missing product/category/post) and the root one (bare
 * unmatched URLs, which Next renders outside every route group). Same bare
 * icon + gold hairline language as EmptyState and the error boundaries.
 */
export function NotFoundContent() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center text-center">
      <SearchX className="size-9 text-muted-foreground/70" strokeWidth={1.5} aria-hidden />
      <span className="mt-4 block h-0.5 w-9 rounded-full bg-gold" />
      <h1 className="mt-4 font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
        We couldn&apos;t find that page
      </h1>
      <p className="mt-2 text-sm text-muted-foreground sm:text-base">
        The link may be old, or the product may have moved. Everything else is right
        where you left it.
      </p>
      <div className="mt-6 flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
        <Button asChild className="h-11 rounded-xl px-6 font-semibold">
          <Link href="/products">Shop all products</Link>
        </Button>
        <Button asChild variant="outline" className="h-11 rounded-xl px-6 font-semibold">
          <Link href="/">Back home</Link>
        </Button>
      </div>
      <nav aria-label="Popular pages" className="mt-8 text-sm text-muted-foreground">
        <span>Popular: </span>
        {POPULAR.map((p, i) => (
          <span key={p.href}>
            {i > 0 && <span aria-hidden> · </span>}
            <Link
              href={p.href}
              className="font-medium text-foreground underline-offset-4 hover:text-primary hover:underline"
            >
              {p.label}
            </Link>
          </span>
        ))}
      </nav>
    </div>
  );
}
