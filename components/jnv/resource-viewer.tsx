"use client";

import { useEffect, useRef, useState } from "react";
import {
  ExternalLink,
  Maximize,
  Download,
  Printer,
  Share2,
  Star,
  FileText,
  Archive,
  File as FileIcon,
  ClipboardCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cldUrl, cldForceDownload, isVideoUrl } from "@/lib/cld";
import { addRecent, isFavorite, toggleFavorite } from "@/lib/jnv/local-store";
import { recordJnvDownload } from "@/lib/actions/jnv-public";
import { JNV_FILE_KIND_LABELS, formatBytes, type JnvFileKind } from "@/lib/jnv/catalog";
import { formatDate } from "@/lib/format";

export type ResourceViewerData = {
  id: string;
  title: string;
  description: string | null;
  subject: string | null;
  teacherName: string | null;
  classLevel: number;
  fileUrl: string;
  fileKind: string;
  fileSize: number;
  isAssignment: boolean;
  dueAt: string | null;
  downloadCount: number;
  createdAt: string;
};

export function ResourceViewer({ resource }: { resource: ResourceViewerData }) {
  const [fav, setFav] = useState(false);
  const [downloadCount, setDownloadCount] = useState(resource.downloadCount);
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    setFav(isFavorite(resource.id));
    addRecent({
      id: resource.id,
      title: resource.title,
      href: `/jnv/resource/${resource.id}`,
      classLevel: resource.classLevel,
      subject: resource.subject,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resource.id]);

  function handleFavorite() {
    const next = toggleFavorite({
      id: resource.id,
      title: resource.title,
      href: `/jnv/resource/${resource.id}`,
      classLevel: resource.classLevel,
      subject: resource.subject,
    });
    setFav(next);
    toast.success(next ? "Added to favorites" : "Removed from favorites");
  }

  function handleOpen() {
    window.open(resource.fileUrl, "_blank", "noopener");
  }

  function handleDownload() {
    window.open(cldForceDownload(resource.fileUrl), "_blank", "noopener");
    setDownloadCount((n) => n + 1);
    void recordJnvDownload(resource.id);
  }

  function handleFullscreen() {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.();
  }

  function handlePrint() {
    try {
      if (resource.fileKind === "PDF" && iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.print();
        return;
      }
    } catch {
      /* cross-origin print blocked — fall through to page print */
    }
    window.print();
  }

  async function handleShare() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (navigator.share) {
      try {
        await navigator.share({ title: resource.title, url });
      } catch {
        /* user cancelled — no-op */
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy the link");
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{resource.title}</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {[resource.subject, resource.teacherName].filter(Boolean).join(" · ") ||
              JNV_FILE_KIND_LABELS[resource.fileKind as JnvFileKind]}
            {" · "}
            {formatBytes(resource.fileSize)} · {formatDate(resource.createdAt)}
          </p>
          {resource.isAssignment && (
            <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-400">
              <ClipboardCheck className="size-3.5" /> Assignment
              {resource.dueAt ? ` · due ${formatDate(resource.dueAt)}` : ""}
            </p>
          )}
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={handleFavorite}
          aria-label={fav ? "Remove from favorites" : "Add to favorites"}
          className={fav ? "border-amber-400 text-amber-500" : ""}
        >
          <Star className={fav ? "size-4 fill-amber-400" : "size-4"} />
        </Button>
      </div>

      {resource.description && (
        <p className="mb-4 whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          {resource.description}
        </p>
      )}

      <div
        ref={containerRef}
        className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
      >
        <ResourcePreview resource={resource} iframeRef={iframeRef} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={handleDownload} className="gap-1.5 bg-blue-600 hover:bg-blue-700">
          <Download className="size-4" /> Download
        </Button>
        <Button variant="outline" onClick={handleOpen} className="gap-1.5">
          <ExternalLink className="size-4" /> Open
        </Button>
        <Button variant="outline" onClick={handleFullscreen} className="gap-1.5">
          <Maximize className="size-4" /> Fullscreen
        </Button>
        <Button variant="outline" onClick={handlePrint} className="gap-1.5">
          <Printer className="size-4" /> Print
        </Button>
        <Button variant="outline" onClick={handleShare} className="gap-1.5">
          <Share2 className="size-4" /> Share
        </Button>
        <span className="ml-auto self-center text-xs text-slate-400">
          {downloadCount} download{downloadCount === 1 ? "" : "s"}
        </span>
      </div>
    </div>
  );
}

function ResourcePreview({
  resource,
  iframeRef,
}: {
  resource: ResourceViewerData;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
}) {
  const { fileKind, fileUrl, title } = resource;

  if (fileKind === "PDF") {
    return (
      <iframe
        ref={iframeRef}
        src={fileUrl}
        title={title}
        className="h-[75vh] w-full"
      />
    );
  }

  if (fileKind === "PPT" || fileKind === "DOC" || fileKind === "XLS") {
    return (
      <iframe
        src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`}
        title={title}
        className="h-[75vh] w-full"
      />
    );
  }

  if (fileKind === "IMAGE") {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- arbitrary external/Cloudinary URLs, not a static import
      <img
        src={cldUrl(fileUrl, { w: 1600 })}
        alt={title}
        className="max-h-[80vh] w-full object-contain"
      />
    );
  }

  if (fileKind === "VIDEO" || isVideoUrl(fileUrl)) {
    return (
      <video controls className="max-h-[80vh] w-full bg-black">
        <source src={fileUrl} />
      </video>
    );
  }

  if (fileKind === "AUDIO") {
    return (
      <div className="p-8">
        <audio controls className="w-full">
          <source src={fileUrl} />
        </audio>
      </div>
    );
  }

  const Icon = fileKind === "ZIP" ? Archive : fileKind === "OTHER" ? FileIcon : FileText;
  return (
    <div className="flex flex-col items-center justify-center gap-3 p-16 text-center">
      <span className="grid size-16 place-items-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800">
        <Icon className="size-8" />
      </span>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        No inline preview for this file type — use Download or Open to view it.
      </p>
    </div>
  );
}
