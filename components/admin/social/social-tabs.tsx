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
  { href: "/admin/social/analytics", label: "Analytics" },
  { href: "/admin/social/templates", label: "Templates" },
  { href: "/admin/social/settings", label: "Settings" },
];

export function SocialTabs() {
  const pathname = usePathname();
  return (
    <div className="mb-4 flex flex-wrap gap-1.5 border-b pb-2">
      {tabs.map((t) => {
        const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm transition hover:bg-accent",
              active && "bg-accent font-medium text-primary",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
