"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Clapperboard,
  X,
  Bot,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cldUrl, cldForceDownload, isVideoUrl } from "@/lib/cld";
import { addRecent, isFavorite, toggleFavorite } from "@/lib/jnv/local-store";
import { recordJnvDownload } from "@/lib/actions/jnv-public";
import { JNV_FILE_KIND_LABELS, formatBytes, type JnvFileKind } from "@/lib/jnv/catalog";
import { formatDate } from "@/lib/format";
import { useJnvAiContext } from "@/components/jnv/ai-context-provider";
import { isTypingTarget } from "@/components/jnv/presentation-provider";

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

const BYTE_QUICK_ACTIONS = [
  { label: "Summarize", question: "Summarize this in simple terms." },
  { label: "Generate MCQs", question: "Generate 5 MCQs from this." },
  { label: "Revision notes", question: "Create revision notes from this." },
  { label: "Create homework", question: "Create homework from this." },
];

export function ResourceViewer({
  resource,
  siblings = [],
}: {
  resource: ResourceViewerData;
  /** Other resources in the same folder, in browse order — powers Next/Prev
   *  and "Jump to" chapter navigation (handy for live teaching). */
  siblings?: { id: string; title: string }[];
}) {
  const [fav, setFav] = useState(false);
  const [downloadCount, setDownloadCount] = useState(resource.downloadCount);
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { askAboutResource } = useJnvAiContext();
  const router = useRouter();

  const currentIndex = siblings.findIndex((s) => s.id === resource.id);
  const prevResource = currentIndex > 0 ? siblings[currentIndex - 1] : null;
  const nextResource =
    currentIndex >= 0 && currentIndex < siblings.length - 1 ? siblings[currentIndex + 1] : null;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(document.activeElement)) return;
      if (e.key === "ArrowRight" && nextResource) {
        router.push(`/jnv/resource/${nextResource.id}`);
      } else if (e.key === "ArrowLeft" && prevResource) {
        router.push(`/jnv/resource/${prevResource.id}`);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [nextResource, prevResource, router]);

  function askByte(question?: string) {
    askAboutResource({
      resourceId: resource.id,
      title: resource.title,
      classLevel: resource.classLevel,
      initialQuestion: question,
    });
  }

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
      {siblings.length > 1 && (
        <div className="mb-3 flex items-center gap-2">
          <button
            type="button"
            disabled={!prevResource}
            onClick={() => prevResource && router.push(`/jnv/resource/${prevResource.id}`)}
            aria-label="Previous resource"
            className="flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-sm font-medium text-slate-600 transition-colors hover:border-blue-300 hover:text-blue-700 disabled:pointer-events-none disabled:opacity-30 dark:border-slate-700 dark:text-slate-300"
          >
            <ChevronLeft className="size-4" /> <span className="hidden sm:inline">Prev</span>
          </button>
          <select
            value={resource.id}
            onChange={(e) => router.push(`/jnv/resource/${e.target.value}`)}
            aria-label="Jump to a resource in this folder"
            className="h-9 min-w-0 flex-1 truncate rounded-lg border border-slate-200 bg-transparent px-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-slate-700"
          >
            {siblings.map((s, i) => (
              <option key={s.id} value={s.id}>
                {i + 1}. {s.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!nextResource}
            onClick={() => nextResource && router.push(`/jnv/resource/${nextResource.id}`)}
            aria-label="Next resource"
            className="flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-sm font-medium text-slate-600 transition-colors hover:border-blue-300 hover:text-blue-700 disabled:pointer-events-none disabled:opacity-30 dark:border-slate-700 dark:text-slate-300"
          >
            <span className="hidden sm:inline">Next</span> <ChevronRight className="size-4" />
          </button>
        </div>
      )}

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

      <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50/60 p-3 dark:border-blue-900 dark:bg-blue-950/30">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => askByte()}
            className="flex items-center gap-1.5 rounded-full bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700"
          >
            <Bot className="size-3.5" /> Ask Byte about this
          </button>
          {BYTE_QUICK_ACTIONS.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={() => askByte(a.question)}
              className="rounded-full border border-blue-200 bg-white px-3 py-1.5 text-xs font-medium text-blue-700 transition-colors hover:border-blue-400 dark:border-blue-800 dark:bg-slate-900 dark:text-blue-400"
            >
              {a.label}
            </button>
          ))}
        </div>
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
        src={`${fileUrl}#toolbar=1&navpanes=0&view=FitH`}
        title={title}
        className="h-[75vh] w-full [.jnv-presentation_&]:h-[calc(100dvh-9rem)]"
      />
    );
  }

  if (fileKind === "PPT" || fileKind === "DOC" || fileKind === "XLS") {
    return (
      <iframe
        src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`}
        title={title}
        className="h-[75vh] w-full [.jnv-presentation_&]:h-[calc(100dvh-9rem)]"
      />
    );
  }

  if (fileKind === "IMAGE") {
    return <ImagePreview src={cldUrl(fileUrl, { w: 1920 })} alt={title} />;
  }

  if (fileKind === "VIDEO" || isVideoUrl(fileUrl)) {
    return <VideoPreview resourceId={resource.id} src={fileUrl} />;
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

const ZOOM_MIN = 1;
const ZOOM_MAX = 4;
const ZOOM_STEP = 0.5;

/** Gallery-style image preview: zoom in/out and pan when zoomed in. */
function ImagePreview({ src, alt }: { src: string; alt: string }) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  function clampZoom(z: number) {
    return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
  }

  function zoomIn() {
    setZoom((z) => clampZoom(z + ZOOM_STEP));
  }
  function zoomOut() {
    setZoom((z) => {
      const next = clampZoom(z - ZOOM_STEP);
      if (next === ZOOM_MIN) setPan({ x: 0, y: 0 });
      return next;
    });
  }
  function resetZoom() {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }

  function onPointerDown(e: React.PointerEvent) {
    if (zoom === ZOOM_MIN) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    setPan({ x: dragRef.current.panX + dx, y: dragRef.current.panY + dy });
  }
  function onPointerUp() {
    dragRef.current = null;
  }

  return (
    <div className="relative bg-slate-100 dark:bg-slate-950">
      <div
        className="flex h-[70vh] w-full items-center justify-center overflow-hidden [.jnv-presentation_&]:h-[calc(100dvh-11rem)]"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        style={{ cursor: zoom > 1 ? "grab" : "default", touchAction: zoom > 1 ? "none" : "auto" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary external/Cloudinary URLs, not a static import */}
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="max-h-full max-w-full select-none object-contain transition-transform duration-150"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
        />
      </div>
      <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-slate-200 bg-white/95 p-1 shadow-elev-1 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
        <button
          type="button"
          onClick={zoomOut}
          disabled={zoom <= ZOOM_MIN}
          aria-label="Zoom out"
          className="grid size-9 place-items-center rounded-full text-slate-600 transition-colors hover:bg-blue-600/10 hover:text-blue-700 disabled:opacity-30 dark:text-slate-300"
        >
          <ZoomOut className="size-4" />
        </button>
        <span className="min-w-10 text-center text-xs font-medium text-slate-500 dark:text-slate-400">
          {Math.round(zoom * 100)}%
        </span>
        <button
          type="button"
          onClick={zoomIn}
          disabled={zoom >= ZOOM_MAX}
          aria-label="Zoom in"
          className="grid size-9 place-items-center rounded-full text-slate-600 transition-colors hover:bg-blue-600/10 hover:text-blue-700 disabled:opacity-30 dark:text-slate-300"
        >
          <ZoomIn className="size-4" />
        </button>
        {zoom > 1 && (
          <button
            type="button"
            onClick={resetZoom}
            aria-label="Reset zoom"
            className="grid size-9 place-items-center rounded-full text-slate-600 transition-colors hover:bg-blue-600/10 hover:text-blue-700 dark:text-slate-300"
          >
            <RotateCcw className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
}

const RESUME_THRESHOLD_SECONDS = 10;

/** Video preview with Theatre Mode and resume-from-last-position (per device). */
function VideoPreview({ resourceId, src }: { resourceId: string; src: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [theatre, setTheatre] = useState(false);
  const lastSaveRef = useRef(0);
  const resumeKey = `jnv_resume_${resourceId}`;

  function handleLoadedMetadata() {
    const video = videoRef.current;
    if (!video) return;
    const saved = Number(window.localStorage.getItem(resumeKey) ?? "0");
    if (saved > RESUME_THRESHOLD_SECONDS && saved < video.duration - RESUME_THRESHOLD_SECONDS) {
      video.currentTime = saved;
    }
  }

  function handleTimeUpdate() {
    const video = videoRef.current;
    if (!video) return;
    const now = Date.now();
    if (now - lastSaveRef.current < 5000) return;
    lastSaveRef.current = now;
    window.localStorage.setItem(resumeKey, String(Math.floor(video.currentTime)));
  }

  function handleEnded() {
    window.localStorage.removeItem(resumeKey);
  }

  return (
    <div
      className={
        theatre
          ? "fixed inset-0 z-50 flex flex-col items-center justify-center bg-black p-4"
          : "relative bg-black"
      }
    >
      {theatre && (
        <button
          type="button"
          onClick={() => setTheatre(false)}
          aria-label="Exit theatre mode"
          className="absolute right-4 top-4 grid size-10 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
        >
          <X className="size-5" />
        </button>
      )}
      <video
        ref={videoRef}
        controls
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        className={theatre ? "max-h-full max-w-full" : "max-h-[80vh] w-full [.jnv-presentation_&]:max-h-[calc(100dvh-11rem)]"}
      >
        <source src={src} />
      </video>
      {!theatre && (
        <button
          type="button"
          onClick={() => setTheatre(true)}
          className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium text-white backdrop-blur transition-colors hover:bg-black/80"
        >
          <Clapperboard className="size-3.5" /> Theatre mode
        </button>
      )}
    </div>
  );
}
