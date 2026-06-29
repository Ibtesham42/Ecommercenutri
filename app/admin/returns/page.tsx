import Link from "next/link";
import type { Metadata } from "next";
import { Download } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { guardSection } from "@/lib/admin-guard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ReturnTable, type ReturnRow } from "@/components/admin/return-table";
import { getAdminReturns, type ReturnFilters } from "@/lib/queries/returns";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Refunds & Returns", robots: { index: false } };

const STATUS_FILTERS = [
  { label: "All", value: "" },
  { label: "Requested", value: "REQUESTED" },
  { label: "Under review", value: "UNDER_REVIEW" },
  { label: "Info requested", value: "INFO_REQUESTED" },
  { label: "Approved", value: "APPROVED" },
  { label: "Pickup scheduled", value: "PICKUP_SCHEDULED" },
  { label: "Refunded", value: "REFUNDED" },
  { label: "Rejected", value: "REJECTED" },
  { label: "Cancelled", value: "CANCELLED" },
];

export default async function AdminReturnsPage({
  searchParams,
}: {
  searchParams: Promise<ReturnFilters>;
}) {
  await guardSection("returns");
  const sp = await searchParams;
  const filters: ReturnFilters = {
    status: sp.status ?? "",
    q: sp.q ?? "",
    from: sp.from ?? "",
    to: sp.to ?? "",
    paymentMethod: sp.paymentMethod ?? "",
  };
  const returns = await getAdminReturns(filters);
  const rows: ReturnRow[] = returns.map((r) => ({
    id: r.id,
    returnNumber: r.returnNumber,
    orderNumber: r.order.orderNumber,
    customer: r.user.name ?? r.user.email ?? "—",
    createdAt: r.createdAt.toISOString(),
    paymentMethod: r.order.paymentMethod,
    status: r.status,
    refund: r.refundedAmount || r.refundAmount,
    items: r._count.items,
  }));

  const exportQs = new URLSearchParams(
    Object.entries(filters).filter(([, v]) => v) as [string, string][],
  ).toString();

  return (
    <div>
      <PageHeader
        title="Refunds & Returns"
        description={`${returns.length} request${returns.length === 1 ? "" : "s"}`}
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((f) => (
          <Link
            key={f.value}
            href={`/admin/returns${f.value ? `?status=${f.value}` : ""}`}
            className={cn(
              "rounded-full border px-3 py-1 text-sm transition hover:bg-accent",
              (filters.status ?? "") === f.value && "border-primary bg-primary/10 text-primary",
            )}
          >
            {f.label}
          </Link>
        ))}
        <Button asChild variant="outline" size="sm" className="ml-auto gap-1.5">
          <a href={`/admin/returns/export${exportQs ? `?${exportQs}` : ""}`}>
            <Download className="size-4" /> Download CSV
          </a>
        </Button>
      </div>

      <form action="/admin/returns" className="mb-4 flex flex-wrap gap-2">
        <Input
          name="q"
          placeholder="Search return #, order # or customer"
          defaultValue={filters.q}
          className="w-64"
        />
        <select
          name="paymentMethod"
          defaultValue={filters.paymentMethod}
          className="h-9 rounded-md border bg-transparent px-3 text-sm"
        >
          <option value="">Any payment</option>
          <option value="RAZORPAY">Prepaid (Razorpay)</option>
          <option value="COD">Cash on Delivery</option>
        </select>
        <Input type="date" name="from" defaultValue={filters.from} className="w-40" />
        <Input type="date" name="to" defaultValue={filters.to} className="w-40" />
        {filters.status && <input type="hidden" name="status" value={filters.status} />}
        <Button type="submit" variant="outline">
          Filter
        </Button>
      </form>

      <ReturnTable returns={rows} />
    </div>
  );
}
