"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * One footer link group. Below md it's a collapsed accordion row (so phones
 * don't scroll past four stacked columns); from md up the toggle disappears
 * and the group is a plain always-open column. The links are rendered once —
 * hidden, never duplicated — so crawlers and the md+ layout see the same DOM.
 */
export function FooterSection({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div className={cn("max-md:border-b max-md:border-white/10", className)}>
      <h3 className="text-[15px] font-semibold text-surface-deep-foreground">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={panelId}
          className="flex w-full items-center justify-between py-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-gold/50 md:hidden"
        >
          {title}
          <ChevronDown
            aria-hidden
            className={cn(
              "size-[18px] text-surface-deep-foreground/60 motion-safe:transition-transform motion-safe:duration-200",
              open && "rotate-180",
            )}
          />
        </button>
        <span className="max-md:hidden">{title}</span>
      </h3>
      <div id={panelId} className={cn("md:mt-4 md:block", open ? "pb-5" : "max-md:hidden")}>
        {children}
      </div>
    </div>
  );
}
