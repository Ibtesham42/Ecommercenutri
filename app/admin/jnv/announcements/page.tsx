import type { Metadata } from "next";
import { getJnvAnnouncements } from "@/lib/queries/jnv";
import { JnvAnnouncementsManager } from "@/components/admin/jnv/jnv-announcements-manager";

export const metadata: Metadata = { title: "JNV Smart Class — Announcements", robots: { index: false } };

export default async function JnvAnnouncementsPage() {
  const announcements = await getJnvAnnouncements();
  return (
    <JnvAnnouncementsManager
      announcements={announcements.map((a) => ({
        ...a,
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
      }))}
    />
  );
}
