import { cn } from "@/lib/utils";
import type { TocHeading } from "@/lib/toc";

/**
 * On-this-page contents for long articles and policies. Plain anchor links (no
 * JS needed); h3s are indented under their section. Rendered only when the
 * caller decides there are enough headings to be worth it.
 *  - card: inline block in the reading column (articles; policies below lg);
 *  - rail: quiet list for the sticky side rail of `ReadingLayout`.
 */
export function TableOfContents({
  headings,
  variant = "card",
  className,
}: {
  headings: TocHeading[];
  variant?: "card" | "rail";
  className?: string;
}) {
  const rail = variant === "rail";
  return (
    <nav
      aria-label="On this page"
      className={cn(rail ? "border-l border-border pl-5" : "rounded-xl bg-oat px-5 py-4 text-oat-foreground", className)}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        On this page
      </p>
      <ul className={cn("mt-3 text-sm", rail ? "space-y-1" : "space-y-0.5")}>
        {headings.map((h) => (
          <li key={h.id} className={cn(h.level === 3 && "ml-3")}>
            <a
              href={`#${h.id}`}
              className={cn(
                "-mx-1 flex items-center rounded px-1 leading-snug text-foreground/75 outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
                rail ? "py-1.5" : "min-h-11 py-2",
              )}
            >
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
