import { List } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TocHeading } from "@/lib/toc";

/**
 * On-this-page contents for long articles. Plain anchor links (no JS needed);
 * h3s are indented under their section. Rendered only when the caller decides
 * there are enough headings to be worth it.
 */
export function TableOfContents({ headings }: { headings: TocHeading[] }) {
  return (
    <nav
      aria-label="On this page"
      className="my-8 rounded-2xl border bg-card/60 p-5 shadow-elev-1"
    >
      <p className="flex items-center gap-2 text-sm font-semibold">
        <List className="size-4 text-primary" aria-hidden /> On this page
      </p>
      <ul className="mt-3 space-y-1.5 text-sm">
        {headings.map((h) => (
          <li key={h.id} className={cn(h.level === 3 && "ml-4")}>
            <a
              href={`#${h.id}`}
              className="text-muted-foreground transition-colors hover:text-primary"
            >
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
