import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft, Mail, Phone, MapPin, Star, Heart, Sparkles, Ticket, Megaphone,
  UserPlus, ShoppingBag, CheckCircle2, XCircle, RotateCcw, Truck, BadgeCheck,
} from "lucide-react";
import { guardSection } from "@/lib/admin-guard";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { prisma } from "@/lib/prisma";
import { formatPrice, formatDate, formatDateTime } from "@/lib/format";
import { statusLabel } from "@/lib/order-status";
import type { OrderStatus } from "@prisma/client";
import {
  customerSegment, registrationSource, initials,
  SEGMENT_LABEL, SEGMENT_BADGE_CLASS, SOURCE_LABEL,
} from "@/lib/customers/segment";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Customer", robots: { index: false } };

const GENDER_LABEL: Record<string, string> = { MALE: "Male", FEMALE: "Female", OTHER: "Other" };

/** Timeline milestone config for meaningful order events. */
const MILESTONE: Partial<Record<OrderStatus, { icon: LucideIcon; tone: string }>> = {
  SHIPPED: { icon: Truck, tone: "text-muted-foreground" },
  DELIVERED: { icon: CheckCircle2, tone: "text-primary" },
  CANCELLED: { icon: XCircle, tone: "text-destructive" },
  RETURNED: { icon: RotateCcw, tone: "text-destructive" },
  REFUNDED: { icon: RotateCcw, tone: "text-destructive" },
};

type TL = { at: Date; label: string; sub?: string; icon: LucideIcon; tone?: string; href?: string };

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  );
}

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await guardSection("customers");
  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      addresses: { orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] },
      affiliate: { select: { status: true, code: true } },
      accounts: { select: { provider: true } },
      healthQuizzes: { orderBy: { createdAt: "desc" }, take: 8, select: { score: true, createdAt: true } },
      reviews: { orderBy: { createdAt: "desc" }, take: 8, select: { createdAt: true } },
      _count: { select: { reviews: true, wishlist: true, healthQuizzes: true } },
      orders: {
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true, orderNumber: true, total: true, status: true, paymentStatus: true,
          paymentMethod: true, couponCode: true, createdAt: true,
          _count: { select: { items: true } },
          events: { select: { status: true, createdAt: true }, orderBy: { createdAt: "asc" } },
        },
      },
    },
  });
  if (!user) notFound();

  const paidOrders = user.orders.filter((o) => o.paymentStatus === "PAID");
  const spend = paidOrders.reduce((n, o) => n + o.total, 0);
  const aov = paidOrders.length ? Math.round(spend / paidOrders.length) : 0;
  const refunds = user.orders
    .filter((o) => o.paymentStatus === "REFUNDED")
    .reduce((n, o) => n + o.total, 0);
  const lastOrder = user.orders[0] ?? null;
  const couponsUsed = new Set(user.orders.map((o) => o.couponCode).filter((c): c is string => Boolean(c)));
  const latestQuiz = user.healthQuizzes[0] ?? null;
  const segment = customerSegment(spend, user.orders.length);
  const source = registrationSource({
    providers: user.accounts.map((a) => a.provider),
    phoneVerified: Boolean(user.phoneVerified),
  });
  const payMethods = [...new Set(user.orders.map((o) => (o.paymentMethod === "COD" ? "COD" : "Online")))];
  const byStatus = (s: OrderStatus[]) => user.orders.filter((o) => s.includes(o.status)).length;

  // Build the activity timeline (newest first).
  const timeline: TL[] = [{ at: user.createdAt, label: "Account created", icon: UserPlus }];
  for (const q of user.healthQuizzes)
    timeline.push({ at: q.createdAt, label: "Completed AI Assessment", sub: `Score ${q.score}/100`, icon: Sparkles, tone: "text-primary" });
  for (const r of user.reviews)
    timeline.push({ at: r.createdAt, label: "Wrote a product review", icon: Star });
  for (const o of user.orders) {
    timeline.push({
      at: o.createdAt,
      label: `Placed order #${o.orderNumber}`,
      sub: `${formatPrice(o.total)}${o.couponCode ? ` · coupon ${o.couponCode}` : ""}`,
      icon: ShoppingBag,
      href: `/admin/orders/${o.orderNumber}`,
    });
    for (const e of o.events) {
      const m = MILESTONE[e.status];
      if (m)
        timeline.push({
          at: e.createdAt,
          label: `Order #${o.orderNumber} ${statusLabel(e.status).toLowerCase()}`,
          icon: m.icon,
          tone: m.tone,
          href: `/admin/orders/${o.orderNumber}`,
        });
    }
  }
  timeline.sort((a, b) => b.at.getTime() - a.at.getTime());
  const timelineTop = timeline.slice(0, 20);

  return (
    <div>
      <Link
        href="/admin/customers"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to customers
      </Link>

      {/* Profile header */}
      <div className="mb-6 flex flex-wrap items-center gap-4 rounded-2xl border bg-card p-4 shadow-elev-1 sm:p-5">
        <Avatar size="lg" className="size-14">
          {user.image && <AvatarImage src={user.image} alt="" />}
          <AvatarFallback className="text-base font-semibold">{initials(user.name, user.email)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight">{user.name ?? "Unnamed customer"}</h1>
            <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", SEGMENT_BADGE_CLASS[segment])}>
              {SEGMENT_LABEL[segment]}
            </span>
            {user.isActive ? (
              <Badge variant="secondary" className="bg-primary/10 text-primary">Active</Badge>
            ) : (
              <Badge variant="destructive">Blocked</Badge>
            )}
            {user.affiliate && <Badge variant="outline">Affiliate</Badge>}
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><Mail className="size-3.5" />{user.email}
              {user.emailVerified && <BadgeCheck className="size-3.5 text-primary" />}</span>
            {user.phone && (
              <span className="flex items-center gap-1"><Phone className="size-3.5" />{user.phone}
                {user.phoneVerified && <BadgeCheck className="size-3.5 text-primary" />}</span>
            )}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { l: "Orders", v: String(user.orders.length) },
              { l: "Lifetime value", v: formatPrice(spend) },
              { l: "Avg. order", v: aov ? formatPrice(aov) : "—" },
              { l: "Last order", v: lastOrder ? formatDate(lastOrder.createdAt) : "—" },
            ].map((s) => (
              <div key={s.l} className="rounded-xl border bg-card p-3.5 shadow-elev-1">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{s.l}</p>
                <p className="mt-1 text-lg font-semibold tabular-nums sm:text-xl">{s.v}</p>
              </div>
            ))}
          </div>

          {/* Order status breakdown */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {[
              { l: "Pending", v: byStatus(["PENDING", "APPROVED", "PROCESSING", "PACKED", "SHIPPED", "OUT_FOR_DELIVERY"]) },
              { l: "Delivered", v: byStatus(["DELIVERED"]) },
              { l: "Cancelled", v: byStatus(["CANCELLED"]) },
              { l: "Returned", v: byStatus(["RETURNED", "REFUNDED"]) },
            ].map((s) => (
              <div key={s.l} className="rounded-lg border bg-background px-3 py-2 text-sm">
                <span className="text-muted-foreground">{s.l}</span>
                <span className="ml-2 font-semibold tabular-nums">{s.v}</span>
              </div>
            ))}
          </div>

          {/* Orders */}
          <div className="overflow-hidden rounded-xl border bg-card shadow-elev-1">
            <div className="border-b p-4 font-semibold">Orders</div>
            {user.orders.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">No orders yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead className="whitespace-nowrap">Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {user.orders.map((o) => (
                    <TableRow key={o.id} className="transition-colors hover:bg-muted/40">
                      <TableCell>
                        <Link href={`/admin/orders/${o.orderNumber}`} className="font-medium hover:text-primary">
                          #{o.orderNumber}
                        </Link>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(o.createdAt)}</TableCell>
                      <TableCell><Badge variant="secondary">{statusLabel(o.status)}</Badge></TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{formatPrice(o.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Timeline */}
          <div className="overflow-hidden rounded-xl border bg-card shadow-elev-1">
            <div className="border-b p-4 font-semibold">Activity timeline</div>
            <ol className="p-4">
              {timelineTop.map((t, i) => {
                const Icon = t.icon;
                const isLast = i === timelineTop.length - 1;
                return (
                  <li key={i} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span className="grid size-7 shrink-0 place-items-center rounded-full border bg-background">
                        <Icon className={cn("size-3.5", t.tone ?? "text-muted-foreground")} />
                      </span>
                      {!isLast && <span className="min-h-6 w-px flex-1 bg-border" />}
                    </div>
                    <div className={cn("pb-5", isLast && "pb-0")}>
                      <p className="text-sm font-medium">
                        {t.href ? (
                          <Link href={t.href} className="hover:text-primary">{t.label}</Link>
                        ) : (
                          t.label
                        )}
                      </p>
                      {t.sub && <p className="text-xs text-muted-foreground">{t.sub}</p>}
                      <p className="mt-0.5 text-xs text-muted-foreground">{formatDateTime(t.at)}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>

        <aside className="space-y-4">
          {/* Personal & account */}
          <div className="rounded-xl border bg-card p-4 text-sm shadow-elev-1">
            <p className="mb-3 text-xs font-semibold uppercase text-muted-foreground">Account</p>
            <div className="space-y-2">
              <InfoRow label="Registered">{formatDateTime(user.createdAt)}</InfoRow>
              <InfoRow label="Last active">
                {timelineTop[0] ? formatDate(timelineTop[0].at) : "—"}
              </InfoRow>
              <InfoRow label="Login method">{SOURCE_LABEL[source]}</InfoRow>
              <InfoRow label="Status">
                {user.isActive ? "Active" : <span className="text-destructive">Blocked</span>}
              </InfoRow>
              <InfoRow label="Email">{user.emailVerified ? "Verified" : "Unverified"}</InfoRow>
              <InfoRow label="Phone">
                {user.phone ? (user.phoneVerified ? "Verified" : "Unverified") : "—"}
              </InfoRow>
              {user.gender && <InfoRow label="Gender">{GENDER_LABEL[user.gender] ?? user.gender}</InfoRow>}
              {user.dob && <InfoRow label="Date of birth">{formatDate(user.dob)}</InfoRow>}
            </div>
          </div>

          {/* Financial */}
          <div className="rounded-xl border bg-card p-4 text-sm shadow-elev-1">
            <p className="mb-3 text-xs font-semibold uppercase text-muted-foreground">Financial</p>
            <div className="space-y-2">
              <InfoRow label="Lifetime value">{formatPrice(spend)}</InfoRow>
              <InfoRow label="Avg. order value">{aov ? formatPrice(aov) : "—"}</InfoRow>
              <InfoRow label="Refunded">{refunds ? formatPrice(refunds) : "—"}</InfoRow>
              <InfoRow label="Payment methods">{payMethods.length ? payMethods.join(", ") : "—"}</InfoRow>
            </div>
          </div>

          {/* Activity */}
          <div className="rounded-xl border bg-card p-4 text-sm shadow-elev-1">
            <p className="mb-3 text-xs font-semibold uppercase text-muted-foreground">Activity</p>
            <ul className="space-y-2">
              <li className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-muted-foreground"><Star className="size-4" /> Reviews</span>
                <span className="font-medium">{user._count.reviews}</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-muted-foreground"><Heart className="size-4" /> Wishlist</span>
                <span className="font-medium">{user._count.wishlist}</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-muted-foreground"><Sparkles className="size-4" /> Assessment</span>
                <span className="font-medium">
                  {latestQuiz ? `${latestQuiz.score}/100` : `${user._count.healthQuizzes} taken`}
                </span>
              </li>
              <li className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-muted-foreground"><Ticket className="size-4" /> Coupons used</span>
                <span className="font-medium">{couponsUsed.size}</span>
              </li>
            </ul>
          </div>

          {user.affiliate && (
            <div className="rounded-xl border bg-card p-4 text-sm shadow-elev-1">
              <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
                <Megaphone className="size-3.5" /> Affiliate
              </p>
              <InfoRow label="Status">
                <Badge variant={user.affiliate.status === "APPROVED" ? "default" : "secondary"}>
                  {user.affiliate.status}
                </Badge>
              </InfoRow>
              <div className="mt-2"><InfoRow label="Code">{user.affiliate.code}</InfoRow></div>
            </div>
          )}

          {/* Address book */}
          <div className="rounded-xl border bg-card p-4 text-sm shadow-elev-1">
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
              <MapPin className="size-3.5" /> Address book
            </p>
            {user.addresses.length === 0 ? (
              <p className="text-muted-foreground">No saved addresses.</p>
            ) : (
              <ul className="space-y-3">
                {user.addresses.map((a) => (
                  <li key={a.id} className="text-muted-foreground">
                    <span className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{a.fullName}</span>
                      {a.isDefault && <Badge variant="outline" className="h-4 px-1 text-[10px]">Default</Badge>}
                    </span>
                    {a.line1}
                    {a.line2 ? `, ${a.line2}` : ""}
                    <br />
                    {a.city}, {a.state} {a.pincode}, {a.country}
                    <br />
                    <span className="text-xs">{a.phone}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
