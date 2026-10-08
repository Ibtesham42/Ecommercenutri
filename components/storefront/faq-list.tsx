import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export type FaqItem = { q: string; a: React.ReactNode };

/**
 * Question/answer list on native <details>: answers stay in the server HTML
 * (Radix accordions unmount closed panels) and it works without JS.
 */
export function FaqList({ items, className }: { items: FaqItem[]; className?: string }) {
  return (
    <div className={cn("divide-y divide-border border-y border-border", className)}>
      {items.map((item) => (
        <details key={item.q} className="group">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 text-[15px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
            {item.q}
            <Plus
              aria-hidden
              className="size-4 shrink-0 text-foreground/60 transition-transform duration-200 group-open:rotate-45 motion-reduce:transition-none"
            />
          </summary>
          <div className="pb-5 pr-8 text-[15px] leading-relaxed text-foreground/80 [&_a]:font-medium [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-4">
            {item.a}
          </div>
        </details>
      ))}
    </div>
  );
}
