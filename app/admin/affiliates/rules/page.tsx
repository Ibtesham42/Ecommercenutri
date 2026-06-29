import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { guardSection } from "@/lib/admin-guard";
import { AffiliateTabs } from "@/components/admin/affiliate-tabs";
import { CommissionRulesManager } from "@/components/admin/commission-rules-manager";
import { getCommissionRules } from "@/lib/queries/affiliate";
import { getAffiliateSettings } from "@/lib/queries/settings";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/format";

export const metadata: Metadata = { title: "Commission rules", robots: { index: false } };

export default async function CommissionRulesPage() {
  await guardSection("affiliates");
  const [rules, products, categories, settings] = await Promise.all([
    getCommissionRules(),
    prisma.product.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    getAffiliateSettings(),
  ]);

  const defaultLabel =
    settings.affiliateDefaultCommissionType === "PERCENT"
      ? `${settings.affiliateDefaultCommissionValue}%`
      : formatPrice(settings.affiliateDefaultCommissionValue);

  return (
    <div>
      <PageHeader
        title="Commission rules"
        description={`Store default: ${defaultLabel}. Override per role, product or category below.`}
      />
      <AffiliateTabs />
      <CommissionRulesManager rules={rules} products={products} categories={categories} />
    </div>
  );
}
