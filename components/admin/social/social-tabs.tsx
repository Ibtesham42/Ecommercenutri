"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/admin/social", label: "Dashboard", exact: true },
  { href: "/admin/social/calendar", label: "Calendar" },
  { href: "/admin/social/queue", label: "Queue" },
  { href: "/admin/social/scheduled", label: "Scheduled" },
  { href: "/admin/social/published", label: "Published" },
  { href: "/admin/social/failed", label: "Failed" },
  { href: "/admin/social/campaigns", label: "Campaigns" },
  { href: "/admin/social/intelligence", label: "Intelligence" },
  { href: "/admin/social/analytics", label: "Analytics" },
  { href: "/admin/social/templates", label: "Templates" },
  { href: "/admin/social/settings", label: "Settings" },
];

export function SocialTabs() {
  const pathname = usePathname();
  return (
    <div className="mb-5 border-b">
      {/* Underline tab bar (Linear/Vercel style) — scrolls horizontally on
          small screens instead of wrapping into a messy multi-row block. */}
      <div className="no-scrollbar -mb-px flex gap-0.5 overflow-x-auto">
        {tabs.map((t) => {
          const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "whitespace-nowrap border-b-2 border-transparent px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
                active && "border-primary text-foreground",
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
