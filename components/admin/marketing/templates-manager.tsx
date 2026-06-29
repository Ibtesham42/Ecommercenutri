"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Pencil, Trash2, Loader2, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { saveTemplate, deleteTemplate } from "@/lib/actions/admin/marketing";
import {
  CHANNELS,
  CHANNEL_LABEL,
  CHANNEL_LIVE,
  TEMPLATE_CATEGORIES,
  TEMPLATE_CATEGORY_LABEL,
} from "@/lib/marketing/channels";
import type { CampaignChannel } from "@prisma/client";

export type TemplateRow = {
  id: string;
  name: string;
  category: string;
  channels: CampaignChannel[];
  title: string;
  body: string;
  ctaText: string | null;
  isBuiltIn: boolean;
};

export function TemplatesManager({ templates }: { templates: TemplateRow[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TemplateRow | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>("PROMO");
  const [channels, setChannels] = useState<Set<CampaignChannel>>(new Set(["IN_APP", "EMAIL"]));
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [ctaText, setCtaText] = useState("");

  const field = "h-9 w-full rounded-md border bg-transparent px-3 text-sm";

  function openAdd() {
    setEditing(null);
    setName("");
    setCategory("PROMO");
    setChannels(new Set(["IN_APP", "EMAIL"]));
    setTitle("");
    setBody("");
    setCtaText("");
    setOpen(true);
  }
  function openEdit(t: TemplateRow) {
    setEditing(t);
    setName(t.name);
    setCategory(t.category);
    setChannels(new Set(t.channels));
    setTitle(t.title);
    setBody(t.body);
    setCtaText(t.ctaText ?? "");
    setOpen(true);
  }

  function toggleChannel(ch: CampaignChannel) {
    if (!CHANNEL_LIVE[ch]) return;
    setChannels((prev) => {
      const next = new Set(prev);
      if (next.has(ch)) next.delete(ch);
      else next.add(ch);
      return next;
    });
  }

  async function onSave() {
    if (!name.trim() || !title.trim() || !body.trim()) {
      toast.error("Name, title and message are required.");
      return;
    }
    setSaving(true);
    const res = await saveTemplate({
      id: editing?.id,
      name,
      category,
      channels: [...channels],
      title,
      body,
      ctaText,
    });
    setSaving(false);
    if (res.ok) {
      toast.success(editing ? "Template updated" : "Template created");
      setOpen(false);
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  function onDelete(t: TemplateRow) {
    if (!confirm(`Delete template "${t.name}"?`)) return;
    deleteTemplate(t.id).then((res) => {
      if (res.ok) {
        toast.success("Template deleted");
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
          <Plus className="size-4" /> New template
        </Button>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((t) => (
          <li key={t.id} className="flex flex-col rounded-xl border bg-background p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium">{t.name}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  <Badge variant="secondary" className="text-[10px]">
                    {TEMPLATE_CATEGORY_LABEL[t.category] ?? t.category}
                  </Badge>
                  {t.isBuiltIn && <Badge className="bg-gold/15 text-[10px] text-gold-foreground">Built-in</Badge>}
                </div>
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => openEdit(t)} aria-label="Edit">
                  <Pencil className="size-4" />
                </Button>
                {!t.isBuiltIn && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => onDelete(t)}
                    aria-label="Delete"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            </div>
            <p className="mt-2 line-clamp-1 text-sm font-medium">{t.title}</p>
            <p className="mt-0.5 line-clamp-2 flex-1 text-xs text-muted-foreground">{t.body}</p>
            <Button asChild size="sm" variant="outline" className="mt-3 gap-1.5">
              <Link href="/admin/marketing/compose">
                <FileText className="size-3.5" /> Use in campaign
              </Link>
            </Button>
          </li>
        ))}
      </ul>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit template" : "New template"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <select className={field} value={category} onChange={(e) => setCategory(e.target.value)}>
                  {TEMPLATE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {TEMPLATE_CATEGORY_LABEL[c]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Channels</Label>
              <div className="flex flex-wrap gap-1.5">
                {CHANNELS.map((ch) => (
                  <button
                    key={ch}
                    type="button"
                    disabled={!CHANNEL_LIVE[ch]}
                    onClick={() => toggleChannel(ch)}
                    className={`rounded-full border px-3 py-1 text-sm transition ${
                      channels.has(ch) ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-accent"
                    } ${!CHANNEL_LIVE[ch] ? "cursor-not-allowed opacity-50" : ""}`}
                  >
                    {CHANNEL_LABEL[ch]}
                    {!CHANNEL_LIVE[ch] && " (soon)"}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Message</Label>
              <Textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Button text</Label>
              <Input value={ctaText} onChange={(e) => setCtaText(e.target.value)} placeholder="Shop now" />
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
