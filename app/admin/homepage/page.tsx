import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { guardSection } from "@/lib/admin-guard";
import {
  HomeSectionsManager,
  type HomeSectionRow,
} from "@/components/admin/home-sections-manager";
import { ensureHomeSections } from "@/lib/actions/admin/home-sections";
import { getHomeSectionOrder, getHomeSectionsContent } from "@/lib/queries/home";
import { HOME_SECTIONS, isHomeSectionKey } from "@/lib/home-sections";
import { HOME_SECTION_EDITOR } from "@/lib/home-content";

export const metadata: Metadata = { title: "Homepage layout", robots: { index: false } };

export default async function AdminHomepagePage() {
  await guardSection("appearance");

  // Populate any missing section rows so everything is toggleable.
  await ensureHomeSections();
  const [order, content] = await Promise.all([
    getHomeSectionOrder(),
    getHomeSectionsContent(),
  ]);

  const rows: HomeSectionRow[] = order.map((o) => {
    const m = HOME_SECTIONS.find((x) => x.key === o.key);
    return {
      key: o.key,
      label: m?.label ?? o.key,
      note: m && "note" in m ? m.note : undefined,
      enabled: o.enabled,
      editorKind: isHomeSectionKey(o.key) ? HOME_SECTION_EDITOR[o.key] : "none",
    };
  });

  return (
    <div>
      <PageHeader
        title="Homepage layout"
        description="Edit, show, hide and reorder homepage sections. Drag to reorder; click the pencil to edit a section's content. Sections with no content (e.g. no featured products) stay hidden automatically."
      />
      <HomeSectionsManager sections={rows} content={content} />
    </div>
  );
}
