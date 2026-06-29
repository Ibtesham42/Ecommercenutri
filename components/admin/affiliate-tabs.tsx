"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/admin/affiliates", label: "Affiliates", exact: true },
  { href: "/admin/affiliates/rules", label: "Commission rules" },
  { href: "/admin/affiliates/payouts", label: "Payouts" },
  { href: "/admin/affiliates/marketing-kit", label: "Marketing kit" },
  { href: "/admin/affiliates/analytics", label: "Analytics" },
  { href: "/admin/affiliates/settings", label: "Settings" },
];

export function AffiliateTabs() {
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
