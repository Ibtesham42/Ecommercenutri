import "server-only";
import { generateText } from "ai";
import { getModel, aiAvailable } from "@/lib/ai/provider";
import { getAISettings } from "@/lib/ai/settings";
import { formatPrice } from "@/lib/format";
import type { BusinessIntelligence } from "@/lib/queries/bi";
import type { RangeAnalytics } from "@/lib/queries/analytics";
import type { JourneyAnalytics, JourneyStage } from "@/lib/queries/journey";
import type { HeatmapAnalytics, HeatSection, RageIssue } from "@/lib/queries/engagement";
import { notEnoughDataMessage } from "@/lib/analytics-confidence";

export type AiText = { text: string; ai: boolean };

const sign = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(0)}%`;

/** Range-scoped fact lines (funnel + KPIs + breakdowns) appended when available. */
function rangeFacts(ra: RangeAnalytics): string[] {
  const kpi = (key: string) => ra.kpis.find((k) => k.key === key);
  const lines: string[] = [`--- Selected period: ${ra.range.label} ---`];
  if (ra.funnel.length) {
    lines.push(
      `Funnel: ${ra.funnel
        .map((s) => `${s.label} ${s.count}${s.convPct !== null ? ` (${s.convPct.toFixed(0)}% of previous)` : ""}${s.pending ? " [tracking new]" : ""}`)
        .join(" → ")}.`,
    );
  }
  const conv = kpi("conversion");
  const bounce = kpi("bounce");
  const abandon = kpi("abandonment");
  if (conv) lines.push(`Conversion rate ${conv.value.toFixed(1)}%; cart abandonment ${abandon?.value.toFixed(0) ?? "?"}%; bounce ${bounce?.value.toFixed(0) ?? "?"}%.`);
  const newC = kpi("newCustomers");
  const repeatC = kpi("repeatCustomers");
  if (newC || repeatC) lines.push(`Customers this period: ${newC?.value ?? 0} new, ${repeatC?.value ?? 0} repeat.`);
  if (ra.geo.cities.length) lines.push(`Top cities: ${ra.geo.cities.map((c) => `${c.name} (${formatPrice(c.value)})`).join(", ")}.`);
  if (ra.devices.length) lines.push(`Devices: ${ra.devices.map((d) => `${d.name} ${d.value}`).join(", ")}.`);
  if (ra.sources.length) lines.push(`Traffic sources (visits): ${ra.sources.map((s) => `${s.name} ${s.value}`).join(", ")}.`);
  if (ra.topProducts.lowestConversion.length) {
    lines.push(`Weak converters (views vs sales): ${ra.topProducts.lowestConversion.map((p) => `${p.name} (${p.sub})`).join("; ")}.`);
  }
  if (ra.recovery.logs > 0) {
    lines.push(`Abandoned-cart messages sent: ${ra.recovery.logs}; recovered ${ra.recovery.recoveredCarts} carts worth ${formatPrice(ra.recovery.recoveredRevenue)}.`);
  }
  return lines;
}

/** Compact, ₹-formatted fact sheet used to ground the AI (so it can't invent data). */
function facts(bi: BusinessIntelligence, ra?: RangeAnalytics): string {
  const s = bi.summary;
  const lines = [
    `Today: ${formatPrice(s.today.revenue)} from ${s.today.orders} orders.`,
    `This week: ${formatPrice(s.week.revenue)} (${sign(s.week.revenueGrowth)} vs last week) from ${s.week.orders} orders (${sign(s.week.orderGrowth)}).`,
    `This month: ${formatPrice(s.month.revenue)} (${sign(s.month.revenueGrowth)} vs prev) from ${s.month.orders} orders.`,
    `This year: ${formatPrice(s.year.revenue)} from ${s.year.orders} orders.`,
    `Month forecast (run-rate): ${formatPrice(bi.forecast.monthProjected)} (${formatPrice(bi.forecast.monthSoFar)} so far, day ${bi.forecast.daysElapsed}/${bi.forecast.daysInMonth}).`,
    `Customers: ${bi.customers.total} total, ${bi.customers.withOrders} with orders, ${bi.customers.new} new (30d), ${bi.customers.returning} returning, ${bi.customers.inactive} inactive, ${bi.customers.highValue} high-value. Repeat rate ${bi.customers.repeatRate.toFixed(0)}%.`,
    `Top customers: ${bi.customers.topCustomers.map((c) => `${c.name} (${formatPrice(c.value)})`).join(", ") || "none"}.`,
    `Trending products: ${bi.products.trending.map((p) => p.name).join(", ") || "none"}. Declining: ${bi.products.declining.map((p) => p.name).join(", ") || "none"}.`,
    `Best-selling categories (30d units): ${bi.products.bestByCategory.map((c) => `${c.name} ${c.value}`).join(", ") || "none"}.`,
    `Worth advertising (high views, low sales): ${bi.products.promote.map((p) => p.name).join(", ") || "none"}.`,
    `Inventory: ${bi.inventory.outOfStock} out of stock, ${bi.inventory.lowStock} low. Predicted stockouts: ${bi.inventory.predictedStockouts.map((v) => `${v.name} (~${v.daysLeft}d)`).join(", ") || "none"}.`,
    `Cart abandonment: ~${bi.cart.abandonmentRate.toFixed(0)}% (${bi.cart.cartAdds30d} cart-adds, ${bi.cart.purchases30d} purchases, ${bi.cart.abandonedCarts} active carts).`,
    `Affiliates: ${bi.affiliates.active} active drove ${formatPrice(bi.affiliates.revenue90d)} in 90d. Top: ${bi.affiliates.top.map((a) => a.name).join(", ") || "none"}.`,
    `Campaigns: ${bi.campaigns.sent} sent, open ${bi.campaigns.openRate.toFixed(0)}%, click ${bi.campaigns.clickRate.toFixed(0)}%, ${bi.campaigns.conversions} conversions, ${formatPrice(bi.campaigns.revenue)} revenue.`,
    `Refunds (30d): ${bi.refunds.count30d} (${bi.refunds.rate.toFixed(0)}% of orders), ${formatPrice(bi.refunds.amount30d)}.`,
    `Best time to promote: ${bi.bestTime.day} around ${bi.bestTime.hour}.`,
    `Active alerts: ${bi.alerts.map((a) => a.title).join(", ")}.`,
  ];
  if (ra) lines.push(...rangeFacts(ra));
  return lines.join("\n");
}

/** Deterministic fallback summary when AI is unavailable. */
function templateSummary(bi: BusinessIntelligence): string {
  const w = bi.summary.week;
  const parts: string[] = [];
  parts.push(
    `This week you made ${formatPrice(w.revenue)} from ${w.orders} orders — revenue ${w.revenueGrowth >= 0 ? "up" : "down"} ${Math.abs(w.revenueGrowth).toFixed(0)}% vs last week.`,
  );
  parts.push(`At the current pace this month is on track for about ${formatPrice(bi.forecast.monthProjected)}.`);
  if (bi.cart.abandonmentRate >= 50 && bi.cart.cartAdds30d >= 10) {
    parts.push(`Cart abandonment is ~${bi.cart.abandonmentRate.toFixed(0)}% — a recovery campaign could win back sales.`);
  } else if (bi.inventory.predictedStockouts.length) {
    parts.push(`${bi.inventory.predictedStockouts.length} product(s) will sell out within two weeks — restock soon.`);
  } else if (bi.products.promote.length) {
    parts.push(`${bi.products.promote[0].name} gets lots of views but few sales — worth promoting.`);
  }
  return parts.join(" ");
}

export async function generateBusinessSummary(bi: BusinessIntelligence): Promise<AiText> {
  if (!aiAvailable()) return { text: templateSummary(bi), ai: false };
  const settings = await getAISettings();
  const model = getModel(settings.model);
  if (!model) return { text: templateSummary(bi), ai: false };
  try {
    const { text } = await generateText({
      model,
      temperature: 0.4,
      system:
        "You are a sharp retail business analyst for Nutriyet, an Indian nutrition store. Using ONLY the facts provided, write a concise 2-4 sentence summary of how the business is doing this week, calling out the most important change and exactly ONE specific, actionable recommendation. Use the real numbers. Do not invent data or use markdown.",
      prompt: facts(bi),
    });
    const clean = text.trim();
    return clean ? { text: clean, ai: true } : { text: templateSummary(bi), ai: false };
  } catch (e) {
    console.error("[ai/insights] summary failed:", e);
    return { text: templateSummary(bi), ai: false };
  }
}

/** Keyword-routed deterministic answer when AI is unavailable. */
function templateAnswer(question: string, bi: BusinessIntelligence): string {
  const q = question.toLowerCase();
  if (/restock|stock|inventory|out of stock|sold out/.test(q)) {
    const list = bi.inventory.predictedStockouts;
    return list.length
      ? `Restock soon: ${list.map((v) => `${v.name} (~${v.daysLeft} days left, ${v.stock} in stock)`).join("; ")}.`
      : `No items are predicted to run out within two weeks. ${bi.inventory.outOfStock} variant(s) are already out of stock.`;
  }
  if (/advertis|promote|market|ad /.test(q)) {
    return bi.products.promote.length
      ? `Consider advertising: ${bi.products.promote.map((p) => `${p.name} (${p.sub})`).join("; ")} — high interest, low conversion.`
      : `Trending products you could push: ${bi.products.trending.map((p) => p.name).join(", ") || "none yet"}.`;
  }
  if (/top customer|best customer|vip|high value|loyal/.test(q)) {
    return `Top customers by spend: ${bi.customers.topCustomers.map((c) => `${c.name} (${formatPrice(c.value)}, ${c.sub})`).join("; ") || "none yet"}.`;
  }
  if (/categor/.test(q)) {
    const top = bi.products.bestByCategory[0];
    return top
      ? `Best-selling category (last 30 days by units) is ${top.name} (${top.value} units). Full ranking: ${bi.products.bestByCategory.map((c) => `${c.name} ${c.value}`).join(", ")}.`
      : `No category sales in the last 30 days yet.`;
  }
  if (/why.*(down|decrease|drop|fell|less)|sales (down|drop)/.test(q)) {
    const w = bi.summary.week;
    const reasons = [];
    if (w.revenueGrowth < 0) reasons.push(`weekly revenue is down ${Math.abs(w.revenueGrowth).toFixed(0)}%`);
    if (bi.cart.abandonmentRate >= 50) reasons.push(`cart abandonment is high (~${bi.cart.abandonmentRate.toFixed(0)}%)`);
    if (bi.inventory.outOfStock > 0) reasons.push(`${bi.inventory.outOfStock} item(s) are out of stock`);
    if (bi.refunds.rate >= 10) reasons.push(`refund rate is ${bi.refunds.rate.toFixed(0)}%`);
    return reasons.length
      ? `Likely factors: ${reasons.join("; ")}. ${bi.products.declining.length ? `Declining products: ${bi.products.declining.map((p) => p.name).join(", ")}.` : ""}`
      : `Sales look stable — weekly revenue is ${sign(w.revenueGrowth)} vs last week.`;
  }
  if (/forecast|predict|next month|projection/.test(q)) {
    return `At the current run-rate this month should reach about ${formatPrice(bi.forecast.monthProjected)} (${formatPrice(bi.forecast.monthSoFar)} so far).`;
  }
  if (/best time|when.*promot|what day|which day/.test(q)) {
    return `Your strongest sales window is ${bi.bestTime.day} around ${bi.bestTime.hour} — a good time to launch promotions.`;
  }
  return `Here's a snapshot: this week ${formatPrice(bi.summary.week.revenue)} (${sign(bi.summary.week.revenueGrowth)}), ${bi.summary.week.orders} orders, repeat rate ${bi.customers.repeatRate.toFixed(0)}%, cart abandonment ~${bi.cart.abandonmentRate.toFixed(0)}%. Ask about restocking, advertising, top customers, categories, or why sales changed.`;
}

export type ActionItem = { title: string; why: string; action: string };
export type ActionPlan = { items: ActionItem[]; ai: boolean };

/**
 * Rule-based action plan from real numbers — the keyless fallback, and the
 * safety net when the model returns unparsable JSON. Candidates are ordered by
 * severity; top 3-5 are returned.
 */
function templateActionPlan(bi: BusinessIntelligence, ra: RangeAnalytics): ActionItem[] {
  const items: ActionItem[] = [];
  const kpi = (key: string) => ra.kpis.find((k) => k.key === key);

  // 1. Biggest funnel drop between adjacent stages with a meaningful base.
  const drops = ra.funnel
    .map((s, i) => ({ s, prev: i > 0 ? ra.funnel[i - 1] : null }))
    .filter((x): x is { s: (typeof ra.funnel)[0]; prev: (typeof ra.funnel)[0] } =>
      !!x.prev && !x.s.pending && x.s.dropPct !== null && x.prev.count >= 10 && x.s.dropPct >= 60,
    )
    .sort((a, b) => (b.s.dropPct ?? 0) - (a.s.dropPct ?? 0));
  const worst = drops[0];
  if (worst) {
    const between = `${worst.prev.label} → ${worst.s.label}`;
    const why = `Only ${worst.s.count} of ${worst.prev.count} shoppers made it from ${worst.prev.label.toLowerCase()} to ${worst.s.label.toLowerCase()} (${worst.s.dropPct!.toFixed(0)}% drop) in ${ra.range.label.toLowerCase()}.`;
    if (worst.s.key === "cartAdds") {
      items.push({ title: `Fix the ${between} drop`, why, action: "Strengthen product pages: sharper images, clearer benefits, reviews near the price, and show the free-delivery threshold." });
    } else if (worst.s.key === "checkoutStarts" || worst.s.key === "orders") {
      items.push({ title: `Fix the ${between} drop`, why, action: "Surface the free-shipping threshold and trust badges in the cart, keep checkout to one screen, and enable the abandoned-cart automation in Marketing → Automations." });
    } else {
      items.push({ title: `Fix the ${between} drop`, why, action: "Feature best sellers and categories on the homepage so visitors reach product pages faster." });
    }
  }

  // 2. Predicted stockouts.
  if (bi.inventory.predictedStockouts.length) {
    const list = bi.inventory.predictedStockouts.slice(0, 3);
    items.push({
      title: "Restock before you sell out",
      why: `${list.map((v) => `${v.name} (~${v.daysLeft}d left)`).join(", ")} will run out at the current pace.`,
      action: "Reorder these now — stockouts on movers directly cut revenue.",
    });
  }

  // 3. Worst converter with real interest.
  const weak = ra.topProducts.lowestConversion[0];
  if (weak) {
    items.push({
      title: `Improve ${weak.name}`,
      why: `It attracted interest but barely sold (${weak.sub}) in ${ra.range.label.toLowerCase()}.`,
      action: "Refresh its images and description, add reviews, or trial a small price cut / combo offer.",
    });
  }

  // 4. Abandonment with no recovery automation running.
  const abandon = kpi("abandonment");
  if (ra.recovery.logs === 0 && (abandon?.value ?? 0) >= 50 && (kpi("cartAdds")?.value ?? 0) >= 5) {
    items.push({
      title: "Turn on abandoned-cart recovery",
      why: `${abandon!.value.toFixed(0)}% of cart adders didn't order and no recovery messages went out this period.`,
      action: "Enable the Abandoned cart automation (Marketing → Automations) with a gentle reminder and a small coupon.",
    });
  }

  // 5. Falling revenue → win-back.
  if (bi.summary.week.revenueGrowth <= -15) {
    items.push({
      title: "Run a win-back campaign",
      why: `Weekly revenue is down ${Math.abs(bi.summary.week.revenueGrowth).toFixed(0)}% and ${bi.customers.inactive} past customers are inactive.`,
      action: `Send a win-back campaign with a limited-time coupon; your best window is ${bi.bestTime.day} around ${bi.bestTime.hour}.`,
    });
  }

  // 6. Channel concentration.
  const sourced = ra.sources.filter((s) => s.name !== "Direct");
  const totalSourced = sourced.reduce((n, s) => n + s.value, 0);
  if (totalSourced >= 10 && sourced[0] && sourced[0].value / totalSourced >= 0.6) {
    items.push({
      title: `Diversify beyond ${sourced[0].name}`,
      why: `${((sourced[0].value / totalSourced) * 100).toFixed(0)}% of referred visits come from ${sourced[0].name} alone.`,
      action: "Test one more channel this week (WhatsApp broadcast, Google Business posts, or a second social platform).",
    });
  }

  // Pad with promotion ideas so there are always ≥3 concrete suggestions.
  if (items.length < 3 && bi.products.trending[0]) {
    items.push({
      title: `Promote ${bi.products.trending[0].name}`,
      why: `It's your fastest riser (${bi.products.trending[0].sub}).`,
      action: `Feature it on the homepage and in a campaign on ${bi.bestTime.day} around ${bi.bestTime.hour}.`,
    });
  }
  if (items.length < 3 && bi.products.promote[0]) {
    items.push({
      title: `Advertise ${bi.products.promote[0].name}`,
      why: `High interest, low sales (${bi.products.promote[0].sub}).`,
      action: "Run a small story/campaign spotlight with a first-order coupon.",
    });
  }
  if (items.length < 3) {
    items.push({
      title: "Grow your audience",
      why: "The store has headroom — more qualified visitors lift every funnel stage.",
      action: "Post product stories consistently and share referral links via the affiliate program.",
    });
  }
  return items.slice(0, 5);
}

/** Defensive JSON extraction for the model's action-plan output. */
function parseActionItems(raw: string): ActionItem[] | null {
  try {
    const stripped = raw.replace(/```json|```/g, "").trim();
    const start = stripped.indexOf("{");
    const end = stripped.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    const parsed = JSON.parse(stripped.slice(start, end + 1)) as { items?: unknown };
    if (!Array.isArray(parsed.items)) return null;
    const items = parsed.items
      .filter(
        (x): x is ActionItem =>
          !!x &&
          typeof (x as ActionItem).title === "string" &&
          typeof (x as ActionItem).why === "string" &&
          typeof (x as ActionItem).action === "string",
      )
      .map((x) => ({
        title: x.title.slice(0, 120),
        why: x.why.slice(0, 300),
        action: x.action.slice(0, 300),
      }));
    return items.length >= 3 ? items.slice(0, 5) : null;
  } catch {
    return null;
  }
}

/**
 * 3-5 practical, data-grounded recommendations for the admin ("what should I do
 * this week?"). AI when configured (generateText + JSON parse — Groq has no
 * json_schema support), always falling back to the rule engine.
 */
export async function generateActionPlan(
  bi: BusinessIntelligence,
  ra: RangeAnalytics,
): Promise<ActionPlan> {
  const fallback = () => ({ items: templateActionPlan(bi, ra), ai: false });
  if (!aiAvailable()) return fallback();
  const settings = await getAISettings();
  const model = getModel(settings.model);
  if (!model) return fallback();
  try {
    const { text } = await generateText({
      model,
      temperature: 0.4,
      system:
        'You are a growth consultant for Nutriyet, an Indian nutrition e-commerce store. Using ONLY the facts provided, return STRICT JSON of the form {"items":[{"title":"...","why":"...","action":"..."}]} with 3 to 5 items, ordered by impact. Each "why" must cite a real number from the facts; each "action" must be ONE concrete step the admin can take this week inside the store (a campaign, restock, price/imagery change, coupon, free-shipping nudge, automation). No markdown, no text outside the JSON.',
      prompt: facts(bi, ra),
    });
    const items = parseActionItems(text);
    return items ? { items, ai: true } : fallback();
  } catch (e) {
    console.error("[ai/insights] action plan failed:", e);
    return fallback();
  }
}

// ---------- Customer Journey diagnosis ----------

const fmtDur = (ms: number) =>
  ms >= 60_000 ? `${Math.round(ms / 60_000)}m` : `${Math.max(1, Math.round(ms / 1000))}s`;

function journeyFacts(j: JourneyAnalytics): string {
  const lines = [
    `Customer journey (${j.range.label}${j.filtered ? ", filtered" : ""}; ${j.totalSessions} sessions):`,
  ];
  for (const s of j.stages) {
    if (s.pending) continue;
    lines.push(
      `${s.label}: ${s.users} users` +
        (s.convPct !== null ? `, ${s.convPct.toFixed(0)}% conversion (${s.dropPct!.toFixed(0)}% drop-off)` : "") +
        (s.exitPct !== null ? `, ${s.exitPct.toFixed(0)}% exit here` : "") +
        (s.avgTimeMs !== null ? `, avg ${fmtDur(s.avgTimeMs)} to next step` : "") +
        (s.deltaPct !== null ? `, ${s.deltaPct >= 0 ? "+" : ""}${s.deltaPct.toFixed(0)}% vs previous period` : ""),
    );
  }
  return lines.join("\n");
}

/** Stage-specific fix suggestions for the deterministic fallback. */
const STAGE_ADVICE: Partial<Record<JourneyStage["key"], string>> = {
  home: "Feature best sellers, categories and the free-delivery threshold above the fold so visitors move into the catalog faster.",
  category: "Tighten category pages: clear filters, in-stock first, and strong product imagery.",
  product: "Strengthen product pages — sharper photos, benefits up top, reviews near the price, and a visible delivery estimate.",
  search: "Check the top searches report for queries returning weak results and add synonyms or products.",
  cartAdd: "Make Add to Cart more prominent and show savings + the free-shipping progress right in the card/page.",
  checkoutStart: "Reduce cart friction: sticky checkout CTA, trust badges, and the free-delivery nudge in the cart summary.",
  payment: "Keep checkout to one screen and offer COD where eligible; surface delivery time before payment.",
  orderSuccess: "Investigate payment failures — offer COD/UPI alternatives and make errors recoverable.",
  returning: "Run win-back and post-purchase automations (Marketing → Automations) and a loyalty coupon to bring buyers back.",
};

function templateJourneyDiagnosis(j: JourneyAnalytics): string {
  const real = j.stages.filter((s) => !s.pending && s.convPct !== null && !s.optional);
  const meaningful = real.filter((s) => s.dropPct !== null && s.dropPct >= 40 && s.users + 1 >= 1);
  const bases = new Map(j.stages.map((s, i) => [s.key, i > 0 ? j.stages[i - 1] : null]));
  const worst = [...meaningful].sort((a, b) => (b.dropPct ?? 0) - (a.dropPct ?? 0)).slice(0, 2);
  if (j.totalSessions === 0) {
    return "No shopper sessions in this period yet — the journey fills in as visitors browse. Data for the new stages (homepage, payment) starts collecting from this release onward.";
  }
  if (worst.length === 0) {
    return `Healthy funnel this period: no stage is losing more than 40% of shoppers. ${j.totalSessions} sessions tracked — keep feeding the top of the funnel.`;
  }
  const parts = worst.map((s) => {
    const prev = bases.get(s.key);
    const from = prev ? prev.label.toLowerCase() : "the previous step";
    return `Biggest leak: only ${s.convPct!.toFixed(0)}% of shoppers get from ${from} to ${s.label.toLowerCase()} (${s.dropPct!.toFixed(0)}% drop${s.exitPct !== null ? `, ${s.exitPct.toFixed(0)}% leave the site there` : ""}). ${STAGE_ADVICE[s.key] ?? "Review this step for friction."}`;
  });
  return parts.join(" ");
}

/** AI (or rule-based) diagnosis of where the journey leaks and what to do. */
export async function generateJourneyDiagnosis(j: JourneyAnalytics): Promise<AiText> {
  // Withhold recommendations until the sample is statistically meaningful.
  if (!j.confidence.ok) {
    return { text: notEnoughDataMessage("journey", j.confidence.sessions, j.confidence.min), ai: false };
  }
  const fallback = () => ({ text: templateJourneyDiagnosis(j), ai: false });
  if (j.totalSessions === 0 || !aiAvailable()) return fallback();
  const settings = await getAISettings();
  const model = getModel(settings.model);
  if (!model) return fallback();
  try {
    const { text } = await generateText({
      model,
      temperature: 0.4,
      system:
        "You are a conversion-rate expert for Nutriyet, an Indian nutrition e-commerce store. Using ONLY the funnel facts provided, identify the 1-2 stages where shoppers drop off the most and give ONE concrete, store-level fix per stage (imagery, copy, coupons, free-shipping nudges, checkout friction, automations). 2-4 sentences total, cite the real numbers, no markdown.",
      prompt: journeyFacts(j),
    });
    const clean = text.trim();
    return clean ? { text: clean, ai: true } : fallback();
  } catch (e) {
    console.error("[ai/insights] journey diagnosis failed:", e);
    return fallback();
  }
}

// ---------- Heatmap + rage-click insights ----------

function heatFacts(h: HeatmapAnalytics, rage: RageIssue[]): string {
  const lines = [`Section engagement (${h.rangeLabel}); score is 0-100 relative to the best section:`];
  for (const s of h.sections) {
    // Only feed the model sections with a real (confident) score — low-sample
    // sections have a null score and would otherwise leak "score null" into the
    // prompt (and the model would repeat it).
    if (s.score === null) continue;
    lines.push(
      `${s.label}: score ${s.score}, ${s.views} impressions, ${s.clicks} clicks (${s.clickRate.toFixed(1)}% click rate), ${s.hovers} hovers, ${s.taps} mobile taps, avg ${fmtDur(s.avgTimeMs)} in view.`,
    );
  }
  for (const p of h.pages.slice(0, 5)) {
    lines.push(
      `${p.label}: ${p.visits} visits, avg ${fmtDur(p.avgTimeMs)} on page, scroll reach 50%: ${p.scroll50.toFixed(0)}% of visits, full scroll: ${p.scroll100.toFixed(0)}%.`,
    );
  }
  if (rage.length) {
    lines.push(
      `Rage clicks (frustrated repeated clicking): ${rage
        .slice(0, 5)
        .map((i) => `${i.label} on ${i.path} (${i.count}x by ${i.sessions} shoppers)`)
        .join("; ")}.`,
    );
  }
  return lines.join("\n");
}

function templateHeatmapInsights(h: HeatmapAnalytics, rage: RageIssue[]): string {
  // Only sections that cleared the significance floor carry a score.
  const scored = h.sections.filter((s): s is HeatSection & { score: number } => s.score !== null);
  if (scored.length === 0) {
    return "Engagement tracking just went live — section scores appear here once sections gather enough views to be reliable. Check back after some traffic.";
  }
  const best = scored[0];
  const worst = [...scored].reverse().find((s) => s.key !== best.key);
  const parts = [
    `${best.label} is your most engaging section (score ${best.score}, ${best.clickRate.toFixed(1)}% click rate) — keep your strongest offers there.`,
  ];
  if (worst && worst.score <= 40) {
    parts.push(
      `${worst.label} underperforms (score ${worst.score} from ${worst.views} impressions) — try stronger visuals, tighter copy or moving it higher on the page.`,
    );
  }
  const lowScroll = h.pages.find((p) => p.visits >= 10 && p.scroll50 < 40);
  if (lowScroll) {
    parts.push(
      `On ${lowScroll.label.toLowerCase()}, only ${lowScroll.scroll50.toFixed(0)}% of visitors scroll past halfway — put key content and CTAs above the fold.`,
    );
  }
  if (rage[0]) {
    parts.push(
      `Shoppers rage-clicked "${rage[0].label}" on ${rage[0].path} ${rage[0].count} times — it likely looks clickable but responds slowly or not at all; check its disabled/loading states.`,
    );
  }
  return parts.join(" ");
}

/** AI (or rule-based) read of the heatmap: best/worst sections + UI/CTA fixes. */
export async function generateHeatmapInsights(
  h: HeatmapAnalytics,
  rage: RageIssue[],
): Promise<AiText> {
  // Withhold recommendations until enough section impressions are collected.
  if (!h.confidence.ok) {
    return { text: notEnoughDataMessage("heatmap", h.confidence.impressions, h.confidence.min), ai: false };
  }
  const fallback = () => ({ text: templateHeatmapInsights(h, rage), ai: false });
  if (!h.hasData || !aiAvailable()) return fallback();
  const settings = await getAISettings();
  const model = getModel(settings.model);
  if (!model) return fallback();
  try {
    const { text } = await generateText({
      model,
      temperature: 0.4,
      system:
        "You are a UX analyst for Nutriyet, an Indian nutrition e-commerce store. Using ONLY the engagement facts provided, name the best-performing section, the weakest section, and give 2 specific UI/CTA improvements (placement, copy, size, contrast, loading states). If rage clicks are listed, explain the likely UX issue behind the top one. 3-5 sentences, cite real numbers, no markdown.",
      prompt: heatFacts(h, rage),
    });
    const clean = text.trim();
    return clean ? { text: clean, ai: true } : fallback();
  } catch (e) {
    console.error("[ai/insights] heatmap insights failed:", e);
    return fallback();
  }
}

export async function answerBusinessQuestion(question: string, bi: BusinessIntelligence): Promise<AiText> {
  const q = question.trim();
  if (!q) return { text: "Ask a question about your sales, products, customers, inventory or marketing.", ai: false };
  if (!aiAvailable()) return { text: templateAnswer(q, bi), ai: false };
  const settings = await getAISettings();
  const model = getModel(settings.model);
  if (!model) return { text: templateAnswer(q, bi), ai: false };
  try {
    const { text } = await generateText({
      model,
      temperature: 0.3,
      system:
        "You are the business-intelligence assistant for a Nutriyet store admin. Answer the admin's question using ONLY the facts below. Be concise (1-3 sentences), specific with the real numbers, and practical. If the facts don't contain the answer, say what's missing. No markdown.\n\nFACTS:\n" +
        facts(bi),
      prompt: q,
    });
    const clean = text.trim();
    return clean ? { text: clean, ai: true } : { text: templateAnswer(q, bi), ai: false };
  } catch (e) {
    console.error("[ai/insights] answer failed:", e);
    return { text: templateAnswer(q, bi), ai: false };
  }
}
