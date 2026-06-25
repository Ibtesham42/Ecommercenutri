import Link from "next/link";
import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { PageHeader } from "@/components/admin/page-header";
import { guardSection } from "@/lib/admin-guard";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { prisma } from "@/lib/prisma";
import { formatPrice, formatDate } from "@/lib/format";

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
      createdAt: true,
      _count: { select: { orders: true } },
      orders: { where: { paymentStatus: "PAID" }, select: { total: true } },
    },
  });

  const rows = users.map((u) => ({
    ...u,
    spend: u.orders.reduce((n, o) => n + o.total, 0),
  }));

  return (
    <div>
      <PageHeader title="Customers" description={`${rows.length} customer${rows.length === 1 ? "" : "s"}`} />

      <form action="/admin/customers" className="mb-4 max-w-sm">
        <Input name="q" placeholder="Search by name or email…" defaultValue={q} />
      </form>

      <div className="rounded-xl border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead>Orders</TableHead>
              <TableHead className="text-right">Total spend</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                  No customers found.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <Link
                      href={`/admin/customers/${u.id}`}
                      className="font-medium hover:text-primary"
                    >
                      {u.name ?? "—"}
                    </Link>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(u.createdAt)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{u._count.orders}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatPrice(u.spend)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
