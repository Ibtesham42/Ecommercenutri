"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, TrendingUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cldUrl } from "@/lib/cld";
import { cn } from "@/lib/utils";

type Suggestion = {
  id: string;
  name: string;
  slug: string;
  category: string;
  image: string | null;
  price: string;
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

  return (
    <div ref={rootRef} className="relative w-full">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          goSearch(q.trim());
        }}
        role="search"
      >
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
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
          className="h-11 pl-9 pr-9"
          autoFocus={autoFocus}
          aria-label="Search products"
          aria-expanded={showDropdown}
          aria-controls="search-suggestions"
          role="combobox"
          autoComplete="off"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </form>

      {showDropdown && (
        <div
          id="search-suggestions"
          role="listbox"
          className="absolute z-50 mt-2 w-full overflow-hidden rounded-xl border bg-popover shadow-elev-3"
        >
          {items.length > 0 ? (
            <ul className="max-h-[70vh] overflow-y-auto py-1">
              {items.map((s, i) => (
                <li key={s.id} role="option" aria-selected={i === highlight}>
                  <button
                    type="button"
                    onClick={() => goProduct(s)}
                    onMouseEnter={() => setHighlight(i)}
                    className={cn(
                      "flex w-full items-center gap-3 px-3 py-2 text-left transition-colors",
                      i === highlight ? "bg-accent" : "hover:bg-accent/60",
                    )}
                  >
                    <span className="relative size-10 shrink-0 overflow-hidden rounded-md bg-accent/40">
                      {s.image && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={cldUrl(s.image, { w: 80, h: 80, crop: "fill" })}
                          alt=""
                          className="size-full object-cover"
                        />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{s.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{s.category}</span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold">{s.price}</span>
                  </button>
                </li>
              ))}
              <li className="border-t">
                <button
                  type="button"
                  onClick={() => goSearch(q.trim())}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-primary hover:bg-accent/60"
                >
                  <TrendingUp className="size-4" />
                  See all results for “{q.trim()}”
                </button>
              </li>
            </ul>
          ) : !loading ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">
              No matches. Press Enter to search anyway.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
