import Link from "next/link";
import type { Metadata } from "next";
import {
  IndianRupee,
  ShoppingBag,
  Users,
  Package,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import {
  getDashboardStats,
  getRecentOrders,
  getLowStockVariants,
  getTopProducts,
} from "@/lib/queries/admin";
import { formatPrice, formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Admin Dashboard", robots: { index: false } };

function StatCard({
  label,
  value,
  icon: Icon,
  hint,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border bg-background p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default async function AdminDashboardPage() {
  const [stats, recentOrders, lowStock, topProducts] = await Promise.all([
    getDashboardStats(),
    getRecentOrders(),
    getLowStockVariants(),
    getTopProducts(),
  ]);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="An overview of your store's performance."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Revenue"
          value={formatPrice(stats.revenue)}
          icon={IndianRupee}
          hint={`${stats.paidOrderCount} paid orders`}
        />
        <StatCard
          label="Orders"
          value={String(stats.orderCount)}
          icon={ShoppingBag}
          hint={`${stats.pendingOrderCount} pending`}
        />
        <StatCard
          label="Customers"
          value={String(stats.customerCount)}
          icon={Users}
        />
        <StatCard
          label="Products"
          value={String(stats.productCount)}
          icon={Package}
          hint={`${stats.lowStockCount} low on stock`}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Recent orders */}
        <div className="rounded-xl border bg-background lg:col-span-2">
          <div className="flex items-center justify-between border-b p-4">
            <h2 className="flex items-center gap-2 font-semibold">
              <Clock className="size-4 text-muted-foreground" /> Recent orders
            </h2>
            <Link href="/admin/orders" className="text-sm text-primary hover:underline">
              View all
            </Link>
          </div>
          {recentOrders.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No orders yet.</p>
          ) : (
            <ul className="divide-y">
              {recentOrders.map((o) => (
                <li key={o.id}>
                  <Link
                    href={`/admin/orders/${o.orderNumber}`}
                    className="flex items-center justify-between gap-3 p-4 transition hover:bg-muted/40"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">#{o.orderNumber}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {o.user.name ?? o.user.email} · {formatDate(o.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary">{o.status}</Badge>
                      <span className="font-semibold">{formatPrice(o.total)}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Side widgets */}
        <div className="space-y-6">
          <div className="rounded-xl border bg-background">
            <div className="flex items-center gap-2 border-b p-4 font-semibold">
              <AlertTriangle className="size-4 text-amber-500" /> Low stock
            </div>
            {lowStock.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">
                Everything is well stocked.
              </p>
            ) : (
              <ul className="divide-y">
                {lowStock.map((v) => (
                  <li
                    key={v.id}
                    className="flex items-center justify-between gap-2 p-3 text-sm"
                  >
                    <span className="truncate">
                      {v.product.name}{" "}
                      <span className="text-muted-foreground">({v.weightLabel})</span>
                    </span>
                    <Badge variant={v.stock === 0 ? "destructive" : "secondary"}>
                      {v.stock} left
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border bg-background">
            <div className="border-b p-4 font-semibold">Top products</div>
            {topProducts.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No sales yet.</p>
            ) : (
              <ul className="divide-y">
                {topProducts.map((p) => (
                  <li
                    key={p.name}
                    className="flex items-center justify-between gap-2 p-3 text-sm"
                  >
                    <span className="truncate">{p.name}</span>
                    <span className="shrink-0 text-muted-foreground">
                      {p.unitsSold} sold
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
