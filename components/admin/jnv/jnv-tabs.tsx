"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/admin/jnv", label: "Dashboard", exact: true },
  { href: "/admin/jnv/browse", label: "Classes & Resources" },
  { href: "/admin/jnv/announcements", label: "Announcements" },
];

export function JnvTabs() {
  const pathname = usePathname();
  return (
    <div className="mb-5 border-b">
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
