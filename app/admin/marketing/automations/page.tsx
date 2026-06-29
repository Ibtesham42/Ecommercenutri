import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { guardSection } from "@/lib/admin-guard";
import { MarketingTabs } from "@/components/admin/marketing/marketing-tabs";
import { AutomationsManager, type AutomationRow } from "@/components/admin/marketing/automations-manager";
import { getAutomationRules } from "@/lib/queries/marketing";
import { prisma } from "@/lib/prisma";
import { isConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Automations", robots: { index: false } };

export default async function MarketingAutomationsPage() {
  await guardSection("marketing");
  const [rules, coupons] = await Promise.all([
    getAutomationRules(),
    prisma.coupon.findMany({ where: { isActive: true }, select: { id: true, code: true }, orderBy: { code: "asc" }, take: 200 }),
  ]);

  const rows: AutomationRow[] = rules.map((r) => ({
    id: r.id,
    name: r.name,
    trigger: r.trigger,
    enabled: r.enabled,
    delayHours: r.delayHours,
    channels: r.channels,
    title: r.title,
    body: r.body,
    imageUrl: r.imageUrl,
    ctaText: r.ctaText,
    ctaUrl: r.ctaUrl,
    couponId: r.couponId,
    sentCount: r.sentCount,
    lastRunAt: r.lastRunAt ? r.lastRunAt.toISOString() : null,
  }));

  return (
    <div>
      <PageHeader title="Automations" description="Trigger-based flows that send themselves" />
      <MarketingTabs />
      <AutomationsManager rules={rows} coupons={coupons} cloudinaryReady={isConfigured.cloudinary()} />
    </div>
  );
}
