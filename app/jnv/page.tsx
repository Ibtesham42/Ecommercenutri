import type { Metadata } from "next";
import { JNV_CLASS_LEVELS } from "@/lib/jnv/catalog";
import { getJnvClassSummaries, getJnvAnnouncements } from "@/lib/queries/jnv";
import { ClassCard } from "@/components/jnv/class-card";
import { AnnouncementBanner } from "@/components/jnv/announcement-banner";
import { JnvLocalWidgets } from "@/components/jnv/local-widgets";

export const dynamic = "force-dynamic";
// Absolute title: a plain string here would merge into ITS OWN layout's
// same-segment metadata (replacing the template) and fall through to the
// root's "| Nutriyet" template instead — `absolute` sidesteps that entirely.
export const metadata: Metadata = { title: { absolute: "JNV Smart Class — Select your class" } };

export default async function JnvHomePage() {
  const [summaries, announcements] = await Promise.all([
    getJnvClassSummaries(JNV_CLASS_LEVELS),
    getJnvAnnouncements().catch(() => []),
  ]);
  const schoolWide = announcements.filter((a) => a.classLevel === null && a.pinned);

  return (
    <div className="py-8 sm:py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 text-center sm:mb-12">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            Select your class
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-base text-slate-500 dark:text-slate-400">
            Notes, slides, PDFs, videos and assignments for JNV Smart Class — Classes 6
            through 10.
          </p>
        </div>
      </div>

      <AnnouncementBanner announcements={schoolWide} />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {summaries.map((s, i) => (
            <ClassCard
              key={s.classLevel}
              classLevel={s.classLevel}
              index={i}
              folderCount={s.folderCount}
              resourceCount={s.resourceCount}
              lastUpdated={s.lastUpdated}
            />
          ))}
        </div>
      </div>

      <div className="mt-10">
        <JnvLocalWidgets />
      </div>
    </div>
  );
}
