"use client";

import { useState, useTransition } from "react";
import { Loader2, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updatePwaSettings } from "@/lib/actions/admin/pwa";
import { PwaPromptCard } from "@/components/storefront/pwa-install-prompt";
import type { PwaSettings } from "@/lib/pwa-config";

/**
 * Admin → Appearance: copy for the storefront's "Install App" instructions.
 * Installing is user-initiated only (Menu → Install App); nothing pops up by
 * itself, so the old on/off, button-text and reminder settings are retired —
 * their stored values are kept untouched in the blob but no longer used.
 * Saves apply immediately (root-layout revalidation), no redeploy.
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
      if (res.ok) toast.success("Install App settings saved");
      else toast.error(res.error);
    });
  }

  return (
    <section className="mt-8 rounded-2xl border p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
            <Smartphone className="size-4" />
          </span>
          <div>
            <h2 className="font-semibold">Install App</h2>
            <p className="text-xs text-muted-foreground">
              Visitors install the Nutriyet app (PWA) from Menu → Install App — nothing pops up
              automatically. This title and description head the install instructions shown when
              their browser needs manual steps.
            </p>
          </div>
        </div>
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
          <Button onClick={save} disabled={pending} className="gap-2">
            {pending && <Loader2 className="size-4 animate-spin" />}
            Save
          </Button>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Preview (iPhone instructions)
          </p>
          <div className="pointer-events-none rounded-2xl bg-muted/40 p-4">
            <PwaPromptCard
              mode="ios"
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
