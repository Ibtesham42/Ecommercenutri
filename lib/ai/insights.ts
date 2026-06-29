import "server-only";
import { generateText } from "ai";
import { getModel, aiAvailable } from "@/lib/ai/provider";
import { getAISettings } from "@/lib/ai/settings";
import { formatPrice } from "@/lib/format";
import type { BusinessIntelligence } from "@/lib/queries/bi";

export type AiText = { text: string; ai: boolean };

const sign = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(0)}%`;

/** Compact, ₹-formatted fact sheet used to ground the AI (so it can't invent data). */
function facts(bi: BusinessIntelligence): string {
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
