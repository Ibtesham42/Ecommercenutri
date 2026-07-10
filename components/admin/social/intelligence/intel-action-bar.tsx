"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Play, Lightbulb, Settings2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  runIntelligenceNow,
  generateIdeasNow,
  saveIntelligenceSettings,
} from "@/lib/actions/admin/intelligence";
import type { IntelligenceSettings } from "@/lib/intelligence/settings";

export function IntelActionBar({ settings }: { settings: IntelligenceSettings }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<IntelligenceSettings>(settings);

  const run = () =>
    start(async () => {
      toast.info("Running market analysis — this can take a minute…");
      const res = await runIntelligenceNow();
      if (res.ok) {
        toast.success(
          res.data
            ? `Analysis complete: ${res.data.profilesRefreshed} profiles refreshed, ${res.data.ideas} new ideas.`
            : "Analysis complete.",
        );
        router.refresh();
      } else {
        toast.error(res.error ?? "Run failed.");
      }
    });

  const ideas = () =>
    start(async () => {
      toast.info("Generating today's content ideas…");
      const res = await generateIdeasNow();
      if (res.ok) {
        toast.success(res.data ? `${res.data.ideas} fresh ideas generated.` : "Ideas generated.");
        router.refresh();
      } else {
        toast.error(res.error ?? "Couldn't generate ideas.");
      }
    });

  const saveSettings = () =>
    start(async () => {
      const res = await saveIntelligenceSettings(form);
      if (res.ok) {
        toast.success("Settings saved.");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.error ?? "Couldn't save.");
      }
    });

  const num = (v: string, fallback: number) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? n : fallback;
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" asChild>
        <Link href="/admin/social/intelligence/competitors">
          <Users className="mr-2 size-4" /> Competitors
        </Link>
      </Button>
      <Button size="sm" variant="outline" onClick={ideas} disabled={pending}>
        <Lightbulb className="mr-2 size-4" /> Generate ideas
      </Button>
      <Button size="sm" onClick={run} disabled={pending}>
        <Play className="mr-2 size-4" /> {pending ? "Working…" : "Run analysis"}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        aria-label="Intelligence settings"
        onClick={() => {
          setForm(settings);
          setOpen(true);
        }}
      >
        <Settings2 className="size-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Intelligence settings</DialogTitle>
            <DialogDescription>
              Controls the automated research schedule and the quality bar for recommendations.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label htmlFor="intel-enabled">Automation enabled</Label>
                <p className="text-xs text-muted-foreground">
                  Refresh profiles, trends and daily ideas on the cron.
                </p>
              </div>
              <Switch
                id="intel-enabled"
                checked={form.enabled}
                onCheckedChange={(v) => setForm({ ...form, enabled: v })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="intel-hour">Run after (IST hour)</Label>
                <Input
                  id="intel-hour"
                  type="number"
                  min={0}
                  max={23}
                  value={form.runHour}
                  onChange={(e) => setForm({ ...form, runHour: num(e.target.value, form.runHour) })}
                />
              </div>
              <div>
                <Label htmlFor="intel-refresh">Profile refresh (days)</Label>
                <Input
                  id="intel-refresh"
                  type="number"
                  min={1}
                  max={30}
                  value={form.competitorRefreshDays}
                  onChange={(e) =>
                    setForm({ ...form, competitorRefreshDays: num(e.target.value, form.competitorRefreshDays) })
                  }
                />
              </div>
              <div>
                <Label htmlFor="intel-ideas">Ideas per morning</Label>
                <Input
                  id="intel-ideas"
                  type="number"
                  min={5}
                  max={30}
                  value={form.ideasPerBatch}
                  onChange={(e) => setForm({ ...form, ideasPerBatch: num(e.target.value, form.ideasPerBatch) })}
                />
              </div>
              <div>
                <Label htmlFor="intel-score">Min idea score</Label>
                <Input
                  id="intel-score"
                  type="number"
                  min={50}
                  max={100}
                  value={form.minIdeaScore}
                  onChange={(e) => setForm({ ...form, minIdeaScore: num(e.target.value, form.minIdeaScore) })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={saveSettings} disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
