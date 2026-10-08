import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageBreadcrumb, type Crumb } from "@/components/storefront/page-breadcrumb";
import { CatalogFilters, type CategoryOption } from "@/components/storefront/catalog-filters";
import { MobileFilters } from "@/components/storefront/mobile-filters";
import { SortSelect } from "@/components/storefront/sort-select";
import { PaginationBar } from "@/components/storefront/pagination-bar";
import { ActiveFilterChips } from "@/components/storefront/catalog/active-filter-chips";
import {
  CatalogLink,
  CatalogResults,
  CatalogStatus,
  CatalogTransitionProvider,
} from "@/components/storefront/catalog/catalog-transition";
import {
  CATALOG_PAGE_SIZE,
  activeFilters,
  clearFiltersHref,
  resultRange,
  type CatalogQuery,
  type CatalogSupports,
} from "@/lib/catalog-params";

/** Message for an empty result set when no filter is responsible. */
export type CatalogEmptyCopy = {
  title: string;
  description: string;
  action?: { label: string; href: string };
};

/**
 * The shared catalog page: breadcrumb → header → [sidebar | toolbar, chips,
 * results, pagination]. Routes own their data fetching, header and JSON-LD;
 * this owns layout, filter UI and the transition. Pass the products grid as
 * `children` (rendered only when `total > 0`).
 */
export function CatalogShell({
  pathname,
  query,
  supports,
  categories,
  breadcrumb,
  beforeHeader,
  header,
  total,
  page,
  pageCount,
  perPage = CATALOG_PAGE_SIZE,
  relevanceSort = false,
  empty,
  emptyExtra,
  children,
}: {
  pathname: string;
  query: CatalogQuery;
  supports: CatalogSupports;
  /** Category filter options (routes that filter by `?category=`). */
  categories?: CategoryOption[];
  breadcrumb: Crumb[];
  beforeHeader?: React.ReactNode;
  header: React.ReactNode;
  total: number;
  page: number;
  pageCount: number;
  perPage?: number;
  /** Search: no `sort` param means relevance order. */
  relevanceSort?: boolean;
  empty: CatalogEmptyCopy;
  /** Fallback content under the empty state (existing "you might like" rails). */
  emptyExtra?: React.ReactNode;
  children: React.ReactNode;
}) {
  const categoryNames = Object.fromEntries((categories ?? []).map((c) => [c.slug, c.name]));
  const filters = activeFilters(pathname, query, supports, categoryNames);
  const clearHref = clearFiltersHref(pathname, query);
  const { from, to } = resultRange(page, perPage, total);
  const range =
    total === 0
      ? "No products"
      : total === 1
        ? "Showing 1 product"
        : pageCount === 1
          ? `Showing all ${total} products`
          : `Showing ${from}–${to} of ${total}`;

  const panel = (
    <CatalogFilters pathname={pathname} query={query} supports={supports} categories={categories} />
  );

  return (
    <div className="shop-container pt-5 pb-16 sm:pt-7 lg:pb-24">
      <PageBreadcrumb items={breadcrumb} />
      {beforeHeader}
      <div className="mt-5 sm:mt-8">{header}</div>

      <CatalogTransitionProvider>
        <div className="mt-6 sm:mt-8 lg:mt-12 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-10 xl:gap-14">
          <aside aria-labelledby="catalog-filters-heading" className="hidden lg:block">
            <div className="mb-5 flex min-h-10 items-center justify-between border-b border-border pb-4">
              <h2 id="catalog-filters-heading" className="font-heading text-lg font-medium">
                Filters
              </h2>
              {filters.length > 0 && (
                <CatalogLink
                  href={clearHref}
                  className="rounded-sm text-[13px] text-muted-foreground underline underline-offset-4 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Clear all
                </CatalogLink>
              )}
            </div>
            {panel}
          </aside>

          <div className="min-w-0">
            {/* Sticky under the 56px mobile header; a plain row once the sidebar shows. */}
            <div className="sticky top-[calc(3.5rem+1px)] z-30 -mx-4 flex items-center gap-3 border-b border-border bg-background px-4 py-2.5 sm:-mx-6 sm:px-6 lg:static lg:z-auto lg:mx-0 lg:min-h-10 lg:bg-transparent lg:px-0 lg:pt-0 lg:pb-4">
              <MobileFilters activeCount={filters.length} total={total} clearHref={clearHref}>
                {panel}
              </MobileFilters>
              <CatalogStatus className="hidden text-sm text-muted-foreground tabular-nums sm:block">{range}</CatalogStatus>
              <div className="ml-auto">
                <SortSelect relevanceDefault={relevanceSort} />
              </div>
            </div>
            <CatalogStatus className="mt-3 text-sm text-muted-foreground tabular-nums sm:hidden">{range}</CatalogStatus>

            {/* With no results the empty panel carries the chips instead. */}
            {total > 0 && <ActiveFilterChips filters={filters} clearHref={clearHref} className="mt-4" />}

            <h2 className="sr-only">Products</h2>
            <CatalogResults page={page}>
              <div className="mt-4 sm:mt-6">
                {total > 0 ? (
                  children
                ) : filters.length > 0 ? (
                  <EmptyPanel
                    title="No products match these filters"
                    description={
                      query.q
                        ? `Nothing for “${query.q}” with the filters below. Remove one, or clear them all.`
                        : "Remove a filter below, or clear them all to see everything again."
                    }
                  >
                    <ActiveFilterChips filters={filters} clearHref={clearHref} className="mt-5 justify-center" />
                  </EmptyPanel>
                ) : (
                  <EmptyPanel title={empty.title} description={empty.description}>
                    {empty.action && (
                      <Button asChild className="mt-6 h-11 rounded-lg px-6">
                        <Link href={empty.action.href}>{empty.action.label}</Link>
                      </Button>
                    )}
                  </EmptyPanel>
                )}
                {total === 0 && emptyExtra}
              </div>
              <PaginationBar page={page} pageCount={pageCount} />
            </CatalogResults>
          </div>
        </div>
      </CatalogTransitionProvider>
    </div>
  );
}

function EmptyPanel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-oat px-6 py-12 text-center sm:py-16">
      <h2 className="font-heading text-subheading text-foreground">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground sm:text-[15px]">{description}</p>
      {children}
    </div>
  );
}
