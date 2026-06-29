import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { guardSection } from "@/lib/admin-guard";
import { LegalManager, type LegalPageRow } from "@/components/admin/legal-manager";
import { getAdminLegalPages } from "@/lib/queries/content";

export const metadata: Metadata = { title: "Legal pages", robots: { index: false } };

export default async function AdminLegalPage() {
  await guardSection("appearance");
  const pages = await getAdminLegalPages();
  return (
    <div>
      <PageHeader title="Legal & policy pages" description="Shipping, Privacy and Terms" />
      <LegalManager pages={pages as LegalPageRow[]} />
    </div>
  );
}
