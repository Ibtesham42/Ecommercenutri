"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Sparkles, BellRing, Megaphone, ShieldCheck, TicketPercent } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { updateGrowthSettings } from "@/lib/actions/admin/growth";
import type { GrowthSettings } from "@/lib/growth-settings";

type Row = { key: keyof GrowthSettings; label: string; help: string; icon: typeof Sparkles };

const TOGGLES: Row[] = [
  { key: "quizEnabled", label: "AI Health Score Quiz", help: "The /quiz assessment that captures signups + grants the welcome coupon.", icon: Sparkles },
  { key: "welcomePopupEnabled", label: "Smart Welcome Popup", help: "First-time, logged-out visitors, once/24h, after 10s or 40% scroll.", icon: BellRing },
  { key: "stickyBarEnabled", label: "Sticky Offer Bar", help: "Dismissible top bar with Get Coupon + Take Assessment.", icon: Megaphone },
  { key: "trustEnabled", label: "Trust Section", help: "Badges + real stats below the hero (never fabricated numbers).", icon: ShieldCheck },
];

export function GrowthManager({ initial }: { initial: GrowthSettings }) {
  const [values, setValues] = useState<GrowthSettings>(initial);
  const [pending, startTransition] = useTransition();

  function set<K extends keyof GrowthSettings>(key: K, value: GrowthSettings[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function save() {
    startTransition(async () => {
      const res = await updateGrowthSettings({
        ...values,
        couponPercent: Number(values.couponPercent),
      });
      if (res.ok) toast.success("Growth settings saved.");
      else toast.error(res.error);
    });
  }

  return (
    <div className="space-y-5">
      {/* Feature toggles */}
      <div className="rounded-2xl border bg-card p-4 shadow-elev-1 sm:p-5">
        <h2 className="mb-4 font-heading text-lg font-semibold">Features</h2>
        <div className="space-y-3">
          {TOGGLES.map((row) => (
            <label
              key={row.key}
              htmlFor={row.key}
              className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border p-3.5"
            >
              <span className="flex items-start gap-3">
                <row.icon className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>
                  <span className="block text-sm font-medium">{row.label}</span>
                  <span className="block text-xs text-muted-foreground">{row.help}</span>
                </span>
              </span>
              <Switch
                id={row.key}
                checked={values[row.key] as boolean}
                onCheckedChange={(c) => set(row.key, c as GrowthSettings[typeof row.key])}
              />
            </label>
          ))}
        </div>
      </div>

      {/* Welcome coupon */}
      <div className="rounded-2xl border bg-card p-4 shadow-elev-1 sm:p-5">
        <h2 className="mb-1 flex items-center gap-2 font-heading text-lg font-semibold">
          <TicketPercent className="size-4 text-primary" /> Welcome coupon
        </h2>
        <p className="mb-4 text-xs text-muted-foreground">
          A shared, public discount code (one use per customer) surfaced by the quiz, popup and bar.
          Saving keeps a real coupon in sync so it works at checkout immediately.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="couponCode">Coupon code</Label>
            <Input
              id="couponCode"
              value={values.couponCode}
              onChange={(e) => set("couponCode", e.target.value.toUpperCase())}
              className="font-mono uppercase tracking-wider"
              maxLength={24}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="couponPercent">Discount %</Label>
            <Input
              id="couponPercent"
              type="number"
              min={1}
              max={90}
              value={values.couponPercent}
              onChange={(e) => set("couponPercent", Number(e.target.value) as GrowthSettings["couponPercent"])}
            />
          </div>
        </div>
      </div>

      {/* Copy */}
      <div className="rounded-2xl border bg-card p-4 shadow-elev-1 sm:p-5">
        <h2 className="mb-4 font-heading text-lg font-semibold">Messaging</h2>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="stickyText">Sticky bar text</Label>
            <Input id="stickyText" value={values.stickyText} onChange={(e) => set("stickyText", e.target.value)} maxLength={160} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="popupTitle">Popup title</Label>
            <Input id="popupTitle" value={values.popupTitle} onChange={(e) => set("popupTitle", e.target.value)} maxLength={80} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="popupSubtitle">Popup subtitle</Label>
            <Textarea id="popupSubtitle" value={values.popupSubtitle} onChange={(e) => set("popupSubtitle", e.target.value)} maxLength={160} rows={2} />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={pending} className="min-w-32">
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
