"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

type CatalogNav = { isPending: boolean; navigate: (href: string) => void };

const CatalogNavContext = createContext<CatalogNav | null>(null);

/**
 * Filter / sort / page changes run as a React transition: the current results
 * stay on screen (dimmed, aria-busy) until the new ones are ready, the scroll
 * position is kept, and an open filter drawer stays open.
 */
export function CatalogTransitionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const saved = useRef<{ y: number; focus: Element | null } | null>(null);
  const navigate = useCallback(
    (href: string) => {
      saved.current = { y: window.scrollY, focus: document.activeElement };
      startTransition(() => router.push(href, { scroll: false }));
    },
    [router],
  );

  // Next 15.5 still scrolls to top and focuses the page when a search-param
  // change remounts the page segment, even with `scroll: false`. Its handler
  // runs later in the same commit than this layout effect, so restore in a
  // microtask: after that handler, before paint, so there's no flash.
  useLayoutEffect(() => {
    if (isPending || !saved.current) return;
    const { y, focus } = saved.current;
    saved.current = null;
    queueMicrotask(() => {
      if (focus instanceof HTMLElement && focus.isConnected && document.activeElement !== focus) {
        focus.focus({ preventScroll: true });
      }
      if (Math.abs(window.scrollY - y) > 1) window.scrollTo({ top: y, behavior: "instant" });
    });
  }, [isPending]);
  return <CatalogNavContext.Provider value={{ isPending, navigate }}>{children}</CatalogNavContext.Provider>;
}

export function useCatalogNav(): CatalogNav {
  const ctx = useContext(CatalogNavContext);
  const router = useRouter();
  return ctx ?? { isPending: false, navigate: (href) => router.push(href, { scroll: false }) };
}

/** A real link (works without JS, opens in new tabs) that navigates inside the catalog transition. */
export function CatalogLink({ href, onClick, ...props }: Omit<React.ComponentProps<typeof Link>, "href"> & { href: string }) {
  const { navigate } = useCatalogNav();
  return (
    <Link
      href={href}
      scroll={false}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        navigate(href);
      }}
      {...props}
    />
  );
}

/** Results region: dims while a catalog transition is pending; brings the
 *  results top back into view when the page number changes. */
export function CatalogResults({ page, children }: { page: number; children: React.ReactNode }) {
  const { isPending } = useCatalogNav();
  const ref = useRef<HTMLDivElement>(null);
  const lastPage = useRef(page);

  useEffect(() => {
    if (lastPage.current === page) return;
    lastPage.current = page;
    // Next frame: after the provider's scroll restore (a microtask) has run.
    const raf = requestAnimationFrame(() => {
      const el = ref.current;
      if (el && el.getBoundingClientRect().top < 0) {
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        el.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [page]);

  return (
    <div
      ref={ref}
      aria-busy={isPending || undefined}
      className={cn("scroll-mt-32 transition-opacity duration-200", isPending && "opacity-55")}
    >
      {children}
    </div>
  );
}

/** Polite live text that reads "Updating…" while a transition is pending. */
export function CatalogStatus({ children, className }: { children: React.ReactNode; className?: string }) {
  const { isPending } = useCatalogNav();
  return (
    <p aria-live="polite" className={className}>
      {isPending ? "Updating…" : children}
    </p>
  );
}
