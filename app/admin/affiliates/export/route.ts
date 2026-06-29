import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { getAdminAffiliates, type AdminAffiliateFilters } from "@/lib/queries/affiliate";
import { toCsv } from "@/lib/csv";
import { AFFILIATE_ROLE_LABEL, AFFILIATE_STATUS_LABEL } from "@/lib/affiliate/labels";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requirePermission("affiliates");
  } catch {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const sp = new URL(request.url).searchParams;
  const filters: AdminAffiliateFilters = {
    status: sp.get("status") ?? "",
    role: sp.get("role") ?? "",
    q: sp.get("q") ?? "",
  };
  const rows = await getAdminAffiliates(filters);

  const csv = toCsv(rows, [
    { header: "Code", value: (r) => r.code },
    { header: "Name", value: (r) => r.displayName },
    { header: "User", value: (r) => r.user.name ?? "" },
    { header: "Email", value: (r) => r.user.email ?? "" },
    { header: "Role", value: (r) => AFFILIATE_ROLE_LABEL[r.role] },
    { header: "Status", value: (r) => AFFILIATE_STATUS_LABEL[r.status] },
    { header: "Clicks", value: (r) => r._count.clicks },
    { header: "Orders", value: (r) => r._count.orders },
    { header: "Commissions", value: (r) => r._count.commissions },
    { header: "Joined", value: (r) => r.createdAt.toISOString() },
  ]);

  const filename = `affiliates-${new Date().toISOString().slice(0, 10)}.csv`;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
