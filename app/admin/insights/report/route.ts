import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { getRangeAnalytics, type RangeAnalytics } from "@/lib/queries/analytics";
import { renderAnalyticsReportBuffer, type AnalyticsReportData } from "@/lib/pdf/analytics-pdf";
import { getStoreSettings } from "@/lib/queries/settings";
import type { RankRow } from "@/lib/queries/bi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const rs = (paise: number) =>
  "Rs. " + (paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const nf = new Intl.NumberFormat("en-IN");

function rank(rows: RankRow[], money = false) {
  return rows.map((r) => ({
    name: r.name,
    value: money ? rs(r.value) : nf.format(r.value),
    detail: r.sub ?? "",
  }));
}

function reportData(ra: RangeAnalytics, storeName: string): AnalyticsReportData {
  return {
    storeName,
    rangeLabel: ra.range.label,
    generatedAt: new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }),
    kpis: ra.kpis.map((k) => ({
      label: k.label,
      value: k.kind === "money" ? rs(k.value) : k.kind === "pct" ? `${k.value.toFixed(1)}%` : nf.format(k.value),
      delta: k.deltaPct === null ? "—" : `${k.deltaPct >= 0 ? "+" : ""}${k.deltaPct.toFixed(0)}%`,
      note: k.note ?? "",
    })),
    funnel: ra.funnel.map((f) => ({
      stage: f.label,
      count: nf.format(f.count),
      conv: f.convPct === null ? "—" : `${f.convPct.toFixed(0)}%`,
      drop: f.dropPct === null ? "" : `-${f.dropPct.toFixed(0)}%`,
      delta: f.pending ? "(tracking new)" : f.deltaPct === null ? "" : `(${f.deltaPct >= 0 ? "+" : ""}${f.deltaPct.toFixed(0)}% vs prev)`,
    })),
    productSections: [
      { title: "Most viewed products", rows: rank(ra.topProducts.mostViewed) },
      { title: "Most added to cart", rows: rank(ra.topProducts.mostCartAdded) },
      { title: "Most purchased", rows: rank(ra.topProducts.mostPurchased) },
      { title: "Highest revenue", rows: rank(ra.topProducts.highestRevenue, true) },
      { title: "Lowest conversion", rows: rank(ra.topProducts.lowestConversion) },
    ],
    geoSections: [
      { title: "Top cities", rows: rank(ra.geo.cities, true) },
      { title: "Top states", rows: rank(ra.geo.states, true) },
      { title: "Devices", rows: rank(ra.devices) },
      { title: "Traffic sources", rows: rank(ra.sources) },
    ],
    recovery: [
      { label: "Abandoned-cart messages", value: nf.format(ra.recovery.logs) },
      { label: "Recovered carts", value: nf.format(ra.recovery.recoveredCarts) },
      { label: "Recovered revenue", value: rs(ra.recovery.recoveredRevenue) },
    ],
  };
}

/** Range analytics as a downloadable PDF report. */
export async function GET(request: Request) {
  try {
    await requirePermission("ai");
  } catch {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const sp = new URL(request.url).searchParams;
  const [ra, settings] = await Promise.all([
    getRangeAnalytics({
      range: sp.get("range") ?? undefined,
      from: sp.get("from") ?? undefined,
      to: sp.get("to") ?? undefined,
    }),
    getStoreSettings().catch(() => null),
  ]);

  const pdf = await renderAnalyticsReportBuffer(reportData(ra, settings?.siteName ?? "Nutriyet"));
  const filename = `analytics-report-${ra.range.key}-${new Date().toISOString().slice(0, 10)}.pdf`;
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
