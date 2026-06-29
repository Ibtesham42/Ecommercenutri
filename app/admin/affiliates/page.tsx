import Link from "next/link";
import type { Metadata } from "next";
import { Download } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { guardSection } from "@/lib/admin-guard";
import { AffiliateTabs } from "@/components/admin/affiliate-tabs";
import { AffiliateTable, type AffiliateRow } from "@/components/admin/affiliate-table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getAdminAffiliates, type AdminAffiliateFilters } from "@/lib/queries/affiliate";
import { cn } from "@/lib/utils";
import { AFFILIATE_ROLE_LABEL } from "@/lib/affiliate/labels";
import { AFFILIATE_ROLES } from "@/lib/validations/affiliate";

export const metadata: Metadata = { title: "Affiliates", robots: { index: false } };

const STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Active" },
  { value: "REJECTED", label: "Rejected" },
  { value: "SUSPENDED", label: "Suspended" },
];

export default async function AdminAffiliatesPage({
  searchParams,
}: {
  searchParams: Promise<AdminAffiliateFilters>;
}) {
  await guardSection("affiliates");
  const sp = await searchParams;
  const filters: AdminAffiliateFilters = {
    status: sp.status ?? "",
    role: sp.role ?? "",
    q: sp.q ?? "",
  };
  const affiliates = await getAdminAffiliates(filters);
  const rows: AffiliateRow[] = affiliates.map((a) => ({
    id: a.id,
    displayName: a.displayName,
    code: a.code,
    email: a.user.email ?? "",
    role: a.role,
    clicks: a._count.clicks,
    orders: a._count.orders,
    status: a.status,
    createdAt: a.createdAt.toISOString(),
  }));
  const exportQs = new URLSearchParams(
    Object.entries(filters).filter(([, v]) => v) as [string, string][],
  ).toString();

  return (
    <div>
      <PageHeader
        title="Affiliates"
        description={`${affiliates.length} affiliate${affiliates.length === 1 ? "" : "s"}`}
      />
      <AffiliateTabs />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((f) => (
          <Link
            key={f.value}
            href={`/admin/affiliates${f.value ? `?status=${f.value}` : ""}`}
            className={cn(
              "rounded-full border px-3 py-1 text-sm transition hover:bg-accent",
              (filters.status ?? "") === f.value && "border-primary bg-primary/10 text-primary",
            )}
          >
            {f.label}
          </Link>
        ))}
        <Button asChild variant="outline" size="sm" className="ml-auto gap-1.5">
          <a href={`/admin/affiliates/export${exportQs ? `?${exportQs}` : ""}`}>
            <Download className="size-4" /> Export CSV
          </a>
        </Button>
      </div>

      <form action="/admin/affiliates" className="mb-4 flex flex-wrap gap-2">
        <Input name="q" placeholder="Search code, name or email" defaultValue={filters.q} className="w-64" />
        <select
          name="role"
          defaultValue={filters.role}
          className="h-9 rounded-md border bg-transparent px-3 text-sm"
        >
          <option value="">Any role</option>
          {AFFILIATE_ROLES.map((r) => (
            <option key={r} value={r}>
              {AFFILIATE_ROLE_LABEL[r]}
            </option>
          ))}
        </select>
        {filters.status && <input type="hidden" name="status" value={filters.status} />}
        <Button type="submit" variant="outline">
          Filter
        </Button>
      </form>

      <AffiliateTable affiliates={rows} />
    </div>
  );
}
