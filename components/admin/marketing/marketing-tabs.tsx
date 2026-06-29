"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/admin/marketing", label: "Overview", exact: true },
  { href: "/admin/marketing/campaigns", label: "Campaigns" },
  { href: "/admin/marketing/compose", label: "Compose" },
  { href: "/admin/marketing/segments", label: "Segments" },
  { href: "/admin/marketing/automations", label: "Automations" },
  { href: "/admin/marketing/templates", label: "Templates" },
];

export function MarketingTabs() {
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
