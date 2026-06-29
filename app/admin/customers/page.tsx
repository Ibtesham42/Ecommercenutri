import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { PageHeader } from "@/components/admin/page-header";
import { guardSection } from "@/lib/admin-guard";
import { Input } from "@/components/ui/input";
import { CustomerTable, type CustomerRow } from "@/components/admin/customer-table";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Customers", robots: { index: false } };

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await guardSection("customers");
  const { q = "" } = await searchParams;

  const where: Prisma.UserWhereInput = {
    role: "USER",
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      name: true,
      email: true,
      isActive: true,
      createdAt: true,
      _count: { select: { orders: true } },
      orders: { where: { paymentStatus: "PAID" }, select: { total: true } },
    },
  });

  const rows: CustomerRow[] = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    isActive: u.isActive,
    createdAt: u.createdAt.toISOString(),
    orders: u._count.orders,
    spend: u.orders.reduce((n, o) => n + o.total, 0),
  }));

  return (
    <div>
      <PageHeader title="Customers" description={`${rows.length} customer${rows.length === 1 ? "" : "s"}`} />

      <form action="/admin/customers" className="mb-4 max-w-sm">
        <Input name="q" placeholder="Search by name or email…" defaultValue={q} />
      </form>

      <CustomerTable customers={rows} />
    </div>
  );
}
