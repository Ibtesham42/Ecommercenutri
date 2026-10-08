"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { LayoutGrid, User, Package, MapPin, Heart, MessageSquare, RotateCcw, Megaphone, LogOut } from "lucide-react";
import { logoutAction } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/account", label: "Dashboard", icon: LayoutGrid },
  { href: "/account/profile", label: "Profile", icon: User },
  { href: "/account/orders", label: "Orders", icon: Package },
  { href: "/account/returns", label: "Returns", icon: RotateCcw },
  { href: "/account/affiliate", label: "Affiliate", icon: Megaphone },
  { href: "/account/addresses", label: "Addresses", icon: MapPin },
  { href: "/account/wishlist", label: "Wishlist", icon: Heart },
  { href: "/account/ai-history", label: "AI Chats", icon: MessageSquare },
];

function activeItem(pathname: string) {
  return nav.find((item) =>
    item.href === "/account" ? pathname === "/account" : pathname.startsWith(item.href),
  );
}

/**
 * The account page's single h1, named after the active section (the dashboard
 * greets by first name). Lives here so it can never drift from the nav labels.
 */
export function AccountTitle({ firstName }: { firstName?: string }) {
  const pathname = usePathname();
  const item = activeItem(pathname);
  const title =
    !item || item.href === "/account" ? (firstName ? `Hi, ${firstName}` : "My account") : item.label;
  return <h1 className="mt-2 font-heading text-title text-foreground sm:mt-3">{title}</h1>;
}

/** Section nav: a scrolling tab row on mobile, a quiet vertical list from md. */
export function AccountSidebar() {
  const pathname = usePathname();
  const current = activeItem(pathname);
  const navRef = useRef<HTMLElement>(null);

  // Mobile tab row: bring the active tab into view. Sets the rail's own
  // scrollLeft (not scrollIntoView) so the page itself never scrolls.
  useEffect(() => {
    const rail = navRef.current;
    const tab = rail?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!rail || !tab || rail.scrollWidth <= rail.clientWidth) return;
    const offset = tab.getBoundingClientRect().left - rail.getBoundingClientRect().left + rail.scrollLeft;
    rail.scrollLeft = offset - (rail.clientWidth - tab.offsetWidth) / 2;
  }, [pathname]);

  return (
    <nav ref={navRef} aria-label="Account" className="scroll-rail gap-1 md:flex md:flex-col md:gap-0.5 md:overflow-visible">
      {nav.map((item) => {
        const active = item === current;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex min-h-11 shrink-0 items-center gap-2.5 px-3 text-[15px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring max-md:rounded-md md:rounded-r-md md:pl-4",
              // Mobile: underline tab. Desktop: forest rule on the left edge.
              "after:absolute after:bg-primary after:transition-opacity max-md:after:inset-x-3 max-md:after:bottom-0 max-md:after:h-0.5 md:after:inset-y-2 md:after:left-0 md:after:w-0.5",
              active
                ? "font-medium text-foreground after:opacity-100"
                : "text-muted-foreground after:opacity-0 hover:text-foreground",
            )}
          >
            <item.icon className="size-4 shrink-0" strokeWidth={1.75} aria-hidden />
            {item.label}
          </Link>
        );
      })}
      <form action={logoutAction} className="md:mt-3 md:border-t md:border-border md:pt-3">
        <button
          type="submit"
          className="flex min-h-11 w-full shrink-0 items-center gap-2.5 px-3 text-[15px] text-muted-foreground outline-none transition-colors hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring max-md:rounded-md md:pl-4"
        >
          <LogOut className="size-4" strokeWidth={1.75} aria-hidden />
          Sign out
        </button>
      </form>
    </nav>
  );
}
