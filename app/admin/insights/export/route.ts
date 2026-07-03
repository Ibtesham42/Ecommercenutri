import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { getRangeAnalytics, type RangeAnalytics } from "@/lib/queries/analytics";
import { toCsv } from "@/lib/csv";
import type { RankRow } from "@/lib/queries/bi";

export const runtime = "nodejs";

/**
 * Download the range analytics as CSV (opens cleanly in Excel — this IS the
 * "Excel export"). Default = all sections stacked; `?section=` narrows to one
 * of kpis|funnel|products|geo|sources.
 */

const rs = (paise: number) => (paise / 100).toFixed(2);

function kpisCsv(ra: RangeAnalytics): string {
  return toCsv(ra.kpis, [
    { header: "Metric", value: (k) => k.label },
    { header: "Value", value: (k) => (k.kind === "money" ? rs(k.value) : k.kind === "pct" ? `${k.value.toFixed(1)}%` : k.value) },
    { header: "Previous period", value: (k) => (k.kind === "money" ? rs(k.prev) : k.kind === "pct" ? `${k.prev.toFixed(1)}%` : k.prev) },
    { header: "Change %", value: (k) => (k.deltaPct === null ? "" : k.deltaPct.toFixed(1)) },
    { header: "Note", value: (k) => k.note ?? "" },
  ]);
}

function funnelCsv(ra: RangeAnalytics): string {
  return toCsv(ra.funnel, [
    { header: "Stage", value: (s) => s.label },
    { header: "Count", value: (s) => s.count },
    { header: "Conversion from previous %", value: (s) => (s.convPct === null ? "" : s.convPct.toFixed(1)) },
    { header: "Drop-off %", value: (s) => (s.dropPct === null ? "" : s.dropPct.toFixed(1)) },
    { header: "Change vs previous period %", value: (s) => (s.deltaPct === null ? "" : s.deltaPct.toFixed(1)) },
    { header: "Detail", value: (s) => (s.pending ? "tracking just enabled" : (s.sub ?? "")) },
  ]);
}

function rankCsv(rows: RankRow[], valueHeader: string, money = false): string {
  return toCsv(rows, [
    { header: "Name", value: (r) => r.name },
    { header: money ? `${valueHeader} (Rs.)` : valueHeader, value: (r) => (money ? rs(r.value) : r.value) },
    { header: "Detail", value: (r) => r.sub ?? "" },
  ]);
}

function productsCsv(ra: RangeAnalytics): string {
  const t = ra.topProducts;
  return [
    "Most viewed",
    rankCsv(t.mostViewed, "Views"),
    "",
    "Most added to cart",
    rankCsv(t.mostCartAdded, "Cart adds"),
    "",
    "Most purchased",
    rankCsv(t.mostPurchased, "Units"),
    "",
    "Highest revenue",
    rankCsv(t.highestRevenue, "Revenue", true),
    "",
    "Lowest conversion",
    rankCsv(t.lowestConversion, "Views"),
  ].join("\r\n");
}

function geoCsv(ra: RangeAnalytics): string {
  return [
    "Top cities",
    rankCsv(ra.geo.cities, "Revenue", true),
    "",
    "Top states",
    rankCsv(ra.geo.states, "Revenue", true),
  ].join("\r\n");
}

function sourcesCsv(ra: RangeAnalytics): string {
  return [
    "Devices",
    rankCsv(ra.devices, "Visitors"),
    "",
    "Traffic sources",
    rankCsv(ra.sources, "Visits"),
    "",
    "Cart recovery",
    toCsv([ra.recovery], [
      { header: "Abandoned-cart messages", value: (r) => r.logs },
      { header: "Recovered carts", value: (r) => r.recoveredCarts },
      { header: "Recovered revenue (Rs.)", value: (r) => rs(r.recoveredRevenue) },
    ]),
  ].join("\r\n");
}

export async function GET(request: Request) {
  try {
    await requirePermission("ai");
  } catch {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const sp = new URL(request.url).searchParams;
  const ra = await getRangeAnalytics({
    range: sp.get("range") ?? undefined,
    from: sp.get("from") ?? undefined,
    to: sp.get("to") ?? undefined,
  });
  const section = sp.get("section") ?? "";

  const sections: Record<string, () => string> = {
    kpis: () => kpisCsv(ra),
    funnel: () => funnelCsv(ra),
    products: () => productsCsv(ra),
    geo: () => geoCsv(ra),
    sources: () => sourcesCsv(ra),
  };

  const body =
    section && sections[section]
      ? sections[section]()
      : [
          `Nutriyet analytics — ${ra.range.label}`,
          "",
          "KEY METRICS",
          kpisCsv(ra),
          "",
          "CONVERSION FUNNEL",
          funnelCsv(ra),
          "",
          "TOP PRODUCTS",
          productsCsv(ra),
          "",
          "GEOGRAPHY",
          geoCsv(ra),
          "",
          "DEVICES, SOURCES & RECOVERY",
          sourcesCsv(ra),
        ].join("\r\n");

  const filename = `analytics-${ra.range.key}-${new Date().toISOString().slice(0, 10)}.csv`;
  // UTF-8 BOM so Excel renders the file correctly.
  return new NextResponse(`﻿${body}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
