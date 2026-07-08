"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  RotateCcw,
  Boxes,
  FolderTree,
  TicketPercent,
  Clapperboard,
  GalleryHorizontalEnd,
  LayoutTemplate,
  Images,
  Newspaper,
  ScrollText,
  Box,
  Palette,
  Truck,
  Users,
  Megaphone,
  Mail,
  Briefcase,
  Star,
  Bell,
  Send,
  AtSign,
  WandSparkles,
  ClipboardList,
  Sparkles,
  LineChart,
  Search,
  Rocket,
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
  { href: "/admin/returns", label: "Refunds & Returns", icon: RotateCcw, permission: "returns" },
  { href: "/admin/products", label: "Products", icon: Package, permission: "products" },
  { href: "/admin/reviews", label: "Reviews", icon: Star, permission: "products" },
  { href: "/admin/inventory", label: "Inventory", icon: Boxes, permission: "inventory" },
  { href: "/admin/categories", label: "Categories", icon: FolderTree, permission: "categories" },
  { href: "/admin/coupons", label: "Coupons", icon: TicketPercent, permission: "coupons" },
  { href: "/admin/stories", label: "Stories", icon: Clapperboard, permission: "stories" },
  { href: "/admin/hero", label: "Hero Slider", icon: GalleryHorizontalEnd, permission: "appearance" },
  { href: "/admin/showcase", label: "3D Showcase", icon: Box, permission: "appearance" },
  { href: "/admin/homepage", label: "Homepage", icon: LayoutTemplate, permission: "appearance" },
  { href: "/admin/banners", label: "Banners", icon: Images, permission: "appearance" },
  { href: "/admin/blog", label: "Blog", icon: Newspaper, permission: "appearance" },
  { href: "/admin/legal", label: "Legal Pages", icon: ScrollText, permission: "appearance" },
  { href: "/admin/appearance", label: "Appearance", icon: Palette, permission: "appearance" },
  { href: "/admin/seo", label: "SEO & Social Share", icon: Search, permission: "appearance" },
  { href: "/admin/shipping", label: "Shipping", icon: Truck, permission: "appearance" },
  { href: "/admin/customers", label: "Customers", icon: Users, permission: "customers" },
  { href: "/admin/affiliates", label: "Affiliates", icon: Megaphone, permission: "affiliates" },
  { href: "/admin/marketing", label: "Marketing Hub", icon: Send, permission: "marketing" },
  { href: "/admin/subscribers", label: "Subscribers", icon: AtSign, permission: "marketing" },
  { href: "/admin/social", label: "AI Marketing", icon: WandSparkles, permission: "social" },
  { href: "/admin/growth", label: "Growth", icon: Rocket, permission: "appearance" },
  { href: "/admin/messages", label: "Messages", icon: Mail, permission: "customers" },
  { href: "/admin/b2b", label: "B2B Inquiries", icon: Briefcase, permission: "customers" },
  { href: "/admin/survey", label: "Survey", icon: ClipboardList, permission: "customers" },
  { href: "/admin/notifications", label: "Notifications", icon: Bell, permission: "customers" },
  { href: "/admin/insights", label: "AI Insights", icon: LineChart, permission: "ai" },
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
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-all duration-200 hover:bg-accent hover:text-foreground",
              active && "bg-primary/10 font-medium text-primary hover:bg-primary/15 hover:text-primary",
            )}
          >
            {active && (
              <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary" />
            )}
            <item.icon className="size-4 shrink-0 transition-transform duration-200 motion-safe:group-hover:scale-110" />
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
