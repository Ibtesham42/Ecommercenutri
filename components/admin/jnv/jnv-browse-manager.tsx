"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  Folder,
  FolderPlus,
  Upload,
  Pencil,
  Trash2,
  Home,
  ChevronRight,
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  FileVideo,
  FileAudio,
  Archive,
  File as FileIcon,
  Presentation,
  ClipboardCheck,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { JnvFileField, type JnvUploadResult } from "@/components/admin/jnv/jnv-file-field";
import {
  createJnvFolder,
  updateJnvFolder,
  deleteJnvFolder,
  createJnvResource,
  updateJnvResource,
  deleteJnvResource,
} from "@/lib/actions/admin/jnv";
import {
  JNV_CLASS_LEVELS,
  JNV_DEFAULT_SUBJECTS,
  JNV_FILE_KINDS,
  JNV_FILE_KIND_LABELS,
  formatBytes,
  jnvClassLabel,
  type JnvFileKind,
} from "@/lib/jnv/catalog";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type FolderCard = {
  id: string;
  classLevel: number;
  name: string;
  icon: string | null;
  parentId: string | null;
  order: number;
  childCount: number;
  resourceCount: number;
  updatedAt: string;
};

type ResourceCard = {
  id: string;
  folderId: string;
  classLevel: number;
  subject: string | null;
  title: string;
  description: string | null;
  teacherName: string | null;
  fileUrl: string;
  fileKind: string;
  mimeType: string | null;
  fileSize: number;
  thumbnailUrl: string | null;
  isAssignment: boolean;
  dueAt: string | null;
  downloadCount: number;
  createdAt: string;
  updatedAt: string;
  folderName: string;
};

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

function ResourceIcon({ kind, className }: { kind: string; className?: string }) {
  const Icon = KIND_ICON[kind as JnvFileKind] ?? FileIcon;
  return <Icon className={className} />;
}

export function JnvBrowseManager({
  classLevel,
  folderId,
  kind,
  breadcrumbs,
  folders,
  resources,
  cloudinaryReady,
}: {
  classLevel: number;
  folderId: string | null;
  kind: string | null;
  breadcrumbs: { id: string; name: string }[];
  folders: FolderCard[];
  resources: ResourceCard[];
  cloudinaryReady: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const [folderDialog, setFolderDialog] = useState<{ mode: "create" | "rename"; folder?: FolderCard } | null>(
    null,
  );
  const [folderName, setFolderName] = useState("");
  const [savingFolder, setSavingFolder] = useState(false);

  const [resourceDialog, setResourceDialog] = useState<{ mode: "create" | "edit"; resource?: ResourceCard } | null>(
    null,
  );
  const [savingResource, setSavingResource] = useState(false);
  const [upload, setUpload] = useState<JnvUploadResult | null>(null);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [teacherName, setTeacherName] = useState("");
  const [description, setDescription] = useState("");
  const [isAssignment, setIsAssignment] = useState(false);
  const [dueAt, setDueAt] = useState("");

  function navTo(next: { class?: number; folder?: string | null; kind?: string | null }) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("class", String(next.class ?? classLevel));
    if (next.folder) params.set("folder", next.folder);
    else params.delete("folder");
    if (next.kind) params.set("kind", next.kind);
    else params.delete("kind");
    router.push(`${pathname}?${params.toString()}`);
  }

  function refresh() {
    router.refresh();
  }

  // Folder dialog ------------------------------------------------------------
  function openCreateFolder() {
    setFolderName("");
    setFolderDialog({ mode: "create" });
  }
  function openRenameFolder(f: FolderCard) {
    setFolderName(f.name);
    setFolderDialog({ mode: "rename", folder: f });
  }
  async function submitFolder() {
    if (!folderName.trim()) {
      toast.error("Enter a folder name");
      return;
    }
    setSavingFolder(true);
    const res =
      folderDialog?.mode === "rename" && folderDialog.folder
        ? await updateJnvFolder({ id: folderDialog.folder.id, name: folderName })
        : await createJnvFolder({ classLevel, name: folderName, parentId: folderId });
    setSavingFolder(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(folderDialog?.mode === "rename" ? "Folder renamed" : "Folder created");
    setFolderDialog(null);
    refresh();
  }
  function removeFolder(f: FolderCard) {
    if (
      !confirm(
        `Delete "${f.name}"? This also deletes ${f.childCount} subfolder(s) and ${f.resourceCount} resource(s) inside it.`,
      )
    )
      return;
    startTransition(async () => {
      const res = await deleteJnvFolder(f.id);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success("Folder deleted");
        refresh();
      }
    });
  }

  // Resource dialog ------------------------------------------------------------
  function openUpload() {
    setUpload(null);
    setTitle("");
    setSubject("");
    setTeacherName("");
    setDescription("");
    setIsAssignment(false);
    setDueAt("");
    setResourceDialog({ mode: "create" });
  }
  function openEditResource(r: ResourceCard) {
    setTitle(r.title);
    setSubject(r.subject ?? "");
    setTeacherName(r.teacherName ?? "");
    setDescription(r.description ?? "");
    setIsAssignment(r.isAssignment);
    setDueAt(r.dueAt ? r.dueAt.slice(0, 10) : "");
    setResourceDialog({ mode: "edit", resource: r });
  }
  async function submitResource() {
    if (!title.trim()) {
      toast.error("Enter a title");
      return;
    }
    setSavingResource(true);
    let res;
    if (resourceDialog?.mode === "edit" && resourceDialog.resource) {
      res = await updateJnvResource({
        id: resourceDialog.resource.id,
        title,
        subject: subject || null,
        teacherName: teacherName || null,
        description: description || null,
        isAssignment,
        dueAt: dueAt ? new Date(dueAt) : null,
      });
    } else {
      if (!upload) {
        setSavingResource(false);
        toast.error("Upload a file first");
        return;
      }
      if (!folderId) {
        setSavingResource(false);
        toast.error("Open a folder first");
        return;
      }
      res = await createJnvResource({
        folderId,
        classLevel,
        title,
        subject: subject || null,
        teacherName: teacherName || null,
        description: description || null,
        fileUrl: upload.url,
        fileKind: upload.fileKind,
        mimeType: upload.mimeType,
        fileSize: upload.fileSize,
        isAssignment,
        dueAt: dueAt ? new Date(dueAt) : null,
      });
    }
    setSavingResource(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(resourceDialog?.mode === "edit" ? "Resource updated" : "Resource uploaded");
    setResourceDialog(null);
    refresh();
  }
  function removeResource(r: ResourceCard) {
    if (!confirm(`Delete "${r.title}"? This permanently removes the uploaded file.`)) return;
    startTransition(async () => {
      const res = await deleteJnvResource(r.id);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success("Resource deleted");
        refresh();
      }
    });
  }

  return (
    <div>
      {/* Class tabs */}
      <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto">
        {JNV_CLASS_LEVELS.map((level) => (
          <button
            key={level}
            onClick={() => navTo({ class: level, folder: null, kind: null })}
            className={cn(
              "whitespace-nowrap rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
              level === classLevel
                ? "border-primary bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent",
            )}
          >
            {jnvClassLabel(level)}
          </button>
        ))}
      </div>

      {/* Breadcrumbs + actions */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 text-sm">
          <button
            onClick={() => navTo({ folder: null, kind: null })}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Home className="size-3.5" /> {jnvClassLabel(classLevel)}
          </button>
          {breadcrumbs.map((b) => (
            <span key={b.id} className="flex items-center gap-1">
              <ChevronRight className="size-3.5 text-muted-foreground/50" />
              <button
                onClick={() => navTo({ folder: b.id, kind: null })}
                className="rounded px-1.5 py-0.5 hover:bg-accent"
              >
                {b.name}
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={openCreateFolder} className="gap-1.5">
            <FolderPlus className="size-4" /> New folder
          </Button>
          <Button
            size="sm"
            onClick={openUpload}
            disabled={!folderId}
            title={folderId ? undefined : "Open a folder first"}
            className="gap-1.5"
          >
            <Upload className="size-4" /> Upload resource
          </Button>
        </div>
      </div>

      {/* Kind filter chips */}
      <div className="no-scrollbar mb-5 flex gap-1.5 overflow-x-auto">
        <button
          onClick={() => navTo({ kind: null })}
          className={cn(
            "whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium",
            !kind ? "bg-primary text-primary-foreground" : "bg-accent text-muted-foreground hover:text-foreground",
          )}
        >
          All
        </button>
        {JNV_FILE_KINDS.map((k) => (
          <button
            key={k}
            onClick={() => navTo({ folder: null, kind: k })}
            className={cn(
              "whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium",
              kind === k
                ? "bg-primary text-primary-foreground"
                : "bg-accent text-muted-foreground hover:text-foreground",
            )}
          >
            {JNV_FILE_KIND_LABELS[k]}
          </button>
        ))}
      </div>

      {/* Folders */}
      {!kind && (
        <>
          {folders.length > 0 && (
            <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {folders.map((f) => (
                <div
                  key={f.id}
                  className="group rounded-xl border bg-background p-4 transition hover:border-primary/40 hover:shadow-elev-1"
                >
                  <button
                    onClick={() => navTo({ folder: f.id, kind: null })}
                    className="flex w-full items-start gap-3 text-left"
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                      <Folder className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{f.name}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {f.childCount} folders · {f.resourceCount} files
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        Updated {formatDate(f.updatedAt)}
                      </span>
                    </span>
                  </button>
                  <div className="mt-3 flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button variant="ghost" size="icon" className="size-7" onClick={() => openRenameFolder(f)}>
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-destructive hover:text-destructive"
                      onClick={() => removeFolder(f)}
                      disabled={pending}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {folderId && (
            <div className="mb-3 text-sm font-medium text-muted-foreground">Resources in this folder</div>
          )}
        </>
      )}

      {/* Resources */}
      {resources.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {kind
            ? `No ${JNV_FILE_KIND_LABELS[kind as JnvFileKind] ?? kind} resources in ${jnvClassLabel(classLevel)} yet.`
            : folderId
              ? "No resources in this folder yet. Upload one above."
              : folders.length === 0
                ? `No folders in ${jnvClassLabel(classLevel)} yet. Create one to get started — try ${JNV_DEFAULT_SUBJECTS.slice(0, 3).join(", ")}…`
                : "Open a folder to see or upload resources."}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {resources.map((r) => (
            <div
              key={r.id}
              className="group rounded-xl border bg-background p-4 transition hover:border-primary/40 hover:shadow-elev-1"
            >
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <ResourceIcon kind={r.fileKind} className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{r.title}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {kind ? `${r.folderName} · ` : ""}
                    {r.subject ? `${r.subject} · ` : ""}
                    {JNV_FILE_KIND_LABELS[r.fileKind as JnvFileKind] ?? r.fileKind} ·{" "}
                    {formatBytes(r.fileSize)}
                  </p>
                  {r.isAssignment && (
                    <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                      <ClipboardCheck className="size-3" /> Assignment
                      {r.dueAt ? ` · due ${formatDate(r.dueAt)}` : ""}
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{r.downloadCount} downloads</span>
                <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <Button variant="ghost" size="icon" className="size-7" onClick={() => openEditResource(r)}>
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-destructive hover:text-destructive"
                    onClick={() => removeResource(r)}
                    disabled={pending}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Folder dialog */}
      <Dialog open={!!folderDialog} onOpenChange={(o) => !o && setFolderDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{folderDialog?.mode === "rename" ? "Rename folder" : "New folder"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="jnv-folder-name">Folder name</Label>
            <Input
              id="jnv-folder-name"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="e.g. Mathematics"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFolderDialog(null)}>
              Cancel
            </Button>
            <Button onClick={submitFolder} disabled={savingFolder} className="gap-1.5">
              {savingFolder && <Loader2 className="size-4 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resource dialog */}
      <Dialog open={!!resourceDialog} onOpenChange={(o) => !o && setResourceDialog(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{resourceDialog?.mode === "edit" ? "Edit resource" : "Upload resource"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {resourceDialog?.mode === "create" && (
              <div className="space-y-2">
                <Label>File</Label>
                <JnvFileField
                  value={upload}
                  onUploaded={setUpload}
                  cloudinaryReady={cloudinaryReady}
                  folder={`jnv/class-${classLevel}`}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="jnv-title">Title</Label>
              <Input id="jnv-title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="jnv-subject">Subject</Label>
                <Select value={subject || "__none"} onValueChange={(v) => setSubject(v === "__none" ? "" : v)}>
                  <SelectTrigger id="jnv-subject">
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">None</SelectItem>
                    {JNV_DEFAULT_SUBJECTS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="jnv-teacher">Teacher name</Label>
                <Input
                  id="jnv-teacher"
                  value={teacherName}
                  onChange={(e) => setTeacherName(e.target.value)}
                  placeholder="Optional"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="jnv-desc">Description</Label>
              <Textarea
                id="jnv-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Optional notes for students"
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="jnv-assignment"
                checked={isAssignment}
                onCheckedChange={(v) => setIsAssignment(v === true)}
              />
              <Label htmlFor="jnv-assignment" className="cursor-pointer font-normal">
                This is an assignment
              </Label>
            </div>
            {isAssignment && (
              <div className="space-y-2">
                <Label htmlFor="jnv-due">Due date</Label>
                <Input id="jnv-due" type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResourceDialog(null)}>
              Cancel
            </Button>
            <Button onClick={submitResource} disabled={savingResource} className="gap-1.5">
              {savingResource && <Loader2 className="size-4 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
