"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, TrendingUp, Star } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cldUrl } from "@/lib/cld";
import { cn } from "@/lib/utils";
import { POPULAR_SEARCHES } from "@/lib/search-defaults";

type Suggestion = {
  id: string;
  name: string;
  slug: string;
  category: string;
  image: string | null;
  price: string;
  rating?: number;
  ratingCount?: number;
};

export function SearchBox({
  autoFocus,
  onNavigate,
}: {
  autoFocus?: boolean;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);

  // Seed from the current URL's ?q= on mount (client-only; avoids a static-render
  // deopt that useSearchParams would force on the layout-mounted header).
  useEffect(() => {
    const initial = new URLSearchParams(window.location.search).get("q");
    if (initial) setQ(initial);
  }, []);

  // Debounced suggestion fetch.
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search/suggestions?q=${encodeURIComponent(term)}`, {
          signal: ctrl.signal,
        });
        const data = (await res.json()) as { suggestions: Suggestion[] };
        setItems(data.suggestions);
      } catch {
        /* aborted or failed — ignore */
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  // Close on outside click.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function goSearch(term: string) {
    setOpen(false);
    onNavigate?.();
    router.push(term ? `/search?q=${encodeURIComponent(term)}` : "/search");
  }

  function goProduct(s: Suggestion) {
    setOpen(false);
    onNavigate?.();
    router.push(`/products/${s.slug}`);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open || items.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h - 1 + items.length) % items.length);
    } else if (e.key === "Enter" && highlight >= 0) {
      e.preventDefault();
      goProduct(items[highlight]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const showDropdown = open && q.trim().length >= 2;
  const showPopular = open && q.trim().length < 2;

  return (
    <div ref={rootRef} className="relative w-full">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          goSearch(q.trim());
        }}
        role="search"
      >
        <Search className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            setHighlight(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search for makhana, almonds, protein…"
          className="h-12 rounded-full border-input bg-background pl-11 pr-11 text-foreground shadow-elev-1 transition-[box-shadow,border-color] placeholder:text-muted-foreground/80 focus-visible:border-primary/40 focus-visible:shadow-elev-2 focus-visible:ring-4 focus-visible:ring-primary/15"
          autoFocus={autoFocus}
          aria-label="Search products"
          aria-expanded={showDropdown}
          aria-controls="search-suggestions"
          role="combobox"
          autoComplete="off"
        />
        {loading && (
          <Loader2 className="absolute right-4 top-1/2 size-[18px] -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </form>

      {showPopular && (
        <div className="absolute z-50 mt-2.5 w-full overflow-hidden rounded-2xl border bg-popover p-4 shadow-elev-3">
          <p className="mb-3 flex items-center gap-1.5 px-0.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <TrendingUp className="size-3.5 text-primary" /> Popular searches
          </p>
          <div className="flex flex-wrap gap-2">
            {POPULAR_SEARCHES.map((term) => (
              <button
                key={term}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => goSearch(term)}
                className="rounded-full border bg-background px-3.5 py-2 text-xs font-medium transition-colors hover:border-primary/40 hover:bg-accent/60 hover:text-primary"
              >
                {term}
              </button>
            ))}
          </div>
        </div>
      )}

      {showDropdown && (
        <div
          id="search-suggestions"
          role="listbox"
          className="absolute z-50 mt-2.5 w-full overflow-hidden rounded-2xl border bg-popover shadow-elev-3"
        >
          {items.length > 0 ? (
            <ul className="max-h-[70vh] overflow-y-auto p-2">
              {items.map((s, i) => (
                <li key={s.id} role="option" aria-selected={i === highlight}>
                  <button
                    type="button"
                    onClick={() => goProduct(s)}
                    onMouseEnter={() => setHighlight(i)}
                    className={cn(
                      "flex w-full items-center gap-3.5 rounded-xl px-3 py-2.5 text-left transition-colors",
                      i === highlight ? "bg-accent" : "hover:bg-accent/60",
                    )}
                  >
                    <span className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-accent/40">
                      {s.image && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={cldUrl(s.image, { w: 96, h: 96, crop: "fill" })}
                          alt=""
                          className="size-full object-cover"
                        />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{s.name}</span>
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="truncate">{s.category}</span>
                        {typeof s.rating === "number" && (s.ratingCount ?? 0) > 0 && (
                          <span className="flex shrink-0 items-center gap-0.5">
                            <Star className="size-3 fill-amber-400 text-amber-400" />
                            {s.rating.toFixed(1)}
                          </span>
                        )}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold">{s.price}</span>
                  </button>
                </li>
              ))}
              <li className="mt-1 border-t pt-1">
                <button
                  type="button"
                  onClick={() => goSearch(q.trim())}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-3 text-left text-sm font-medium text-primary transition-colors hover:bg-accent/60"
                >
                  <TrendingUp className="size-4" />
                  See all results for “{q.trim()}”
                </button>
              </li>
            </ul>
          ) : !loading ? (
            <p className="px-4 py-5 text-sm text-muted-foreground">
              No matches. Press Enter to search anyway.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
