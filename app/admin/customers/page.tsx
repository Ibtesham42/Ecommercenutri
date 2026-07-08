import Link from "next/link";
import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { PageHeader } from "@/components/admin/page-header";
import { guardSection } from "@/lib/admin-guard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CustomerTable, type CustomerRow } from "@/components/admin/customer-table";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";
import {
  customerSegment,
  registrationSource,
  SEGMENT_LABEL,
  SEGMENT_VALUES,
  type CustomerSegment,
} from "@/lib/customers/segment";

export const metadata: Metadata = { title: "Customers", robots: { index: false } };

const STATUS_FILTERS = [
  { label: "All", value: "" },
  { label: "Active", value: "active" },
  { label: "Blocked", value: "blocked" },
];

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; segment?: string }>;
}) {
  await guardSection("customers");
  const { q = "", status = "", segment = "" } = await searchParams;

  const where: Prisma.UserWhereInput = {
    role: "USER",
    ...(status === "active" ? { isActive: true } : status === "blocked" ? { isActive: false } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { phone: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      phone: true,
      isActive: true,
      emailVerified: true,
      phoneVerified: true,
      createdAt: true,
      affiliate: { select: { status: true } },
      accounts: { select: { provider: true } },
      _count: { select: { orders: true } },
      orders: { where: { paymentStatus: "PAID" }, select: { total: true } },
    },
  });

  let rows: CustomerRow[] = users.map((u) => {
    const spend = u.orders.reduce((n, o) => n + o.total, 0);
    const paidCount = u.orders.length;
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      image: u.image,
      phone: u.phone,
      isActive: u.isActive,
      emailVerified: Boolean(u.emailVerified),
      phoneVerified: Boolean(u.phoneVerified),
      createdAt: u.createdAt.toISOString(),
      orders: u._count.orders,
      spend,
      aov: paidCount ? Math.round(spend / paidCount) : 0,
      segment: customerSegment(spend, u._count.orders),
      source: registrationSource({
        providers: u.accounts.map((a) => a.provider),
        phoneVerified: Boolean(u.phoneVerified),
      }),
      affiliateStatus: u.affiliate?.status ?? null,
    };
  });

  // Segment is derived, so it's filtered over the loaded set.
  if (segment && (SEGMENT_VALUES as string[]).includes(segment)) {
    rows = rows.filter((r) => r.segment === (segment as CustomerSegment));
  }

  const qs = (next: Record<string, string>) => {
    const p = new URLSearchParams({ q, status, segment, ...next });
    for (const [k, v] of [...p.entries()]) if (!v) p.delete(k);
    const s = p.toString();
    return s ? `?${s}` : "/admin/customers";
  };

  return (
    <div>
      <PageHeader
        title="Customers"
        description={`${rows.length} customer${rows.length === 1 ? "" : "s"}`}
      />

      <div className="mb-4 flex flex-col gap-3">
        <form action="/admin/customers" className="flex gap-2">
          {status && <input type="hidden" name="status" value={status} />}
          {segment && <input type="hidden" name="segment" value={segment} />}
          <Input
            name="q"
            placeholder="Search by name, email or phone…"
            defaultValue={q}
            className="max-w-sm"
          />
          <Button type="submit" variant="outline">
            Search
          </Button>
        </form>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-xs font-medium text-muted-foreground">Status</span>
          {STATUS_FILTERS.map((f) => (
            <Link
              key={f.value}
              href={qs({ status: f.value })}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition hover:bg-accent",
                status === f.value && "border-primary bg-primary/10 text-primary",
              )}
            >
              {f.label}
            </Link>
          ))}
          <span className="ml-2 text-xs font-medium text-muted-foreground">Segment</span>
          <Link
            href={qs({ segment: "" })}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition hover:bg-accent",
              !segment && "border-primary bg-primary/10 text-primary",
            )}
          >
            All
          </Link>
          {SEGMENT_VALUES.map((s) => (
            <Link
              key={s}
              href={qs({ segment: s })}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition hover:bg-accent",
                segment === s && "border-primary bg-primary/10 text-primary",
              )}
            >
              {SEGMENT_LABEL[s]}
            </Link>
          ))}
        </div>
      </div>

      <CustomerTable customers={rows} />
    </div>
  );
}
