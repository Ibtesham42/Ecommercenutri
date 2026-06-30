"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { User, Package, MapPin, Heart, MessageSquare, RotateCcw, Megaphone, LogOut } from "lucide-react";
import { logoutAction } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/account", label: "Profile", icon: User },
  { href: "/account/orders", label: "Orders", icon: Package },
  { href: "/account/returns", label: "Returns & Refunds", icon: RotateCcw },
  { href: "/account/affiliate", label: "Affiliate", icon: Megaphone },
  { href: "/account/addresses", label: "Addresses", icon: MapPin },
  { href: "/account/wishlist", label: "Wishlist", icon: Heart },
  { href: "/account/ai-history", label: "AI Chats", icon: MessageSquare },
];

export function AccountSidebar() {
  const pathname = usePathname();
  return (
    <nav className="scroll-rail gap-1.5 md:flex md:flex-col md:overflow-visible">
      {nav.map((item) => {
        const active =
          item.href === "/account"
            ? pathname === "/account"
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-colors hover:bg-accent",
              active
                ? "bg-primary/10 font-semibold text-primary"
                : "text-foreground/80",
            )}
          >
            <item.icon className={cn("size-4", active && "text-primary")} />
            {item.label}
          </Link>
        );
      })}
      <form action={logoutAction} className="md:mt-2 md:border-t md:pt-2">
        <button
          type="submit"
          className="flex w-full shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="size-4" />
          Sign out
        </button>
      </form>
    </nav>
  );
}
