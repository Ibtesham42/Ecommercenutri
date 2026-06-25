import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { guardSection } from "@/lib/admin-guard";
import {
  HomeSectionsManager,
  type HomeSectionRow,
} from "@/components/admin/home-sections-manager";
import { ensureHomeSections } from "@/lib/actions/admin/home-sections";
import { getHomeSectionOrder } from "@/lib/queries/home";
import { HOME_SECTIONS } from "@/lib/home-sections";

export const metadata: Metadata = { title: "Homepage layout", robots: { index: false } };

export default async function AdminHomepagePage() {
  await guardSection("appearance");

  // Populate any missing section rows so everything is toggleable.
  await ensureHomeSections();
  const order = await getHomeSectionOrder();

  const rows: HomeSectionRow[] = order.map((o) => {
    const m = HOME_SECTIONS.find((x) => x.key === o.key);
    return {
      key: o.key,
      label: m?.label ?? o.key,
      note: m && "note" in m ? m.note : undefined,
      enabled: o.enabled,
    };
  });

  return (
    <div>
      <PageHeader
        title="Homepage layout"
        description="Show, hide and reorder homepage sections. Drag to reorder. Sections with no content (e.g. no featured products) stay hidden automatically."
      />
      <HomeSectionsManager sections={rows} />
    </div>
  );
}
