"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { Home, ShoppingBag, Search, User, Heart } from "lucide-react";
import { cn } from "@/lib/utils";

// Same lazy-load + idle-prewarm pattern as `mobile-search-trigger.tsx` (the
// header's mobile search row) — opening search from either entry point reuses
// the one overlay chunk, so there's no extra bundle cost for this tab.
const SearchOverlay = dynamic(
  () => import("./search-overlay").then((m) => m.SearchOverlay),
  { ssr: false },
);

function prewarm() {
  import("./search-overlay").then((m) => m.preloadOverlayData()).catch(() => {});
}

/**
 * Sticky bottom tab bar — mobile only (`md:hidden`). Five equal-weight,
 * calm tabs (Home/Shop/Search/Wishlist/Account; Cart lives in the header): no
 * raised center button, no pill fills — thin line icons, clear labels.
 * AI stays reachable (search overlay's "Ask Nutriyet AI" row, header nav,
 * drawer "Discover" group) without visually dominating primary navigation.
 *
 * Hidden on product-detail pages, which render their own sticky add-to-cart
 * bar at the same screen edge (they would otherwise overlap).
 */
export function MobileBottomNav({ isLoggedIn = false }: { isLoggedIn?: boolean }) {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  const searchTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number };
    if (w.requestIdleCallback) w.requestIdleCallback(prewarm);
    else setTimeout(prewarm, 1500);
  }, []);

  // Hidden on pages where it would get in the way: product detail (/products/<slug>)
  // and cart render their own sticky bottom action bar at the same screen edge;
  // checkout is kept distraction-free (its place-order CTA lives in the summary card).
  const onProductDetail =
    pathname.startsWith("/products/") && pathname !== "/products";
  const onOwnBottomBar =
    onProductDetail || pathname === "/cart" || pathname.startsWith("/checkout");

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");

  if (onOwnBottomBar) return null;

  return (
    <>
      <nav
        aria-label="Primary"
        // Pinned to the bottom of the viewport. IMPORTANT: no `transform` here —
        // on iOS Safari a transform (even translateZ(0)) on a position:fixed
        // element makes it scroll with the page instead of staying pinned. Solid
        // background (no backdrop-blur) avoids scroll repaint jitter; safe-area
        // padding fills the iPhone home-indicator gap so there's no white gap.
        className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        data-heat="bottom-nav"
      >
        <div className="mx-auto grid h-16 max-w-md grid-cols-5 items-center px-2">
          <Tab href="/" label="Home" active={isActive("/", true)}>
            <Home className="size-[22px]" strokeWidth={1.6} />
          </Tab>
          <Tab href="/products" label="Shop" active={isActive("/products") || isActive("/categories")}>
            <ShoppingBag className="size-[22px]" strokeWidth={1.6} />
          </Tab>

          <TabButton
            ref={searchTriggerRef}
            label="Search"
            onClick={() => setSearchOpen(true)}
            onPointerDown={prewarm}
          >
            <Search className="size-[22px]" strokeWidth={1.6} />
          </TabButton>

          <Tab href="/account/wishlist" label="Wishlist" active={isActive("/account/wishlist")}>
            <Heart className="size-[22px]" strokeWidth={1.6} />
          </Tab>
          <Tab
            href={isLoggedIn ? "/account" : "/login"}
            label="Account"
            active={(isActive("/account") && !isActive("/account/wishlist")) || isActive("/login")}
          >
            <User className="size-[22px]" strokeWidth={1.6} />
          </Tab>
        </div>
      </nav>

      {searchOpen && (
        <SearchOverlay
          onClose={() => {
            setSearchOpen(false);
            searchTriggerRef.current?.focus();
          }}
        />
      )}
    </>
  );
}

/** Shared tab chrome: icon, label, and a thin indicator bar (reserved space,
 *  so toggling it never shifts layout) instead of a filled pill behind the
 *  icon — calm/permanent rather than app-like. */
function tabChrome(active: boolean) {
  return {
    link: cn(
      "flex min-h-11 flex-col items-center justify-center gap-1 pt-2 text-[11px] font-medium tracking-[0.01em] transition-colors",
      active ? "text-primary" : "text-muted-foreground hover:text-foreground",
    ),
    indicator: cn(
      "h-0.5 w-5 rounded-full transition-colors",
      active ? "bg-primary" : "bg-transparent",
    ),
  };
}

function Tab({
  href,
  label,
  active,
  children,
}: {
  href: string;
  label: string;
  active: boolean;
  children: React.ReactNode;
}) {
  const chrome = tabChrome(active);
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={chrome.link}>
      {children}
      <span className={cn(active && "font-semibold")}>{label}</span>
      <span className={chrome.indicator} />
    </Link>
  );
}

function TabButton({
  label,
  onClick,
  onPointerDown,
  children,
  ref,
}: {
  label: string;
  onClick: () => void;
  onPointerDown?: () => void;
  children: React.ReactNode;
  ref?: React.Ref<HTMLButtonElement>;
}) {
  const chrome = tabChrome(false);
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      onPointerDown={onPointerDown}
      aria-label={`Open ${label.toLowerCase()}`}
      className={chrome.link}
    >
      {children}
      <span>{label}</span>
      <span className={chrome.indicator} />
    </button>
  );
}
