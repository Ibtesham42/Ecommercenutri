/** Re-check with the "today" preset (local-midnight window matching event timestamps). */
import { prisma } from "@/lib/prisma";
import { trackEvent } from "@/lib/recommendations/events";
import { getRangeAnalytics } from "@/lib/queries/analytics";

const ANON = `verify2-${Date.now()}`;

async function main() {
  await trackEvent({ type: "PAGE_VIEW", anonId: ANON, device: "mobile", referrer: "instagram.com" });
  await trackEvent({ type: "PRODUCT_VIEW", anonId: ANON, device: "mobile" });
  await trackEvent({ type: "CART_ADD", anonId: ANON, device: "mobile" });
  await trackEvent({ type: "CHECKOUT_START", anonId: ANON, device: "mobile" });

  const ra = await getRangeAnalytics({ range: "today" });
  const stage = (k: string) => ra.funnel.find((s) => s.key === k);
  console.log("funnel:", ra.funnel.map((s) => `${s.key}=${s.count}${s.pending ? "(pending)" : ""}`).join(" "));
  console.log("devices:", JSON.stringify(ra.devices));
  console.log("sources:", JSON.stringify(ra.sources));
  console.log("flags:", JSON.stringify(ra.flags));
  console.log("kpis sample:", JSON.stringify(ra.kpis.filter((k) => ["visitors", "checkoutStarts", "conversion", "bounce"].includes(k.key)).map((k) => ({ k: k.key, v: k.value }))));
  const ok =
    (stage("visitors")?.count ?? 0) >= 1 &&
    (stage("checkoutStarts")?.count ?? 0) >= 1 &&
    !stage("checkoutStarts")?.pending &&
    ra.devices.some((d) => d.id === "mobile") &&
    ra.sources.some((s) => s.name === "Instagram") &&
    ra.flags.hasCheckoutData && ra.flags.hasDeviceData;
  console.log(ok ? "PASS ✅ full pipeline: track → funnel/devices/sources/flags" : "FAIL ❌");
}

main().finally(async () => {
  const del = await prisma.userEvent.deleteMany({ where: { anonId: ANON } });
  console.log(`cleanup: deleted ${del.count} synthetic events`);
  await prisma.$disconnect();
});
