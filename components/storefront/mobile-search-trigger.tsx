"use client";

import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Search, Mic } from "lucide-react";

// The overlay chunk loads only on first use — zero cost for visitors who
// never open search.
const SearchOverlay = dynamic(
  () => import("./search-overlay").then((m) => m.SearchOverlay),
  { ssr: false },
);

/**
 * Mobile search entry point: a button styled like the header search input that
 * opens the full-screen SearchOverlay. Replaces the inline SearchBox in the
 * header's mobile row only (desktop keeps SearchBox untouched). Hydration-safe
 * for the layout-mounted header: no window reads at render, no useSearchParams.
 */
export function MobileSearchTrigger() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open search"
        aria-haspopup="dialog"
        className="relative flex h-12 w-full items-center rounded-full border border-input bg-background pl-11 pr-11 text-left shadow-elev-1 transition-[box-shadow,border-color] hover:border-primary/40 hover:shadow-elev-2"
      >
        <Search className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-muted-foreground" />
        <span className="truncate text-base text-muted-foreground/80">
          Search for makhana, almonds, protein…
        </span>
        <Mic className="pointer-events-none absolute right-4 top-1/2 size-[18px] -translate-y-1/2 text-muted-foreground/70" />
      </button>

      {open && (
        <SearchOverlay
          onClose={() => {
            setOpen(false);
            triggerRef.current?.focus();
          }}
        />
      )}
    </>
  );
}
