"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Sparkles } from "lucide-react";
import type { SocialTemplate, SocialContentPillar } from "@prisma/client";
import { SOCIAL_PILLAR_VALUES } from "@/lib/validations/social";
import { PILLAR_LABEL } from "@/lib/social/strategy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  saveSocialTemplate,
  deleteSocialTemplate,
  seedBuiltInTemplates,
} from "@/lib/actions/admin/social";

type FormState = { id?: string; name: string; pillar: SocialContentPillar; promptGuidance: string };

export function TemplatesManager({ templates }: { templates: SocialTemplate[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [form, setForm] = useState<FormState | null>(null);

  const save = () => {
    if (!form) return;
    start(async () => {
      const res = await saveSocialTemplate(form);
      if (res.ok) {
        toast.success("Template saved.");
        setForm(null);
        router.refresh();
      } else {
        toast.error(res.error ?? "Couldn't save.");
      }
    });
  };

  const remove = (id: string) =>
    start(async () => {
      const res = await deleteSocialTemplate(id);
      if (res.ok) {
        toast.success("Deleted.");
        router.refresh();
      } else {
        toast.error(res.error ?? "Couldn't delete.");
      }
    });

  const seed = () =>
    start(async () => {
      const res = await seedBuiltInTemplates();
      if (res.ok) {
        toast.success("Built-in templates added.");
        router.refresh();
      } else {
        toast.error(res.error ?? "Couldn't add.");
      }
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-end gap-2">
        <Button size="sm" variant="outline" onClick={seed} disabled={pending}>
          <Sparkles className="mr-2 size-4" /> Add built-in templates
        </Button>
        <Button size="sm" onClick={() => setForm({ name: "", pillar: "PRODUCT_KNOWLEDGE", promptGuidance: "" })}>
          <Plus className="mr-2 size-4" /> New template
        </Button>
      </div>

      {templates.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <p className="font-medium">No templates yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add the built-in set to get started, or create your own prompt guidance per pillar.
          </p>
        </div>
      ) : (
        <div className="grid gap-2">
          {templates.map((t) => (
            <div key={t.id} className="flex items-start gap-3 rounded-xl border p-3 shadow-elev-1">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{t.name}</span>
                  <Badge variant="secondary">{PILLAR_LABEL[t.pillar]}</Badge>
                  {t.isBuiltIn && <Badge variant="outline">Built-in</Badge>}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{t.promptGuidance}</p>
              </div>
              <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => setForm({ id: t.id, name: t.name, pillar: t.pillar, promptGuidance: t.promptGuidance })}>
                <Pencil className="size-4" />
              </Button>
              <Button variant="ghost" size="icon" aria-label="Delete" onClick={() => remove(t.id)}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={Boolean(form)} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{form?.id ? "Edit template" : "New template"}</DialogTitle>
          </DialogHeader>
          {form && (
            <div className="space-y-3">
              <div>
                <Label htmlFor="t-name">Name</Label>
                <Input id="t-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <Label>Pillar</Label>
                <Select value={form.pillar} onValueChange={(v) => setForm({ ...form, pillar: v as SocialContentPillar })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SOCIAL_PILLAR_VALUES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {PILLAR_LABEL[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="t-guide">Prompt guidance</Label>
                <Textarea id="t-guide" rows={4} value={form.promptGuidance} onChange={(e) => setForm({ ...form, promptGuidance: e.target.value })} maxLength={1000} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={save} disabled={pending || !form?.name.trim() || !form?.promptGuidance.trim()}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
