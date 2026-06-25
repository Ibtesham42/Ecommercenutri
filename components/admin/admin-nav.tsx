"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  Boxes,
  FolderTree,
  TicketPercent,
  Clapperboard,
  GalleryHorizontalEnd,
  Users,
  Sparkles,
  Settings,
  Menu,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Permission } from "@/lib/permissions";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
  permission?: Permission; // sub-admins need this section permission
  superOnly?: boolean; // only the main admin
};

const nav: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/orders", label: "Orders", icon: ShoppingBag, permission: "orders" },
  { href: "/admin/products", label: "Products", icon: Package, permission: "products" },
  { href: "/admin/inventory", label: "Inventory", icon: Boxes, permission: "inventory" },
  { href: "/admin/categories", label: "Categories", icon: FolderTree, permission: "categories" },
  { href: "/admin/coupons", label: "Coupons", icon: TicketPercent, permission: "coupons" },
  { href: "/admin/stories", label: "Stories", icon: Clapperboard, permission: "stories" },
  { href: "/admin/hero", label: "Hero Slider", icon: GalleryHorizontalEnd, permission: "appearance" },
  { href: "/admin/customers", label: "Customers", icon: Users, permission: "customers" },
  { href: "/admin/ai-settings", label: "AI Settings", icon: Sparkles, permission: "ai" },
  { href: "/admin/admins", label: "Admins", icon: ShieldCheck, superOnly: true },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export type AdminNavAccess = { isSuperAdmin: boolean; permissions: string[] };

function visibleNav({ isSuperAdmin, permissions }: AdminNavAccess): NavItem[] {
  if (isSuperAdmin) return nav;
  return nav.filter((item) => {
    if (item.superOnly) return false;
    if (item.permission) return permissions.includes(item.permission);
    return true; // Dashboard + Settings are always available
  });
}

export function AdminNav({
  access,
  onNavigate,
}: {
  access: AdminNavAccess;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {visibleNav(access).map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent",
              active && "bg-accent font-medium text-primary",
            )}
          >
            <item.icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AdminMobileNav({ access }: { access: AdminNavAccess }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="lg:hidden" aria-label="Open menu">
          <Menu className="size-4" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0">
        <SheetHeader className="border-b p-4">
          <SheetTitle className="text-left">Nutriyet Admin</SheetTitle>
        </SheetHeader>
        <div className="p-3">
          <AdminNav access={access} onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
