"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles, Send, CalendarClock, Save, Users, Repeat, FlaskConical } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ImageUploadField } from "@/components/admin/image-upload-field";
import {
  saveCampaign,
  sendCampaign,
  sendCampaignTest,
  scheduleCampaign,
  generateContent,
  previewAudience,
} from "@/lib/actions/admin/marketing";
import { outcomeSummary } from "@/lib/marketing/automation-types";
import {
  CHANNELS,
  CHANNEL_LABEL,
  CHANNEL_LIVE,
  SEGMENTS,
  SEGMENT_LABEL,
  SEGMENT_DESCRIPTION,
  SEGMENT_NEEDS,
  RECURRENCE_VALUES,
  RECURRENCE_LABEL,
  type Recurrence,
} from "@/lib/marketing/channels";
import type { CampaignChannel, SegmentType } from "@prisma/client";

type Option = { id: string; name: string };
type CouponOption = { id: string; code: string };
type TemplateOption = {
  id: string;
  name: string;
  channels: CampaignChannel[];
  title: string;
  body: string;
  ctaText: string | null;
  imageUrl: string | null;
};
type SegmentOption = { id: string; name: string; type: SegmentType; config: unknown };

export type EditorCampaign = {
  id: string;
  name: string;
  channels: CampaignChannel[];
  title: string;
  body: string;
  imageUrl: string | null;
  ctaText: string | null;
  ctaUrl: string | null;
  segmentType: SegmentType;
  segmentConfig: { productId?: string | null; categoryId?: string | null; userIds?: string[]; inactiveDays?: number | null } | null;
  productId: string | null;
  couponId: string | null;
  recurrence: string | null;
};

export function CampaignEditor({
  campaign,
  products,
  coupons,
  categories,
  templates,
  segments,
  channelConfig,
  cloudinaryReady,
}: {
  campaign: EditorCampaign | null;
  products: Option[];
  coupons: CouponOption[];
  categories: Option[];
  templates: TemplateOption[];
  segments: SegmentOption[];
  channelConfig: Record<CampaignChannel, boolean>;
  cloudinaryReady: boolean;
}) {
  const router = useRouter();
  const cfg = campaign?.segmentConfig ?? {};

  const [name, setName] = useState(campaign?.name ?? "");
  const [channels, setChannels] = useState<Set<CampaignChannel>>(
    new Set(campaign?.channels ?? ["IN_APP", "EMAIL"]),
  );
  const [title, setTitle] = useState(campaign?.title ?? "");
  const [body, setBody] = useState(campaign?.body ?? "");
  const [imageUrl, setImageUrl] = useState(campaign?.imageUrl ?? "");
  const [ctaText, setCtaText] = useState(campaign?.ctaText ?? "");
  const [ctaUrl, setCtaUrl] = useState(campaign?.ctaUrl ?? "");

  const [segmentType, setSegmentType] = useState<SegmentType>(campaign?.segmentType ?? "ALL_USERS");
  const [segProduct, setSegProduct] = useState(cfg.productId ?? "");
  const [segCategory, setSegCategory] = useState(cfg.categoryId ?? "");
  const [segDays, setSegDays] = useState(cfg.inactiveDays ?? 60);
  const [segUserIds, setSegUserIds] = useState((cfg.userIds ?? []).join(", "));

  const [productId, setProductId] = useState(campaign?.productId ?? "");
  const [couponId, setCouponId] = useState(campaign?.couponId ?? "");

  const [aiPrompt, setAiPrompt] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [audience, setAudience] = useState<number | null>(null);
  const [scheduleAt, setScheduleAt] = useState("");
  const [recurrence, setRecurrence] = useState<Recurrence>(
    (campaign?.recurrence as Recurrence) ?? "NONE",
  );
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const recurring = recurrence !== "NONE";

  const segmentConfig = () => ({
    productId: SEGMENT_NEEDS.product.includes(segmentType) ? segProduct || null : null,
    categoryId: SEGMENT_NEEDS.category.includes(segmentType) ? segCategory || null : null,
    inactiveDays: SEGMENT_NEEDS.inactiveDays.includes(segmentType) ? Number(segDays) || 60 : null,
    userIds: SEGMENT_NEEDS.userIds.includes(segmentType)
      ? segUserIds.split(",").map((s) => s.trim()).filter(Boolean)
      : [],
  });

  // Live audience size whenever the targeting changes.
  useEffect(() => {
    let active = true;
    previewAudience({ type: segmentType, config: segmentConfig() }).then((res) => {
      if (active) setAudience(res.ok ? res.data!.count : null);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segmentType, segProduct, segCategory, segDays, segUserIds]);

  function toggleChannel(ch: CampaignChannel) {
    if (!CHANNEL_LIVE[ch]) return;
    setChannels((prev) => {
      const next = new Set(prev);
      if (next.has(ch)) next.delete(ch);
      else next.add(ch);
      return next;
    });
  }

  function applyTemplate(t: TemplateOption) {
    setTitle(t.title);
    setBody(t.body);
    setCtaText(t.ctaText ?? "");
    if (t.imageUrl) setImageUrl(t.imageUrl);
    setChannels(new Set(t.channels));
    if (!name) setName(t.name);
    toast.success(`Loaded "${t.name}"`);
  }

  function applySegment(s: SegmentOption) {
    setSegmentType(s.type);
    const c = (s.config ?? {}) as EditorCampaign["segmentConfig"];
    setSegProduct(c?.productId ?? "");
    setSegCategory(c?.categoryId ?? "");
    setSegDays(c?.inactiveDays ?? 60);
    setSegUserIds((c?.userIds ?? []).join(", "));
  }

  async function runAI() {
    if (aiPrompt.trim().length < 3) {
      toast.error("Describe the campaign first.");
      return;
    }
    setAiBusy(true);
    const res = await generateContent({ prompt: aiPrompt, channel: channels.has("EMAIL") ? "email" : "in-app" });
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

  async function persist(): Promise<string | null> {
    if (!name.trim()) {
      toast.error("Name the campaign.");
      return null;
    }
    if (!title.trim() || !body.trim()) {
      toast.error("Add a title and message.");
      return null;
    }
    if (channels.size === 0) {
      toast.error("Pick at least one channel.");
      return null;
    }
    const res = await saveCampaign({
      id: campaign?.id,
      name,
      channels: [...channels],
      title,
      body,
      imageUrl,
      ctaText,
      ctaUrl,
      segmentType,
      segmentConfig: segmentConfig(),
      productId: productId || null,
      couponId: couponId || null,
      recurrence,
    });
    if (!res.ok) {
      toast.error(res.error);
      return null;
    }
    return res.data!.id;
  }

  async function onSaveDraft() {
    setBusy(true);
    const id = await persist();
    setBusy(false);
    if (id) {
      toast.success("Draft saved");
      router.push("/admin/marketing/campaigns");
    }
  }

  /** Deliver the current (unsaved) compose state to the signed-in admin only. */
  async function onTestSend() {
    if (!title.trim() || !body.trim()) {
      toast.error("Add a title and message.");
      return;
    }
    if (channels.size === 0) {
      toast.error("Pick at least one channel.");
      return;
    }
    setTesting(true);
    const res = await sendCampaignTest({ channels: [...channels], title, body, imageUrl, ctaText, ctaUrl });
    setTesting(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    const { sent, problems } = outcomeSummary(res.data?.outcomes ?? []);
    if (sent.length > 0) {
      toast.success(`Test sent to you via ${sent.join(", ")}`, {
        description: problems.length > 0 ? problems.join(" · ") : undefined,
      });
    } else {
      toast.error("Test delivered on no channel", {
        description: problems.join(" · ") || "No channel could deliver.",
      });
    }
  }

  async function onSendNow() {
    if (!confirm(`Send now to ~${audience ?? 0} recipient(s)? Messages go out immediately.`)) return;
    setBusy(true);
    const id = await persist();
    if (!id) {
      setBusy(false);
      return;
    }
    const res = await sendCampaign(id);
    setBusy(false);
    if (res.ok) {
      toast.success(`Sent to ${res.data!.sent} recipient(s) 🚀`);
      router.push("/admin/marketing/campaigns");
    } else {
      toast.error(res.error);
    }
  }

  async function onSchedule() {
    if (!scheduleAt) {
      toast.error("Pick a date and time.");
      return;
    }
    setBusy(true);
    const id = await persist();
    if (!id) {
      setBusy(false);
      return;
    }
    const res = await scheduleCampaign(id, new Date(scheduleAt).toISOString());
    setBusy(false);
    if (res.ok) {
      toast.success("Campaign scheduled ⏰");
      router.push("/admin/marketing/campaigns");
    } else {
      toast.error(res.error);
    }
  }

  const field = "h-9 w-full rounded-md border bg-transparent px-3 text-sm";

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      {/* Editor */}
      <div className="space-y-5">
        <section className="space-y-3 rounded-2xl border p-5">
          <div className="space-y-1.5">
            <Label htmlFor="cname">Campaign name (internal)</Label>
            <Input id="cname" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. October flash sale" />
          </div>

          {templates.length > 0 && (
            <div className="space-y-1.5">
              <Label>Start from a template</Label>
              <select
                className={field}
                value=""
                onChange={(e) => {
                  const t = templates.find((x) => x.id === e.target.value);
                  if (t) applyTemplate(t);
                  e.target.value = "";
                }}
              >
                <option value="">Choose a template…</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </section>

        {/* AI assist */}
        <section className="space-y-2 rounded-2xl border bg-primary/5 p-5">
          <Label className="flex items-center gap-1.5">
            <Sparkles className="size-4 text-primary" /> AI content assistant
          </Label>
          <Textarea
            rows={2}
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder="Describe your campaign — e.g. 'Diwali sale on dry fruits, 20% off, festive and warm tone'"
          />
          <Button type="button" variant="outline" size="sm" className="gap-1.5" disabled={aiBusy} onClick={runAI}>
            {aiBusy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            Generate copy
          </Button>
        </section>

        {/* Content */}
        <section className="space-y-3 rounded-2xl border p-5">
          <h2 className="font-semibold">Content</h2>
          <div className="space-y-1.5">
            <Label htmlFor="ctitle">Title</Label>
            <Input id="ctitle" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cbody">Message</Label>
            <Textarea id="cbody" rows={6} value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Image (optional)</Label>
            <ImageUploadField value={imageUrl} onChange={setImageUrl} cloudinaryReady={cloudinaryReady} folder="marketing" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ccta">Button text</Label>
              <Input id="ccta" value={ctaText} onChange={(e) => setCtaText(e.target.value)} placeholder="Shop now" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ccturl">Button link</Label>
              <Input id="ccturl" value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} placeholder="/products or https://…" />
            </div>
          </div>
        </section>

        {/* Attach product / coupon */}
        <section className="grid gap-3 rounded-2xl border p-5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="cprod">Feature a product (optional)</Label>
            <select id="cprod" className={field} value={productId} onChange={(e) => setProductId(e.target.value)}>
              <option value="">None</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ccoupon">Attach a coupon (optional)</Label>
            <select id="ccoupon" className={field} value={couponId} onChange={(e) => setCouponId(e.target.value)}>
              <option value="">None</option>
              {coupons.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code}
                </option>
              ))}
            </select>
          </div>
        </section>
      </div>

      {/* Sidebar: channels, audience, schedule */}
      <aside className="space-y-5">
        <section className="space-y-2 rounded-2xl border p-5">
          <h2 className="font-semibold">Channels</h2>
          <div className="flex flex-wrap gap-1.5">
            {CHANNELS.map((ch) => {
              const on = channels.has(ch);
              return (
                <button
                  key={ch}
                  type="button"
                  onClick={() => toggleChannel(ch)}
                  className={`rounded-full border px-3 py-1 text-sm transition ${
                    on ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-accent"
                  }`}
                >
                  {CHANNEL_LABEL[ch]}
                </button>
              );
            })}
          </div>
          {[...channels].some((c) => !channelConfig[c]) && (
            <p className="text-xs text-amber-600">
              Needs setup: {[...channels].filter((c) => !channelConfig[c]).map((c) => CHANNEL_LABEL[c]).join(", ")} —
              add provider keys or these recipients are skipped.
            </p>
          )}
        </section>

        <section className="space-y-3 rounded-2xl border p-5">
          <h2 className="flex items-center gap-1.5 font-semibold">
            <Users className="size-4 text-primary" /> Audience
          </h2>
          {segments.length > 0 && (
            <select
              className={field}
              value=""
              onChange={(e) => {
                const s = segments.find((x) => x.id === e.target.value);
                if (s) applySegment(s);
                e.target.value = "";
              }}
            >
              <option value="">Load a saved segment…</option>
              {segments.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
          <select className={field} value={segmentType} onChange={(e) => setSegmentType(e.target.value as SegmentType)}>
            {SEGMENTS.map((s) => (
              <option key={s} value={s}>
                {SEGMENT_LABEL[s]}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">{SEGMENT_DESCRIPTION[segmentType]}</p>

          {SEGMENT_NEEDS.product.includes(segmentType) && (
            <select className={field} value={segProduct} onChange={(e) => setSegProduct(e.target.value)}>
              <option value="">Any product</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
          {SEGMENT_NEEDS.category.includes(segmentType) && (
            <select className={field} value={segCategory} onChange={(e) => setSegCategory(e.target.value)}>
              <option value="">Pick a category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          {SEGMENT_NEEDS.inactiveDays.includes(segmentType) && (
            <div className="space-y-1">
              <Label className="text-xs">Inactive for at least (days)</Label>
              <Input type="number" min={1} value={segDays} onChange={(e) => setSegDays(Number(e.target.value))} />
            </div>
          )}
          {SEGMENT_NEEDS.userIds.includes(segmentType) && (
            <div className="space-y-1">
              <Label className="text-xs">User IDs (comma-separated)</Label>
              <Textarea rows={2} value={segUserIds} onChange={(e) => setSegUserIds(e.target.value)} />
            </div>
          )}

          <div className="rounded-lg bg-accent/40 p-3 text-center">
            <p className="text-2xl font-bold tabular-nums">{audience ?? "…"}</p>
            <p className="text-xs text-muted-foreground">recipients in this audience</p>
          </div>
        </section>

        <section className="space-y-3 rounded-2xl border p-5">
          <h2 className="font-semibold">Send</h2>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs">
              <Repeat className="size-3.5" /> Repeat
            </Label>
            <select className={field} value={recurrence} onChange={(e) => setRecurrence(e.target.value as Recurrence)}>
              {RECURRENCE_VALUES.map((r) => (
                <option key={r} value={r}>
                  {RECURRENCE_LABEL[r]}
                </option>
              ))}
            </select>
          </div>

          <Button type="button" variant="outline" className="w-full gap-1.5" disabled={busy || testing} onClick={onTestSend}>
            {testing ? <Loader2 className="size-4 animate-spin" /> : <FlaskConical className="size-4" />}
            Send test to me
          </Button>
          {!recurring && (
            <Button type="button" className="w-full gap-1.5" disabled={busy} onClick={onSendNow}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              Send now
            </Button>
          )}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs">
              <CalendarClock className="size-3.5" /> {recurring ? "First run" : "Or schedule for later"}
            </Label>
            <Input type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} />
            <Button type="button" variant="outline" className="w-full gap-1.5" disabled={busy || !scheduleAt} onClick={onSchedule}>
              <CalendarClock className="size-4" /> {recurring ? `Schedule ${RECURRENCE_LABEL[recurrence].toLowerCase()}` : "Schedule"}
            </Button>
            {recurring && (
              <p className="text-[11px] text-muted-foreground">
                Repeats {RECURRENCE_LABEL[recurrence].toLowerCase()} from the first run. Each send is
                logged as its own campaign; cancel anytime from the list.
              </p>
            )}
          </div>
          <Button type="button" variant="ghost" className="w-full gap-1.5" disabled={busy} onClick={onSaveDraft}>
            <Save className="size-4" /> Save as draft
          </Button>
        </section>
      </aside>
    </div>
  );
}
