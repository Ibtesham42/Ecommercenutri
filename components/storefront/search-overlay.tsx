"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Search,
  X,
  Mic,
  Clock,
  TrendingUp,
  Sparkles,
  Tag,
  Star,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { cldUrl } from "@/lib/cld";
import { cn } from "@/lib/utils";
import { trackClient } from "@/components/storefront/behavior-tracker";
import {
  getRecentSearches,
  addRecentSearch,
  removeRecentSearch,
  clearRecentSearches,
} from "@/lib/recent-searches";
import {
  getMyRecentSearches,
  saveMyRecentSearch,
  removeMyRecentSearch,
  clearMyRecentSearches,
} from "@/lib/actions/search";

/**
 * Full-screen mobile search overlay (Amazon/Myntra-style). Pure UI over the
 * existing search stack: instant results come from /api/search/suggestions,
 * discovery data from /api/search/overlay, submits land on the unchanged
 * /search page. Mounted lazily by MobileSearchTrigger (below lg only).
 *
 * IMPORTANT: the overlay is DOM-nested inside the dark site header, whose
 * `text-surface-deep-foreground` cascades through `position: fixed` — the root
 * therefore sets `text-foreground` explicitly so nothing inherits near-white
 * text onto the light background.
 */

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

type OverlayData = {
  trending: string[];
  popular: { id: string; name: string; slug: string; image: string | null; price: string; rating: number; ratingCount: number }[];
  categories: { name: string; slug: string }[];
};

// Fetched once per session — the overlay opens instantly on later taps.
let overlayCache: OverlayData | null = null;
let overlayFetch: Promise<void> | null = null;

/** Prewarm the discovery data (called from the trigger while idle). */
export function preloadOverlayData(): void {
  if (overlayCache || overlayFetch) return;
  overlayFetch = fetch("/api/search/overlay")
    .then((r) => r.json())
    .then((d: OverlayData) => {
      overlayCache = d;
    })
    .catch(() => {})
    .finally(() => {
      overlayFetch = null;
    });
}

// Minimal Web Speech API surface (not in the DOM lib types).
type SpeechResultEvent = {
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
};
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  start: () => void;
  abort: () => void;
  onresult: ((e: SpeechResultEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
};

function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const CLOSE_MS = 170;

const SECTION_TITLE =
  "mb-2.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground";
const CHIP =
  "shrink-0 touch-manipulation select-none rounded-full border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary motion-safe:transition-transform motion-safe:active:scale-95";
const ROW =
  "flex w-full touch-manipulation items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-accent/60 active:bg-accent";

function ProductRow({ p, onTap }: { p: Suggestion | OverlayData["popular"][number]; onTap: () => void }) {
  const rating = "rating" in p ? p.rating : undefined;
  const ratingCount = "ratingCount" in p ? p.ratingCount : undefined;
  return (
    <button type="button" onClick={onTap} className={ROW}>
      <span className="relative size-14 shrink-0 overflow-hidden rounded-xl border border-border/50 bg-accent/40">
        {p.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cldUrl(p.image, { w: 112, h: 112, crop: "fill" })}
            alt=""
            loading="lazy"
            className="size-full object-cover"
          />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium text-foreground">{p.name}</span>
        <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          {"category" in p && p.category ? <span className="truncate">{p.category}</span> : null}
          {typeof rating === "number" && (ratingCount ?? 0) > 0 && (
            <span className="flex shrink-0 items-center gap-0.5">
              <Star className="size-3 fill-amber-400 text-amber-400" />
              {rating.toFixed(1)} ({ratingCount})
            </span>
          )}
        </span>
      </span>
      <span className="shrink-0 text-[15px] font-semibold text-foreground">{p.price}</span>
    </button>
  );
}

export function SearchOverlay({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [catMatches, setCatMatches] = useState<{ name: string; slug: string }[]>([]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [data, setData] = useState<OverlayData | null>(overlayCache);
  const [recents, setRecents] = useState<string[]>([]);
  const [listening, setListening] = useState(false);
  const [closing, setClosing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const closedByPop = useRef(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const term = q.trim();
  const searched = term.length >= 2;
  const hasResults = items.length > 0 || catMatches.length > 0 || keywords.length > 0;

  /** Animated close for user-initiated dismissal (X / Escape / back). */
  const close = useCallback(() => {
    if (closeTimer.current) return; // already closing
    setClosing(true);
    closeTimer.current = setTimeout(onClose, CLOSE_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- lifecycle: scroll lock, Escape, voice cleanup ---
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      recognitionRef.current?.abort();
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Android hardware/gesture back closes the overlay instead of leaving the page.
  useEffect(() => {
    window.history.pushState({ nutriyetSearchOverlay: true }, "");
    const onPop = () => {
      closedByPop.current = true;
      close();
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      // Pop our sentinel entry unless back itself (or a navigation) closed us.
      if (!closedByPop.current) window.history.back();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Recents: prefer the signed-in account copy; guests use localStorage.
    setRecents(getRecentSearches());
    getMyRecentSearches()
      .then((server) => {
        if (server !== null) setRecents(server);
      })
      .catch(() => {});
    // Discovery data (usually prewarmed by the trigger).
    if (overlayCache) setData(overlayCache);
    else {
      preloadOverlayData();
      const t = setInterval(() => {
        if (overlayCache) {
          setData(overlayCache);
          clearInterval(t);
        }
      }, 100);
      return () => clearInterval(t);
    }
  }, []);

  // --- instant results (debounce + abort; previous results stay visible while
  // the next request runs, so typing never flickers) ---
  useEffect(() => {
    if (!searched) {
      setItems([]);
      setCatMatches([]);
      setKeywords([]);
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
        const d = (await res.json()) as {
          suggestions: Suggestion[];
          categories?: { name: string; slug: string }[];
          keywords?: string[];
        };
        setItems(d.suggestions);
        setCatMatches(d.categories ?? []);
        setKeywords(d.keywords ?? []);
      } catch {
        /* aborted or failed */
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [term, searched]);

  // Lightweight focus trap — Tab cycles within the overlay.
  function onTrapKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "Tab" || !containerRef.current) return;
    const focusables = containerRef.current.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled])',
    );
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  // --- recents (dual-write: localStorage always, account when signed in) ---
  const saveRecent = useCallback((t: string) => {
    setRecents(addRecentSearch(t));
    void saveMyRecentSearch(t);
  }, []);

  function deleteRecent(t: string) {
    setRecents(removeRecentSearch(t));
    void removeMyRecentSearch(t);
  }

  function clearAllRecents() {
    clearRecentSearches();
    setRecents([]);
    void clearMyRecentSearches();
  }

  // --- navigation (skip the history-sentinel pop; the page is changing) ---
  function navigate(href: string) {
    closedByPop.current = true;
    onClose();
    router.push(href);
  }

  function goSearch(t: string) {
    const query = t.trim();
    if (!query) return;
    saveRecent(query);
    navigate(`/search?q=${encodeURIComponent(query)}`);
  }

  function goProduct(slug: string) {
    // Direct result taps never reach /search, so record the query here (the
    // /search page tracks its own visits — tracking submits too would double-count).
    if (searched) {
      saveRecent(term);
      trackClient({ type: "SEARCH", query: term });
    }
    navigate(`/products/${slug}`);
  }

  function goCategory(slug: string) {
    if (searched) trackClient({ type: "SEARCH", query: term });
    navigate(`/categories/${slug}`);
  }

  // --- voice search ---
  function startVoice() {
    const SR = getSpeechRecognition();
    if (!SR) {
      toast.info("Voice search isn't supported in this browser", {
        description: "Try Chrome on Android or desktop — or just type your search.",
      });
      return;
    }
    if (listening) {
      recognitionRef.current?.abort();
      setListening(false);
      return;
    }
    const rec = new SR();
    recognitionRef.current = rec;
    rec.lang = "en-IN";
    rec.continuous = false;
    // Live transcript while speaking — feels immediate, flows straight into
    // the instant search as words land.
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      let transcript = "";
      for (let i = 0; i < e.results.length; i++) transcript += e.results[i][0]?.transcript ?? "";
      if (transcript) setQ(transcript);
    };
    rec.onend = () => setListening(false);
    rec.onerror = (e) => {
      setListening(false);
      if (e?.error === "not-allowed" || e?.error === "service-not-allowed") {
        toast.error("Microphone access is blocked", {
          description: "Allow microphone permission for this site to use voice search.",
        });
      } else if (e?.error === "no-speech") {
        toast.info("Didn't catch that — tap the mic and try again.");
      } else if (e?.error && e.error !== "aborted") {
        toast.error("Voice search failed. Please try again.");
      }
    };
    try {
      setListening(true);
      rec.start();
    } catch {
      setListening(false);
      toast.error("Voice search could not start. Please try again.");
    }
  }

  const showIdle = !searched;
  const showSkeleton = searched && loading && !hasResults;
  const showResults = searched && hasResults;
  const showNoResults = searched && !loading && !hasResults;

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label="Search"
      onKeyDown={onTrapKeyDown}
      className={cn(
        // `text-foreground` is load-bearing: without it the dark header's
        // near-white text color cascades into the overlay (white-on-white).
        "fixed inset-0 z-[70] flex flex-col bg-background text-foreground",
        closing ? "overlay-out pointer-events-none" : "overlay-in",
      )}
    >
      {/* Header: back + search field */}
      <div className="flex shrink-0 items-center gap-1 border-b px-2 pb-2.5 pt-[max(0.625rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={close}
          aria-label="Close search"
          className="grid size-11 shrink-0 touch-manipulation place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <ArrowLeft className="size-5" />
        </button>
        <form
          role="search"
          className="relative flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            goSearch(q);
          }}
        >
          <Search className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-muted-foreground" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search for makhana, almonds, protein…"
            className={cn(
              "h-12 w-full rounded-full border border-input bg-background pl-11 text-base text-foreground outline-none transition-[box-shadow,border-color] placeholder:text-muted-foreground/80",
              "focus-visible:border-primary/40 focus-visible:shadow-elev-2 focus-visible:ring-4 focus-visible:ring-primary/15",
              q ? "pr-[5.75rem]" : "pr-14",
            )}
            // Mounted synchronously from the tap gesture, so autoFocus opens
            // the keyboard on iOS/Android.
            autoFocus
            autoComplete="off"
            inputMode="search"
            enterKeyHint="search"
            aria-label="Search products"
          />
          <span className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center">
            {q && (
              <button
                type="button"
                onClick={() => {
                  setQ("");
                  inputRef.current?.focus();
                }}
                aria-label="Clear search"
                className="grid size-10 touch-manipulation place-items-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="size-[18px]" />
              </button>
            )}
            {/* Mic always renders; unsupported browsers get a clear message on tap. */}
            <button
              type="button"
              onClick={startVoice}
              aria-label={listening ? "Stop voice search" : "Search by voice"}
              aria-pressed={listening}
              className={cn(
                "grid size-10 touch-manipulation place-items-center rounded-full transition-colors",
                listening
                  ? "animate-pulse bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-primary",
              )}
            >
              <Mic className="size-[18px]" />
            </button>
          </span>
        </form>
      </div>

      {/* Screen-reader result announcement */}
      <span aria-live="polite" className="sr-only">
        {showResults ? `${items.length} results` : showNoResults ? "No results" : ""}
      </span>

      {/* Body */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 [-webkit-overflow-scrolling:touch]">
        {showIdle && (
          <div className="space-y-7">
            {recents.length > 0 && (
              <section className="animate-fade-up">
                <div className="flex items-baseline justify-between">
                  <h2 className={SECTION_TITLE}>
                    <Clock className="size-3.5 text-primary" /> Recent searches
                  </h2>
                  <button
                    type="button"
                    onClick={clearAllRecents}
                    className="touch-manipulation px-1 text-xs font-medium text-muted-foreground transition-colors hover:text-destructive"
                  >
                    Clear all
                  </button>
                </div>
                <ul className="-mx-2">
                  {recents.map((t) => (
                    <li key={t} className="flex items-center">
                      <button
                        type="button"
                        onClick={() => goSearch(t)}
                        className="flex min-w-0 flex-1 touch-manipulation items-center gap-3 rounded-xl px-2 py-3 text-left text-[15px] text-foreground transition-colors hover:bg-accent/60 active:bg-accent"
                      >
                        <Clock className="size-4 shrink-0 text-muted-foreground/60" />
                        <span className="truncate">{t}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteRecent(t)}
                        aria-label={`Remove "${t}" from recent searches`}
                        className="grid size-11 shrink-0 touch-manipulation place-items-center rounded-full text-muted-foreground/60 transition-colors hover:text-destructive"
                      >
                        <X className="size-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {data && data.trending.length > 0 && (
              <section className="animate-fade-up" style={{ animationDelay: "50ms" }}>
                <h2 className={SECTION_TITLE}>
                  <TrendingUp className="size-3.5 text-primary" /> Trending searches
                </h2>
                <div className="flex flex-wrap gap-2">
                  {data.trending.map((t) => (
                    <button key={t} type="button" onClick={() => goSearch(t)} className={CHIP}>
                      {t}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {data && data.categories.length > 0 && (
              <section className="animate-fade-up" style={{ animationDelay: "100ms" }}>
                <h2 className={SECTION_TITLE}>
                  <Tag className="size-3.5 text-primary" /> Shop by category
                </h2>
                <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {data.categories.map((c) => (
                    <button
                      key={c.slug}
                      type="button"
                      onClick={() => goCategory(c.slug)}
                      className={cn(CHIP, "bg-accent/40")}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {data && data.popular.length > 0 && (
              <section className="animate-fade-up" style={{ animationDelay: "150ms" }}>
                <h2 className={SECTION_TITLE}>
                  <Sparkles className="size-3.5 text-amber-500" /> Popular products
                </h2>
                <ul className="-mx-2 space-y-0.5">
                  {data.popular.map((p) => (
                    <li key={p.id}>
                      <ProductRow p={p} onTap={() => goProduct(p.slug)} />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* First-open fallback while discovery data loads */}
            {!data && recents.length === 0 && (
              <div className="space-y-3 pt-1" aria-hidden>
                {[0, 1, 2].map((i) => (
                  <div key={i} className="shimmer h-10 rounded-xl bg-accent/40" />
                ))}
              </div>
            )}
          </div>
        )}

        {showSkeleton && (
          <ul className="space-y-2 pt-1" aria-hidden>
            {[0, 1, 2, 3].map((i) => (
              <li key={i} className="flex items-center gap-3 px-2 py-2">
                <span className="shimmer size-14 rounded-xl bg-accent/50" />
                <span className="flex-1 space-y-2">
                  <span className="shimmer block h-3.5 w-3/4 rounded bg-accent/50" />
                  <span className="shimmer block h-3 w-1/3 rounded bg-accent/40" />
                </span>
              </li>
            ))}
          </ul>
        )}

        {showResults && (
          <div className="animate-fade-up space-y-1">
            {keywords.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => goSearch(k)}
                className="flex w-full touch-manipulation items-center gap-3 rounded-xl px-2 py-2.5 text-left text-[15px] text-foreground transition-colors hover:bg-accent/60 active:bg-accent"
              >
                <Search className="size-4 shrink-0 text-muted-foreground/60" />
                <span className="truncate">{k}</span>
              </button>
            ))}
            {catMatches.map((c) => (
              <button
                key={c.slug}
                type="button"
                onClick={() => goCategory(c.slug)}
                className="flex w-full touch-manipulation items-center gap-3 rounded-xl px-2 py-2.5 text-left text-[15px] text-foreground transition-colors hover:bg-accent/60 active:bg-accent"
              >
                <Tag className="size-4 shrink-0 text-primary/70" />
                <span className="truncate">
                  {c.name} <span className="text-xs text-muted-foreground">· Category</span>
                </span>
              </button>
            ))}
            <ul className="-mx-2 space-y-0.5">
              {items.map((s) => (
                <li key={s.id}>
                  <ProductRow p={s} onTap={() => goProduct(s.slug)} />
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => goSearch(term)}
              className="mt-1 flex w-full touch-manipulation items-center gap-2 rounded-xl border-t px-2 py-3.5 text-left text-[15px] font-medium text-primary transition-colors hover:bg-accent/60"
            >
              <TrendingUp className="size-4" />
              See all results for “{term}”
            </button>
          </div>
        )}

        {showNoResults && (
          <div className="animate-fade-up space-y-7">
            <div className="pt-2 text-center">
              <p className="text-[15px] font-medium text-foreground">No matches for “{term}”</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Check the spelling or try fewer words
              </p>
              <button
                type="button"
                onClick={() => goSearch(term)}
                className="mt-3 touch-manipulation rounded-full border px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary"
              >
                Search anyway
              </button>
            </div>

            <button
              type="button"
              onClick={() => navigate(`/assistant?q=${encodeURIComponent(term)}`)}
              className="flex w-full touch-manipulation items-center gap-3 rounded-2xl border bg-accent/30 p-4 text-left shadow-elev-1 transition-colors hover:border-primary/40"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <Sparkles className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-[15px] font-semibold text-foreground">
                  Ask AI to help me choose
                </span>
                <span className="block text-xs text-muted-foreground">
                  Describe your goal — Nutri finds the right products.
                </span>
              </span>
            </button>

            {data && data.trending.length > 0 && (
              <section>
                <h2 className={SECTION_TITLE}>
                  <TrendingUp className="size-3.5 text-primary" /> Trending searches
                </h2>
                <div className="flex flex-wrap gap-2">
                  {data.trending.map((t) => (
                    <button key={t} type="button" onClick={() => goSearch(t)} className={CHIP}>
                      {t}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {data && data.popular.length > 0 && (
              <section>
                <h2 className={SECTION_TITLE}>
                  <Sparkles className="size-3.5 text-amber-500" /> You might like
                </h2>
                <ul className="-mx-2 space-y-0.5">
                  {data.popular.map((p) => (
                    <li key={p.id}>
                      <ProductRow p={p} onTap={() => goProduct(p.slug)} />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {data && data.categories.length > 0 && (
              <section>
                <h2 className={SECTION_TITLE}>
                  <Tag className="size-3.5 text-primary" /> Browse categories
                </h2>
                <div className="flex flex-wrap gap-2">
                  {data.categories.map((c) => (
                    <button
                      key={c.slug}
                      type="button"
                      onClick={() => goCategory(c.slug)}
                      className={cn(CHIP, "bg-accent/40")}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      {/* Voice status pill */}
      {listening && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[max(1.5rem,env(safe-area-inset-bottom))] flex justify-center">
          <span className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-elev-2">
            <Loader2 className="size-4 animate-spin" /> Listening…
          </span>
        </div>
      )}
    </div>
  );
}
