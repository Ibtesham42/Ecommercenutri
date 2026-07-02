"use client";

import { useState, useTransition } from "react";
import { Loader2, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { updatePwaSettings } from "@/lib/actions/admin/pwa";
import { PwaPromptCard } from "@/components/storefront/pwa-install-prompt";
import { PWA_REMIND_OPTIONS, type PwaSettings } from "@/lib/pwa-settings";

/**
 * Admin → Appearance: PWA install-prompt settings — copy, reminder interval and
 * a live preview that renders the real storefront card. Saves apply to the
 * storefront immediately (root-layout revalidation), no redeploy.
 */
export function PwaPromptSettings({
  initial,
  logoUrl,
}: {
  initial: PwaSettings;
  logoUrl: string | null;
}) {
  const [form, setForm] = useState<PwaSettings>(initial);
  const [pending, start] = useTransition();

  const set = <K extends keyof PwaSettings>(k: K, v: PwaSettings[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  function save() {
    start(async () => {
      const res = await updatePwaSettings(form);
      if (res.ok) toast.success("Install prompt settings saved");
      else toast.error(res.error);
    });
  }

  const field = "h-9 w-full rounded-md border bg-transparent px-3 text-sm";

  return (
    <section className="mt-8 rounded-2xl border p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
            <Smartphone className="size-4" />
          </span>
          <div>
            <h2 className="font-semibold">App install prompt</h2>
            <p className="text-xs text-muted-foreground">
              Invites visitors to install the Nutriyet app (PWA). Never shown once installed.
            </p>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={form.enabled} onCheckedChange={(v) => set("enabled", v)} />
          {form.enabled ? "Enabled" : "Disabled"}
        </label>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="pwa-title">Title</Label>
            <Input
              id="pwa-title"
              maxLength={60}
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pwa-desc">Description</Label>
            <Textarea
              id="pwa-desc"
              rows={2}
              maxLength={160}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pwa-install">Install button</Label>
              <Input
                id="pwa-install"
                maxLength={30}
                value={form.installText}
                onChange={(e) => set("installText", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pwa-later">Later button</Label>
              <Input
                id="pwa-later"
                maxLength={30}
                value={form.laterText}
                onChange={(e) => set("laterText", e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pwa-remind">Remind again after</Label>
            <select
              id="pwa-remind"
              className={field}
              value={form.remindDays}
              onChange={(e) => set("remindDays", Number(e.target.value))}
            >
              {PWA_REMIND_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d} day{d === 1 ? "" : "s"}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              How long after &ldquo;{form.laterText || "Maybe Later"}&rdquo; before the prompt may
              appear again.
            </p>
          </div>
          <Button onClick={save} disabled={pending} className="gap-2">
            {pending && <Loader2 className="size-4 animate-spin" />}
            Save
          </Button>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Live preview
          </p>
          <div className="pointer-events-none rounded-2xl bg-muted/40 p-4">
            <PwaPromptCard
              mode="native"
              title={form.title || "Install Nutriyet App"}
              description={form.description || "Faster loading, works offline."}
              installText={form.installText || "Install Now"}
              laterText={form.laterText || "Maybe Later"}
              logoUrl={logoUrl}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
