"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import type { SocialCampaign, SocialPlatform, SocialPublishMode } from "@prisma/client";
import type { SocialProductOption } from "@/lib/queries/social";
import { SOCIAL_MODE_VALUES, SOCIAL_PLATFORM_VALUES } from "@/lib/validations/social";
import { PUBLISH_MODE_LABEL, PUBLISH_MODE_DESCRIPTION } from "@/lib/social/status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
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
  saveSocialCampaign,
  toggleSocialCampaign,
  deleteSocialCampaign,
} from "@/lib/actions/admin/social";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type FormState = {
  id?: string;
  name: string;
  platforms: SocialPlatform[];
  mode: SocialPublishMode;
  morningTime: string;
  eveningTime: string;
  days: number[];
  maxPerDay: number;
  startsAt: string;
  endsAt: string;
  productIds: string[];
};

function emptyForm(): FormState {
  return {
    name: "",
    platforms: ["INSTAGRAM"],
    mode: "MANUAL_APPROVAL",
    morningTime: "09:00",
    eveningTime: "18:00",
    days: [0, 1, 2, 3, 4, 5, 6],
    maxPerDay: 2,
    startsAt: "",
    endsAt: "",
    productIds: [],
  };
}

function toForm(c: SocialCampaign): FormState {
  const d = (x: Date | null) => (x ? new Date(x).toISOString().slice(0, 10) : "");
  return {
    id: c.id,
    name: c.name,
    platforms: c.platforms,
    mode: c.mode,
    morningTime: c.morningTime,
    eveningTime: c.eveningTime,
    days: c.days,
    maxPerDay: c.maxPerDay,
    startsAt: d(c.startsAt),
    endsAt: d(c.endsAt),
    productIds: c.productIds,
  };
}

export function CampaignEditor({
  campaigns,
  products,
}: {
  campaigns: SocialCampaign[];
  products: SocialProductOption[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [form, setForm] = useState<FormState | null>(null);
  const [search, setSearch] = useState("");

  const filtered = useMemo(
    () => products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase())),
    [products, search],
  );

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => (f ? { ...f, [k]: v } : f));

  const toggleInArray = <T,>(arr: T[], v: T): T[] =>
    arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];

  const save = () => {
    if (!form) return;
    start(async () => {
      const res = await saveSocialCampaign({
        ...form,
        startsAt: form.startsAt || null,
        endsAt: form.endsAt || null,
      });
      if (res.ok) {
        toast.success("Campaign saved.");
        setForm(null);
        router.refresh();
      } else {
        toast.error(res.error ?? "Couldn't save.");
      }
    });
  };

  const toggle = (c: SocialCampaign) =>
    start(async () => {
      const res = await toggleSocialCampaign(c.id, !c.enabled);
      if (res.ok) router.refresh();
      else toast.error(res.error ?? "Couldn't update.");
    });

  const remove = (c: SocialCampaign) =>
    start(async () => {
      const res = await deleteSocialCampaign(c.id);
      if (res.ok) {
        toast.success("Deleted.");
        router.refresh();
      } else {
        toast.error(res.error ?? "Couldn't delete.");
      }
    });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setForm(emptyForm())}>
          <Plus className="mr-2 size-4" /> New campaign
        </Button>
      </div>

      {campaigns.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <p className="font-medium">No campaigns yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a campaign to pick products, a schedule and a publish mode. The
            planner generates posts automatically each day.
          </p>
        </div>
      ) : (
        <div className="grid gap-2">
          {campaigns.map((c) => (
            <div key={c.id} className="flex items-center gap-3 rounded-xl border p-3 shadow-elev-1">
              <Switch checked={c.enabled} onCheckedChange={() => toggle(c)} disabled={pending} aria-label="Enabled" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{c.name}</span>
                  <Badge variant="outline">{PUBLISH_MODE_LABEL[c.mode]}</Badge>
                  {c.platforms.map((p) => (
                    <Badge key={p} variant="secondary">{p}</Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {c.morningTime} · {c.eveningTime} IST · {c.days.map((d) => DAY_LABELS[d]).join(" ")} ·{" "}
                  {c.productIds.length ? `${c.productIds.length} product(s)` : "auto products"} · max {c.maxPerDay}/day
                </p>
              </div>
              <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => setForm(toForm(c))}>
                <Pencil className="size-4" />
              </Button>
              <Button variant="ghost" size="icon" aria-label="Delete" onClick={() => remove(c)}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={Boolean(form)} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{form?.id ? "Edit campaign" : "New campaign"}</DialogTitle>
          </DialogHeader>
          {form && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="c-name">Name</Label>
                <Input id="c-name" value={form.name} onChange={(e) => set("name", e.target.value)} />
              </div>

              <div>
                <Label>Platforms</Label>
                <div className="mt-1 flex gap-3">
                  {SOCIAL_PLATFORM_VALUES.map((p) => (
                    <label key={p} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={form.platforms.includes(p)}
                        onCheckedChange={() => set("platforms", toggleInArray(form.platforms, p))}
                      />
                      {p === "INSTAGRAM" ? "Instagram" : "Facebook"}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <Label>Publish mode</Label>
                <Select value={form.mode} onValueChange={(v) => set("mode", v as SocialPublishMode)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SOCIAL_MODE_VALUES.map((m) => (
                      <SelectItem key={m} value={m}>
                        {PUBLISH_MODE_LABEL[m]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-muted-foreground">{PUBLISH_MODE_DESCRIPTION[form.mode]}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="c-morning">Morning time (IST)</Label>
                  <Input id="c-morning" type="time" value={form.morningTime} onChange={(e) => set("morningTime", e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="c-evening">Evening time (IST)</Label>
                  <Input id="c-evening" type="time" value={form.eveningTime} onChange={(e) => set("eveningTime", e.target.value)} />
                </div>
              </div>

              <div>
                <Label>Days</Label>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {DAY_LABELS.map((label, i) => {
                    const on = form.days.includes(i);
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => set("days", toggleInArray(form.days, i).sort((a, b) => a - b))}
                        className={
                          "rounded-md border px-2.5 py-1 text-xs transition " +
                          (on ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent")
                        }
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="c-max">Max/day</Label>
                  <Input id="c-max" type="number" min={1} max={10} value={form.maxPerDay} onChange={(e) => set("maxPerDay", Number(e.target.value) || 1)} />
                </div>
                <div>
                  <Label htmlFor="c-start">Starts</Label>
                  <Input id="c-start" type="date" value={form.startsAt} onChange={(e) => set("startsAt", e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="c-end">Ends</Label>
                  <Input id="c-end" type="date" value={form.endsAt} onChange={(e) => set("endsAt", e.target.value)} />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <Label>Products ({form.productIds.length || "auto"})</Label>
                  {form.productIds.length > 0 && (
                    <button type="button" className="text-xs text-muted-foreground hover:underline" onClick={() => set("productIds", [])}>
                      Clear
                    </button>
                  )}
                </div>
                <p className="mb-1 text-xs text-muted-foreground">
                  Leave empty to rotate through all active products automatically.
                </p>
                <Input placeholder="Search products…" value={search} onChange={(e) => setSearch(e.target.value)} className="mb-2" />
                <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border p-2">
                  {filtered.slice(0, 100).map((p) => (
                    <label key={p.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={form.productIds.includes(p.id)}
                        onCheckedChange={() => set("productIds", toggleInArray(form.productIds, p.id))}
                      />
                      <span className="truncate">{p.name}</span>
                    </label>
                  ))}
                  {filtered.length === 0 && <p className="text-xs text-muted-foreground">No products match.</p>}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={save} disabled={pending || !form?.name.trim()}>
              {pending ? "Saving…" : "Save campaign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
