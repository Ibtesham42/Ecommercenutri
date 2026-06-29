"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Loader2, Zap, Sparkles, Play } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ImageUploadField } from "@/components/admin/image-upload-field";
import {
  saveAutomationRule,
  toggleAutomationRule,
  deleteAutomationRule,
  runAutomationsNow,
  generateContent,
} from "@/lib/actions/admin/marketing";
import {
  CHANNELS,
  CHANNEL_LABEL,
  CHANNEL_LIVE,
  AUTOMATION_TRIGGERS,
  AUTOMATION_TRIGGER_LABEL,
  AUTOMATION_TRIGGER_DESCRIPTION,
} from "@/lib/marketing/channels";
import { formatDateTime } from "@/lib/format";
import type { AutomationTrigger, CampaignChannel } from "@prisma/client";

type CouponOption = { id: string; code: string };

export type AutomationRow = {
  id: string;
  name: string;
  trigger: AutomationTrigger;
  enabled: boolean;
  delayHours: number;
  channels: CampaignChannel[];
  title: string;
  body: string;
  imageUrl: string | null;
  ctaText: string | null;
  ctaUrl: string | null;
  couponId: string | null;
  sentCount: number;
  lastRunAt: string | null;
};

function delayLabel(hours: number) {
  if (hours === 0) return "immediately";
  if (hours % 24 === 0) return `${hours / 24} day${hours / 24 === 1 ? "" : "s"}`;
  return `${hours} hour${hours === 1 ? "" : "s"}`;
}

export function AutomationsManager({
  rules,
  coupons,
  cloudinaryReady,
}: {
  rules: AutomationRow[];
  coupons: CouponOption[];
  cloudinaryReady: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AutomationRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");

  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState<AutomationTrigger>("WELCOME");
  const [delayValue, setDelayValue] = useState(1);
  const [delayUnit, setDelayUnit] = useState<"hours" | "days">("hours");
  const [channels, setChannels] = useState<Set<CampaignChannel>>(new Set(["IN_APP", "EMAIL"]));
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [ctaText, setCtaText] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [couponId, setCouponId] = useState("");

  const field = "h-9 w-full rounded-md border bg-transparent px-3 text-sm";

  function openAdd() {
    setEditing(null);
    setName("");
    setTrigger("WELCOME");
    setDelayValue(1);
    setDelayUnit("hours");
    setChannels(new Set(["IN_APP", "EMAIL"]));
    setTitle("");
    setBody("");
    setImageUrl("");
    setCtaText("");
    setCtaUrl("");
    setCouponId("");
    setAiPrompt("");
    setOpen(true);
  }
  function openEdit(r: AutomationRow) {
    setEditing(r);
    setName(r.name);
    setTrigger(r.trigger);
    if (r.delayHours % 24 === 0 && r.delayHours >= 24) {
      setDelayValue(r.delayHours / 24);
      setDelayUnit("days");
    } else {
      setDelayValue(r.delayHours);
      setDelayUnit("hours");
    }
    setChannels(new Set(r.channels));
    setTitle(r.title);
    setBody(r.body);
    setImageUrl(r.imageUrl ?? "");
    setCtaText(r.ctaText ?? "");
    setCtaUrl(r.ctaUrl ?? "");
    setCouponId(r.couponId ?? "");
    setAiPrompt("");
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

  async function runAI() {
    if (aiPrompt.trim().length < 3) {
      toast.error("Describe the message first.");
      return;
    }
    setAiBusy(true);
    const res = await generateContent({ prompt: aiPrompt });
    setAiBusy(false);
    if (res.ok) {
      setTitle(res.data!.title);
      setBody(res.data!.body);
      setCtaText(res.data!.ctaText);
      toast.success("Draft generated ✨");
    } else {
      toast.error(res.error);
    }
  }

  async function onSave() {
    if (!name.trim() || !title.trim() || !body.trim()) {
      toast.error("Name, title and message are required.");
      return;
    }
    setSaving(true);
    const delayHours = delayUnit === "days" ? delayValue * 24 : delayValue;
    const res = await saveAutomationRule({
      id: editing?.id,
      name,
      trigger,
      enabled: editing?.enabled ?? true,
      delayHours,
      channels: [...channels],
      title,
      body,
      imageUrl,
      ctaText,
      ctaUrl,
      couponId: couponId || null,
    });
    setSaving(false);
    if (res.ok) {
      toast.success(editing ? "Automation updated" : "Automation created");
      setOpen(false);
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  function onToggle(r: AutomationRow) {
    toggleAutomationRule(r.id, !r.enabled).then((res) => {
      if (res.ok) {
        toast.success(r.enabled ? "Paused" : "Activated");
        router.refresh();
      } else toast.error(res.error);
    });
  }
  function onDelete(r: AutomationRow) {
    if (!confirm(`Delete automation "${r.name}"?`)) return;
    deleteAutomationRule(r.id).then((res) => {
      if (res.ok) {
        toast.success("Automation deleted");
        router.refresh();
      } else toast.error(res.error);
    });
  }
  function onRunNow() {
    setRunning(true);
    runAutomationsNow().then((res) => {
      setRunning(false);
      if (res.ok) {
        toast.success(`Sent ${res.data?.sent ?? 0} message(s)`);
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Rules run automatically (every ~5 min). Dedup ensures each recipient gets a rule once.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-1.5" disabled={running} onClick={onRunNow}>
            {running ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
            Run now
          </Button>
          <Button className="gap-1.5" onClick={openAdd}>
            <Plus className="size-4" /> New automation
          </Button>
        </div>
      </div>

      {rules.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <Zap className="mx-auto size-10 text-muted-foreground/40" />
          <p className="mt-3 font-medium">No automations yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Create welcome, abandoned-cart, win-back and post-purchase flows that send themselves.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {rules.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 rounded-xl border bg-background p-3">
              <Switch checked={r.enabled} onCheckedChange={() => onToggle(r)} aria-label="Toggle" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{r.name}</p>
                <p className="text-xs text-muted-foreground">
                  {AUTOMATION_TRIGGER_LABEL[r.trigger]} · after {delayLabel(r.delayHours)} ·{" "}
                  {r.channels.map((c) => CHANNEL_LABEL[c]).join(", ")}
                </p>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <p className="font-semibold text-foreground">{r.sentCount} sent</p>
                {r.lastRunAt && <p>last {formatDateTime(r.lastRunAt)}</p>}
              </div>
              <Badge variant={r.enabled ? "default" : "secondary"}>{r.enabled ? "Active" : "Paused"}</Badge>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => openEdit(r)} aria-label="Edit">
                  <Pencil className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => onDelete(r)}
                  aria-label="Delete"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit automation" : "New automation"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Welcome series" />
            </div>
            <div className="space-y-1.5">
              <Label>Trigger</Label>
              <select className={field} value={trigger} onChange={(e) => setTrigger(e.target.value as AutomationTrigger)}>
                {AUTOMATION_TRIGGERS.map((t) => (
                  <option key={t} value={t}>
                    {AUTOMATION_TRIGGER_LABEL[t]}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">{AUTOMATION_TRIGGER_DESCRIPTION[trigger]}</p>
            </div>
            <div className="space-y-1.5">
              <Label>Delay {trigger === "WINBACK" ? "(inactivity period)" : "after trigger"}</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={0}
                  value={delayValue}
                  onChange={(e) => setDelayValue(Number(e.target.value))}
                  className="w-28"
                />
                <select className={`${field} w-32`} value={delayUnit} onChange={(e) => setDelayUnit(e.target.value as "hours" | "days")}>
                  <option value="hours">hours</option>
                  <option value="days">days</option>
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

            <div className="space-y-2 rounded-xl border bg-primary/5 p-3">
              <Label className="flex items-center gap-1.5 text-xs">
                <Sparkles className="size-3.5 text-primary" /> AI assistant
              </Label>
              <div className="flex gap-2">
                <Input value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} placeholder="Describe the message…" />
                <Button type="button" variant="outline" size="sm" disabled={aiBusy} onClick={runAI}>
                  {aiBusy ? <Loader2 className="size-4 animate-spin" /> : "Generate"}
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Message</Label>
              <Textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Image (optional)</Label>
              <ImageUploadField value={imageUrl} onChange={setImageUrl} cloudinaryReady={cloudinaryReady} folder="marketing" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Button text</Label>
                <Input value={ctaText} onChange={(e) => setCtaText(e.target.value)} placeholder="Shop now" />
              </div>
              <div className="space-y-1.5">
                <Label>Button link</Label>
                <Input value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} placeholder="/products" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Attach a coupon (optional)</Label>
              <select className={field} value={couponId} onChange={(e) => setCouponId(e.target.value)}>
                <option value="">None</option>
                {coupons.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code}
                  </option>
                ))}
              </select>
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
