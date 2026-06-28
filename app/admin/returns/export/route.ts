import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { getAdminReturns, type ReturnFilters } from "@/lib/queries/returns";
import { toCsv } from "@/lib/csv";
import { returnStatusLabel } from "@/lib/return-status";

export const runtime = "nodejs";

/** Download the filtered returns list as CSV (same filters as the admin page). */
export async function GET(request: Request) {
  try {
    await requirePermission("returns");
  } catch {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const sp = new URL(request.url).searchParams;
  const filters: ReturnFilters = {
    status: sp.get("status") ?? "",
    q: sp.get("q") ?? "",
    from: sp.get("from") ?? "",
    to: sp.get("to") ?? "",
    paymentMethod: sp.get("paymentMethod") ?? "",
  };

  const rows = await getAdminReturns(filters);
  const csv = toCsv(rows, [
    { header: "Return #", value: (r) => r.returnNumber },
    { header: "Order #", value: (r) => r.order.orderNumber },
    { header: "Customer", value: (r) => r.user.name ?? "" },
    { header: "Email", value: (r) => r.user.email ?? "" },
    { header: "Status", value: (r) => returnStatusLabel(r.status) },
    { header: "Payment", value: (r) => r.order.paymentMethod },
    { header: "Items", value: (r) => r._count.items },
    { header: "Refund requested (Rs.)", value: (r) => (r.refundAmount / 100).toFixed(2) },
    { header: "Refunded (Rs.)", value: (r) => (r.refundedAmount / 100).toFixed(2) },
    { header: "Refund method", value: (r) => r.refundMethod ?? "" },
    { header: "Refund ref", value: (r) => r.refundRef ?? "" },
    { header: "Created", value: (r) => r.createdAt.toISOString() },
  ]);

  const filename = `returns-${new Date().toISOString().slice(0, 10)}.csv`;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
