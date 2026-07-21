import Link from "next/link";
import {
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  FileVideo,
  FileAudio,
  Archive,
  File as FileIcon,
  Presentation,
  ClipboardCheck,
  Download,
} from "lucide-react";
import { JNV_FILE_KIND_LABELS, formatBytes, type JnvFileKind } from "@/lib/jnv/catalog";
import { formatDate } from "@/lib/format";

const KIND_ICON: Record<JnvFileKind, React.ComponentType<{ className?: string }>> = {
  PDF: FileText,
  PPT: Presentation,
  DOC: FileText,
  XLS: FileSpreadsheet,
  IMAGE: ImageIcon,
  AUDIO: FileAudio,
  VIDEO: FileVideo,
  ZIP: Archive,
  OTHER: FileIcon,
};

export function ResourceCard({
  id,
  title,
  subject,
  teacherName,
  fileKind,
  fileSize,
  isAssignment,
  dueAt,
  downloadCount,
  createdAt,
}: {
  id: string;
  title: string;
  subject: string | null;
  teacherName: string | null;
  fileKind: string;
  fileSize: number;
  isAssignment: boolean;
  dueAt: Date | string | null;
  downloadCount: number;
  createdAt: Date | string;
}) {
  const Icon = KIND_ICON[fileKind as JnvFileKind] ?? FileIcon;
  return (
    <Link
      href={`/jnv/resource/${id}`}
      className="group flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all motion-safe:duration-200 hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900 dark:hover:border-emerald-700"
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-emerald-600/10 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-400">
        <Icon className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base font-semibold">{title}</span>
        <span className="mt-1 block truncate text-xs text-slate-500 dark:text-slate-400">
          {[subject, teacherName].filter(Boolean).join(" · ") || JNV_FILE_KIND_LABELS[fileKind as JnvFileKind]}
        </span>
        <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-500">
          <span>{JNV_FILE_KIND_LABELS[fileKind as JnvFileKind] ?? fileKind}</span>
          <span>{formatBytes(fileSize)}</span>
          <span className="flex items-center gap-1">
            <Download className="size-3" /> {downloadCount}
          </span>
          <span>{formatDate(createdAt)}</span>
        </span>
        {isAssignment && (
          <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
            <ClipboardCheck className="size-3" /> Assignment
            {dueAt ? ` · due ${formatDate(dueAt)}` : ""}
          </span>
        )}
      </span>
    </Link>
  );
}
