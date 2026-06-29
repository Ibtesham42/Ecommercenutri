"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { saveSegment, deleteSegment, previewAudience } from "@/lib/actions/admin/marketing";
import { SEGMENTS, SEGMENT_LABEL, SEGMENT_DESCRIPTION, SEGMENT_NEEDS } from "@/lib/marketing/channels";
import type { SegmentType } from "@prisma/client";

type Option = { id: string; name: string };
export type SegmentRow = {
  id: string;
  name: string;
  type: SegmentType;
  cachedCount: number;
  config: { productId?: string | null; categoryId?: string | null; userIds?: string[]; inactiveDays?: number | null } | null;
};

export function SegmentsManager({
  segments,
  products,
  categories,
}: {
  segments: SegmentRow[];
  products: Option[];
  categories: Option[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SegmentRow | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [type, setType] = useState<SegmentType>("ALL_USERS");
  const [product, setProduct] = useState("");
  const [category, setCategory] = useState("");
  const [days, setDays] = useState(60);
  const [userIds, setUserIds] = useState("");
  const [count, setCount] = useState<number | null>(null);

  const field = "h-9 w-full rounded-md border bg-transparent px-3 text-sm";

  function config() {
    return {
      productId: SEGMENT_NEEDS.product.includes(type) ? product || null : null,
      categoryId: SEGMENT_NEEDS.category.includes(type) ? category || null : null,
      inactiveDays: SEGMENT_NEEDS.inactiveDays.includes(type) ? Number(days) || 60 : null,
      userIds: SEGMENT_NEEDS.userIds.includes(type)
        ? userIds.split(",").map((s) => s.trim()).filter(Boolean)
        : [],
    };
  }

  useEffect(() => {
    if (!open) return;
    let active = true;
    previewAudience({ type, config: config() }).then((res) => {
      if (active) setCount(res.ok ? res.data!.count : null);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, type, product, category, days, userIds]);

  function openAdd() {
    setEditing(null);
    setName("");
    setType("ALL_USERS");
    setProduct("");
    setCategory("");
    setDays(60);
    setUserIds("");
    setOpen(true);
  }
  function openEdit(s: SegmentRow) {
    setEditing(s);
    setName(s.name);
    setType(s.type);
    setProduct(s.config?.productId ?? "");
    setCategory(s.config?.categoryId ?? "");
    setDays(s.config?.inactiveDays ?? 60);
    setUserIds((s.config?.userIds ?? []).join(", "));
    setOpen(true);
  }

  async function onSave() {
    if (!name.trim()) {
      toast.error("Name the segment.");
      return;
    }
    setSaving(true);
    const res = await saveSegment({ id: editing?.id, name, type, config: config() });
    setSaving(false);
    if (res.ok) {
      toast.success(editing ? "Segment updated" : "Segment created");
      setOpen(false);
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  function onDelete(s: SegmentRow) {
    if (!confirm(`Delete segment "${s.name}"?`)) return;
    deleteSegment(s.id).then((res) => {
      if (res.ok) {
        toast.success("Segment deleted");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button className="gap-1.5" onClick={openAdd}>
          <Plus className="size-4" /> New segment
        </Button>
      </div>

      {segments.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <Users className="mx-auto size-10 text-muted-foreground/40" />
          <p className="mt-3 font-medium">No saved segments</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Save reusable audiences to target campaigns faster.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {segments.map((s) => (
            <li key={s.id} className="rounded-xl border bg-background p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{s.name}</p>
                  <Badge variant="secondary" className="mt-1">
                    {SEGMENT_LABEL[s.type]}
                  </Badge>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(s)} aria-label="Edit">
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => onDelete(s)}
                    aria-label="Delete"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
              <p className="mt-3 text-2xl font-bold tabular-nums">{s.cachedCount}</p>
              <p className="text-xs text-muted-foreground">recipients (at last save)</p>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit segment" : "New segment"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Protein buyers" />
            </div>
            <div className="space-y-1.5">
              <Label>Audience</Label>
              <select className={field} value={type} onChange={(e) => setType(e.target.value as SegmentType)}>
                {SEGMENTS.map((s) => (
                  <option key={s} value={s}>
                    {SEGMENT_LABEL[s]}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">{SEGMENT_DESCRIPTION[type]}</p>
            </div>
            {SEGMENT_NEEDS.product.includes(type) && (
              <select className={field} value={product} onChange={(e) => setProduct(e.target.value)}>
                <option value="">Any product</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
            {SEGMENT_NEEDS.category.includes(type) && (
              <select className={field} value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">Pick a category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
            {SEGMENT_NEEDS.inactiveDays.includes(type) && (
              <div className="space-y-1">
                <Label className="text-xs">Inactive for at least (days)</Label>
                <Input type="number" min={1} value={days} onChange={(e) => setDays(Number(e.target.value))} />
              </div>
            )}
            {SEGMENT_NEEDS.userIds.includes(type) && (
              <div className="space-y-1">
                <Label className="text-xs">User IDs (comma-separated)</Label>
                <Textarea rows={2} value={userIds} onChange={(e) => setUserIds(e.target.value)} />
              </div>
            )}
            <div className="rounded-lg bg-accent/40 p-2 text-center text-sm">
              <span className="font-bold tabular-nums">{count ?? "…"}</span> recipients
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={onSave} disabled={saving} className="gap-2">
                {saving && <Loader2 className="size-4 animate-spin" />}
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
