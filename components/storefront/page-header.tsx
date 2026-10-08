import { PageBreadcrumb, type Crumb } from "@/components/storefront/page-breadcrumb";
import { cn } from "@/lib/utils";

/** Outer frame for storefront content pages: aligned with the shop grid. */
export const CONTENT_PAGE_CLASS = "shop-container pt-6 pb-20 sm:pt-8 lg:pb-28";

/**
 * Editorial header shared by the content pages (about, journal, FAQ, legal,
 * contact…): breadcrumb, eyebrow, display title and an optional lede, set
 * left on the shop container so every page title starts on the same line.
 */
export function PageHeader({
  crumbs,
  eyebrow,
  title,
  lede,
  className,
  children,
}: {
  crumbs?: Crumb[];
  eyebrow?: string;
  title: React.ReactNode;
  lede?: React.ReactNode;
  className?: string;
  /** Extra content under the lede (meta line, actions…). */
  children?: React.ReactNode;
}) {
  return (
    <header className={cn("max-w-3xl", className)}>
      {crumbs && <PageBreadcrumb items={crumbs} />}
      {eyebrow && <p className={cn("eyebrow", crumbs && "mt-6 sm:mt-8")}>{eyebrow}</p>}
      {/* No cn() here: tailwind-merge reads the custom `text-title` size and
          `text-foreground` colour as one conflicting group and drops the size. */}
      <h1
        className={`font-heading text-title text-foreground [overflow-wrap:anywhere] ${
          eyebrow ? "mt-2 sm:mt-3" : crumbs ? "mt-6 sm:mt-8" : ""
        }`}
      >
        {title}
      </h1>
      {lede && (
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted-foreground sm:mt-4 sm:text-lg">
          {lede}
        </p>
      )}
      {children}
    </header>
  );
}

/**
 * Body of a long-read page: one comfortable reading column, plus an optional
 * sticky side rail (e.g. "On this page") from lg that fills the right side.
 */
export function ReadingLayout({
  rail,
  className,
  children,
}: {
  rail?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  if (!rail) return <div className={cn("mt-10 max-w-3xl sm:mt-12", className)}>{children}</div>;
  return (
    <div
      className={cn(
        "mt-10 grid gap-10 sm:mt-12 lg:grid-cols-[minmax(0,48rem)_minmax(0,15rem)] lg:justify-between lg:gap-16",
        className,
      )}
    >
      <div className="min-w-0">{children}</div>
      <aside className="max-lg:hidden">
        <div className="sticky top-28">{rail}</div>
      </aside>
    </div>
  );
}
