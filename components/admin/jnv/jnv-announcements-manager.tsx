"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Pin, PinOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Badge } from "@/components/ui/badge";
import {
  saveJnvAnnouncement,
  toggleJnvAnnouncementPin,
  deleteJnvAnnouncement,
} from "@/lib/actions/admin/jnv";
import { JNV_CLASS_LEVELS, jnvClassLabel } from "@/lib/jnv/catalog";
import { formatDate } from "@/lib/format";

type AnnouncementRow = {
  id: string;
  title: string;
  body: string;
  classLevel: number | null;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
};

export function JnvAnnouncementsManager({ announcements }: { announcements: AnnouncementRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AnnouncementRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [classLevel, setClassLevel] = useState<string>("__all");

  function openAdd() {
    setEditing(null);
    setTitle("");
    setBody("");
    setClassLevel("__all");
    setOpen(true);
  }
  function openEdit(a: AnnouncementRow) {
    setEditing(a);
    setTitle(a.title);
    setBody(a.body);
    setClassLevel(a.classLevel ? String(a.classLevel) : "__all");
    setOpen(true);
  }

  async function submit() {
    if (!title.trim() || !body.trim()) {
      toast.error("Enter a title and message");
      return;
    }
    setSaving(true);
    const res = await saveJnvAnnouncement({
      id: editing?.id,
      title,
      body,
      classLevel: classLevel === "__all" ? null : Number(classLevel),
      pinned: editing?.pinned ?? false,
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(editing ? "Announcement updated" : "Announcement posted");
    setOpen(false);
    router.refresh();
  }

  function togglePin(a: AnnouncementRow) {
    startTransition(async () => {
      const res = await toggleJnvAnnouncementPin(a.id, !a.pinned);
      if (!res.ok) toast.error(res.error);
      else router.refresh();
    });
  }

  function remove(a: AnnouncementRow) {
    if (!confirm(`Delete "${a.title}"?`)) return;
    startTransition(async () => {
      const res = await deleteJnvAnnouncement(a.id);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success("Announcement deleted");
        router.refresh();
      }
    });
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={openAdd} className="gap-1.5">
          <Plus className="size-4" /> New announcement
        </Button>
      </div>

      {announcements.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          No announcements yet.
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map((a) => (
            <div key={a.id} className="rounded-xl border bg-background p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{a.title}</p>
                    {a.pinned && <Badge variant="secondary">Pinned</Badge>}
                    <Badge variant="outline">{a.classLevel ? jnvClassLabel(a.classLevel) : "All classes"}</Badge>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{a.body}</p>
                  <p className="mt-2 text-xs text-muted-foreground">Posted {formatDate(a.createdAt)}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => togglePin(a)}
                    disabled={pending}
                    aria-label={a.pinned ? "Unpin" : "Pin"}
                  >
                    {a.pinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(a)} aria-label="Edit">
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => remove(a)}
                    disabled={pending}
                    aria-label="Delete"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit announcement" : "New announcement"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="jnv-ann-title">Title</Label>
              <Input id="jnv-ann-title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="jnv-ann-body">Message</Label>
              <Textarea id="jnv-ann-body" rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="jnv-ann-class">Visible to</Label>
              <Select value={classLevel} onValueChange={setClassLevel}>
                <SelectTrigger id="jnv-ann-class">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">All classes</SelectItem>
                  {JNV_CLASS_LEVELS.map((l) => (
                    <SelectItem key={l} value={String(l)}>
                      {jnvClassLabel(l)} only
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={saving} className="gap-1.5">
              {saving && <Loader2 className="size-4 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
