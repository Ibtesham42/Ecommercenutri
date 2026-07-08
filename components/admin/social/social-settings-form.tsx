"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { SocialSettings } from "@/lib/social/settings";
import type { SocialPublishMode } from "@prisma/client";
import { SOCIAL_MODE_VALUES } from "@/lib/validations/social";
import { PUBLISH_MODE_LABEL } from "@/lib/social/status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { saveSocialSettings } from "@/lib/actions/admin/social";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function SocialSettingsForm({ settings }: { settings: SocialSettings }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [s, setS] = useState(settings);
  const [hashtags, setHashtags] = useState(settings.defaultHashtags.join(" "));
  const [banned, setBanned] = useState(settings.bannedWords.join(", "));

  const set = <K extends keyof SocialSettings>(k: K, v: SocialSettings[K]) =>
    setS((p) => ({ ...p, [k]: v }));

  const save = () =>
    start(async () => {
      const res = await saveSocialSettings({
        ...s,
        defaultHashtags: hashtags
          .split(/[\s,]+/)
          .map((t) => (t.startsWith("#") ? t : t ? `#${t}` : ""))
          .filter(Boolean),
        bannedWords: banned
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      });
      if (res.ok) {
        toast.success("Settings saved.");
        router.refresh();
      } else {
        toast.error(res.error ?? "Couldn't save.");
      }
    });

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center justify-between rounded-xl border p-3">
        <div>
          <p className="font-medium">Automation enabled</p>
          <p className="text-sm text-muted-foreground">Master switch for the AI Marketing planner.</p>
        </div>
        <Switch checked={s.enabled} onCheckedChange={(v) => set("enabled", v)} />
      </div>

      <div>
        <Label htmlFor="brand-voice">Brand voice</Label>
        <Textarea id="brand-voice" rows={4} value={s.brandVoice} onChange={(e) => set("brandVoice", e.target.value)} maxLength={600} />
        <p className="mt-1 text-xs text-muted-foreground">Guides tone for every generated caption.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="s-morning">Default morning time (IST)</Label>
          <Input id="s-morning" type="time" value={s.morningTime} onChange={(e) => set("morningTime", e.target.value)} />
        </div>
        <div>
          <Label htmlFor="s-evening">Default evening time (IST)</Label>
          <Input id="s-evening" type="time" value={s.eveningTime} onChange={(e) => set("eveningTime", e.target.value)} />
        </div>
      </div>

      <div>
        <Label>Default days</Label>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {DAY_LABELS.map((label, i) => {
            const on = s.days.includes(i);
            return (
              <button
                key={i}
                type="button"
                onClick={() =>
                  set("days", (on ? s.days.filter((d) => d !== i) : [...s.days, i]).sort((a, b) => a - b))
                }
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

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="s-max">Default max posts/day</Label>
          <Input id="s-max" type="number" min={1} max={10} value={s.maxPerDay} onChange={(e) => set("maxPerDay", Number(e.target.value) || 1)} />
        </div>
        <div>
          <Label>Default publish mode</Label>
          <Select value={s.mode} onValueChange={(v) => set("mode", v as SocialPublishMode)}>
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
        </div>
      </div>

      <div>
        <Label htmlFor="s-tags">Default hashtags</Label>
        <Textarea id="s-tags" rows={2} value={hashtags} onChange={(e) => setHashtags(e.target.value)} />
        <p className="mt-1 text-xs text-muted-foreground">Always mixed into generated posts (brand tags).</p>
      </div>

      <div>
        <Label htmlFor="s-banned">Banned words / claims</Label>
        <Textarea id="s-banned" rows={2} value={banned} onChange={(e) => setBanned(e.target.value)} />
        <p className="mt-1 text-xs text-muted-foreground">
          Comma-separated. These are stripped from any generated copy (health-claim safety).
        </p>
      </div>

      <div className="flex items-center justify-between rounded-xl border p-3">
        <div>
          <p className="font-medium">Carousel posts</p>
          <p className="text-sm text-muted-foreground">Use multiple product images when available.</p>
        </div>
        <Switch checked={s.carouselEnabled} onCheckedChange={(v) => set("carouselEnabled", v)} />
      </div>

      <Button onClick={save} disabled={pending}>
        {pending ? "Saving…" : "Save settings"}
      </Button>
    </div>
  );
}
