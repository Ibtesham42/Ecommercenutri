import Link from "next/link";
import type { Metadata } from "next";
import { FolderTree, FileStack, HardDrive, Download, Megaphone } from "lucide-react";
import { getJnvDashboardStats, getJnvClassSummaries } from "@/lib/queries/jnv";
import { JNV_CLASS_LEVELS, JNV_FILE_KIND_LABELS, formatBytes, jnvClassLabel } from "@/lib/jnv/catalog";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "JNV Smart Class — Dashboard", robots: { index: false } };

function StatCard({
  label,
  value,
  icon: Icon,
  hint,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border bg-background p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default async function JnvDashboardPage() {
  const [stats, classSummaries] = await Promise.all([
    getJnvDashboardStats(),
    getJnvClassSummaries(JNV_CLASS_LEVELS),
  ]);

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Folders" value={String(stats.folderCount)} icon={FolderTree} />
        <StatCard label="Resources" value={String(stats.resourceCount)} icon={FileStack} />
        <StatCard
          label="Storage used"
          value={formatBytes(stats.storageBytes)}
          icon={HardDrive}
        />
        <StatCard
          label="Downloads"
          value={String(stats.totalDownloads)}
          icon={Download}
          hint={`${stats.announcementCount} announcements`}
        />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {classSummaries.map((c) => (
          <Link
            key={c.classLevel}
            href={`/admin/jnv/browse?class=${c.classLevel}`}
            className="rounded-xl border bg-background p-4 transition hover:border-primary/40 hover:shadow-elev-1"
          >
            <p className="font-semibold">{jnvClassLabel(c.classLevel)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {c.folderCount} folders · {c.resourceCount} resources
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {c.lastUpdated ? `Updated ${formatDate(c.lastUpdated)}` : "No uploads yet"}
            </p>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border bg-background lg:col-span-2">
          <div className="flex items-center justify-between border-b p-4">
            <h2 className="flex items-center gap-2 font-semibold">
              <FileStack className="size-4 text-muted-foreground" /> Recent uploads
            </h2>
            <Link href="/admin/jnv/browse" className="text-sm text-primary hover:underline">
              Browse all
            </Link>
          </div>
          {stats.recentResources.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              No resources uploaded yet. Head to Classes &amp; Resources to add the first one.
            </p>
          ) : (
            <ul className="divide-y">
              {stats.recentResources.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/admin/jnv/browse?class=${r.classLevel}&folder=${r.folderId}`}
                    className="flex items-center justify-between gap-3 p-4 transition hover:bg-muted/40"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{r.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {jnvClassLabel(r.classLevel)} · {r.folderName}
                        {r.subject ? ` · ${r.subject}` : ""}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {JNV_FILE_KIND_LABELS[r.fileKind as keyof typeof JNV_FILE_KIND_LABELS] ?? r.fileKind}
                      {" · "}
                      {formatDate(r.createdAt)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border bg-background">
          <div className="flex items-center justify-between border-b p-4">
            <span className="flex items-center gap-2 font-semibold">
              <Megaphone className="size-4 text-muted-foreground" /> Announcements
            </span>
            <Link
              href="/admin/jnv/announcements"
              className="text-sm text-primary hover:underline"
            >
              Manage
            </Link>
          </div>
          <p className="p-4 text-sm text-muted-foreground">
            {stats.announcementCount === 0
              ? "No announcements posted yet."
              : `${stats.announcementCount} announcement${stats.announcementCount === 1 ? "" : "s"} posted.`}
          </p>
        </div>
      </div>
    </div>
  );
}
