"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  Sparkles,
  RefreshCw,
  AtSign,
  Globe,
  ListPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  saveCompetitor,
  deleteCompetitor,
  toggleCompetitor,
  analyzeCompetitorNow,
  addCompetitorSignal,
  deleteCompetitorSignal,
  seedDefaultCompetitorsAction,
} from "@/lib/actions/admin/intelligence";
import {
  COMPETITOR_PRIORITY_VALUES,
  INTEL_SOURCE_VALUES,
  INTEL_SIGNAL_KIND_VALUES,
} from "@/lib/validations/intelligence";
import {
  COMPETITOR_CATEGORIES,
  PRIORITY_LABEL,
  INTEL_SOURCE_LABEL,
  SIGNAL_KIND_LABEL,
} from "@/lib/intelligence/catalog";
import type { CompetitorDetail } from "@/lib/queries/intelligence";

type CompetitorForm = {
  id?: string;
  name: string;
  category: string;
  priority: (typeof COMPETITOR_PRIORITY_VALUES)[number];
  active: boolean;
  instagram: string;
  facebook: string;
  linkedin: string;
  website: string;
  blogUrl: string;
  notes: string;
};

type SignalForm = {
  competitorId: string;
  competitorName: string;
  source: (typeof INTEL_SOURCE_VALUES)[number];
  kind: (typeof INTEL_SIGNAL_KIND_VALUES)[number];
  title: string;
  summary: string;
  url: string;
  postedAt: string;
  likes: string;
  comments: string;
  hashtags: string;
  topics: string;
};

const emptyCompetitor: CompetitorForm = {
  name: "",
  category: COMPETITOR_CATEGORIES[0],
  priority: "MEDIUM",
  active: true,
  instagram: "",
  facebook: "",
  linkedin: "",
  website: "",
  blogUrl: "",
  notes: "",
};

const PRIORITY_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  HIGH: "default",
  MEDIUM: "secondary",
  LOW: "outline",
};

export function CompetitorManager({ competitors }: { competitors: CompetitorDetail[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [form, setForm] = useState<CompetitorForm | null>(null);
  const [signal, setSignal] = useState<SignalForm | null>(null);

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, success: string) =>
    start(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(success);
        router.refresh();
      } else {
        toast.error(res.error ?? "Something went wrong.");
      }
    });

  const save = () => {
    if (!form) return;
    start(async () => {
      const res = await saveCompetitor(form);
      if (res.ok) {
        toast.success("Competitor saved.");
        setForm(null);
        router.refresh();
      } else {
        toast.error(res.error ?? "Couldn't save.");
      }
    });
  };

  const saveSignal = () => {
    if (!signal) return;
    start(async () => {
      const res = await addCompetitorSignal({
        ...signal,
        likes: signal.likes || null,
        comments: signal.comments || null,
        hashtags: signal.hashtags.split(/[,\s]+/).filter(Boolean),
        topics: signal.topics.split(",").map((t) => t.trim()).filter(Boolean),
      });
      if (res.ok) {
        toast.success("Signal recorded.");
        setSignal(null);
        router.refresh();
      } else {
        toast.error(res.error ?? "Couldn't record.");
      }
    });
  };

  const newSignal = (c: CompetitorDetail): SignalForm => ({
    competitorId: c.id,
    competitorName: c.name,
    source: "INSTAGRAM",
    kind: "POST",
    title: "",
    summary: "",
    url: "",
    postedAt: "",
    likes: "",
    comments: "",
    hashtags: "",
    topics: "",
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => act(() => seedDefaultCompetitorsAction(), "Default watchlist ensured.")}
        >
          <Sparkles className="mr-2 size-4" /> Add default watchlist
        </Button>
        <Button size="sm" onClick={() => setForm(emptyCompetitor)}>
          <Plus className="mr-2 size-4" /> New competitor
        </Button>
      </div>

      {competitors.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <p className="font-medium">No competitors tracked yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add the default Indian healthy-snacking watchlist, or track your own.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {competitors.map((c) => (
            <div key={c.id} className="rounded-xl border bg-card p-4 shadow-elev-1">
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{c.name}</span>
                    <Badge variant="secondary">{c.category}</Badge>
                    <Badge variant={PRIORITY_VARIANT[c.priority]}>{PRIORITY_LABEL[c.priority]} priority</Badge>
                    {!c.active && <Badge variant="outline">Paused</Badge>}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    {c.instagram && (
                      <span className="inline-flex items-center gap-1">
                        <AtSign className="size-3" /> {c.instagram}
                      </span>
                    )}
                    {c.website && (
                      <a
                        href={c.website}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 hover:text-foreground"
                      >
                        <Globe className="size-3" /> {c.website.replace(/^https?:\/\//, "")}
                      </a>
                    )}
                    <span>{c.signals.length ? `${c.signals.length}+ signals` : "no signals yet"}</span>
                    <span>
                      {c.lastAnalyzedAt
                        ? `analyzed ${new Date(c.lastAnalyzedAt).toLocaleDateString("en-IN")}`
                        : "never analyzed"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Switch
                    checked={c.active}
                    aria-label={c.active ? "Pause monitoring" : "Resume monitoring"}
                    disabled={pending}
                    onCheckedChange={(v) =>
                      act(() => toggleCompetitor(c.id, v), v ? "Monitoring resumed." : "Monitoring paused.")
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Record a signal"
                    title="Record a public observation"
                    onClick={() => setSignal(newSignal(c))}
                  >
                    <ListPlus className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Analyze now"
                    title="Re-analyze this competitor"
                    disabled={pending}
                    onClick={() => act(() => analyzeCompetitorNow(c.id), `${c.name} re-analyzed.`)}
                  >
                    <RefreshCw className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Edit"
                    onClick={() =>
                      setForm({
                        id: c.id,
                        name: c.name,
                        category: c.category,
                        priority: c.priority,
                        active: c.active,
                        instagram: c.instagram ?? "",
                        facebook: c.facebook ?? "",
                        linkedin: c.linkedin ?? "",
                        website: c.website ?? "",
                        blogUrl: c.blogUrl ?? "",
                        notes: c.notes ?? "",
                      })
                    }
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Delete"
                    disabled={pending}
                    onClick={() => act(() => deleteCompetitor(c.id), "Competitor removed.")}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>

              {c.profileSummary && (
                <p className="mt-3 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
                  {c.profileSummary}
                </p>
              )}

              {(c.signals.length > 0 || c.profile) && (
                <details className="mt-2 text-sm">
                  <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
                    Recent signals & style profile
                  </summary>
                  <div className="mt-2 space-y-3">
                    {c.profile && (
                      <div className="grid gap-2 sm:grid-cols-2">
                        <ProfileField label="Posting" value={c.profile.postingFrequency} />
                        <ProfileField label="Tone" value={c.profile.brandTone} />
                        <ProfileField label="Hooks" value={c.profile.hookStyle} />
                        <ProfileField label="CTAs" value={c.profile.ctaStyle} />
                        {c.profile.takeaways.length > 0 && (
                          <div className="sm:col-span-2">
                            <p className="text-xs font-medium text-muted-foreground">What we can learn</p>
                            <ul className="mt-1 list-inside list-disc text-sm">
                              {c.profile.takeaways.map((t, i) => (
                                <li key={i}>{t}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                    {c.signals.length > 0 && (
                      <ul className="divide-y rounded-lg border">
                        {c.signals.map((s) => (
                          <li key={s.id} className="flex items-center gap-2 px-3 py-2">
                            <Badge variant="outline" className="shrink-0 text-[10px]">
                              {INTEL_SOURCE_LABEL[s.source]} · {SIGNAL_KIND_LABEL[s.kind]}
                            </Badge>
                            <span className="min-w-0 flex-1 truncate">{s.title}</span>
                            {(s.likes != null || s.comments != null) && (
                              <span className="shrink-0 text-xs text-muted-foreground">
                                {(s.likes ?? 0) + (s.comments ?? 0)} eng.
                              </span>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              aria-label="Delete signal"
                              disabled={pending}
                              onClick={() => act(() => deleteCompetitorSignal(s.id), "Signal deleted.")}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </details>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Competitor add/edit */}
      <Dialog open={Boolean(form)} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{form?.id ? "Edit competitor" : "Track a competitor"}</DialogTitle>
            <DialogDescription>Only public brand information is stored.</DialogDescription>
          </DialogHeader>
          {form && (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="c-name">Brand name</Label>
                  <Input id="c-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div>
                  <Label>Category</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COMPETITOR_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Priority</Label>
                  <Select
                    value={form.priority}
                    onValueChange={(v) => setForm({ ...form, priority: v as CompetitorForm["priority"] })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COMPETITOR_PRIORITY_VALUES.map((p) => (
                        <SelectItem key={p} value={p}>
                          {PRIORITY_LABEL[p]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end justify-between rounded-lg border px-3 py-2">
                  <Label htmlFor="c-active" className="text-sm">
                    Monitoring
                  </Label>
                  <Switch
                    id="c-active"
                    checked={form.active}
                    onCheckedChange={(v) => setForm({ ...form, active: v })}
                  />
                </div>
                <div>
                  <Label htmlFor="c-ig">Instagram handle</Label>
                  <Input
                    id="c-ig"
                    placeholder="brandname"
                    value={form.instagram}
                    onChange={(e) => setForm({ ...form, instagram: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="c-web">Website</Label>
                  <Input
                    id="c-web"
                    placeholder="https://…"
                    value={form.website}
                    onChange={(e) => setForm({ ...form, website: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="c-fb">Facebook</Label>
                  <Input id="c-fb" value={form.facebook} onChange={(e) => setForm({ ...form, facebook: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="c-li">LinkedIn</Label>
                  <Input id="c-li" value={form.linkedin} onChange={(e) => setForm({ ...form, linkedin: e.target.value })} />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="c-blog">Blog URL</Label>
                  <Input
                    id="c-blog"
                    placeholder="https://…"
                    value={form.blogUrl}
                    onChange={(e) => setForm({ ...form, blogUrl: e.target.value })}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="c-notes">Notes</Label>
                  <Textarea
                    id="c-notes"
                    rows={3}
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={save} disabled={pending || !form?.name.trim()}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Signal recorder */}
      <Dialog open={Boolean(signal)} onOpenChange={(o) => !o && setSignal(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Record a public observation</DialogTitle>
            <DialogDescription>
              {signal?.competitorName} — describe what you saw in your own words. Never paste
              competitor captions; note the pattern, not the wording.
            </DialogDescription>
          </DialogHeader>
          {signal && (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Platform</Label>
                  <Select
                    value={signal.source}
                    onValueChange={(v) => setSignal({ ...signal, source: v as SignalForm["source"] })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INTEL_SOURCE_VALUES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {INTEL_SOURCE_LABEL[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Format</Label>
                  <Select
                    value={signal.kind}
                    onValueChange={(v) => setSignal({ ...signal, kind: v as SignalForm["kind"] })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INTEL_SIGNAL_KIND_VALUES.map((k) => (
                        <SelectItem key={k} value={k}>
                          {SIGNAL_KIND_LABEL[k]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="s-title">What did you observe?</Label>
                  <Input
                    id="s-title"
                    placeholder="e.g. Reel comparing protein sources, myth-busting style"
                    value={signal.title}
                    onChange={(e) => setSignal({ ...signal, title: e.target.value })}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="s-summary">Notes (your own words)</Label>
                  <Textarea
                    id="s-summary"
                    rows={3}
                    value={signal.summary}
                    onChange={(e) => setSignal({ ...signal, summary: e.target.value })}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="s-url">Public link (optional)</Label>
                  <Input
                    id="s-url"
                    placeholder="https://instagram.com/p/…"
                    value={signal.url}
                    onChange={(e) => setSignal({ ...signal, url: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="s-date">Posted on</Label>
                  <Input
                    id="s-date"
                    type="date"
                    value={signal.postedAt}
                    onChange={(e) => setSignal({ ...signal, postedAt: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="s-likes">Likes</Label>
                    <Input
                      id="s-likes"
                      type="number"
                      min={0}
                      value={signal.likes}
                      onChange={(e) => setSignal({ ...signal, likes: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="s-comments">Comments</Label>
                    <Input
                      id="s-comments"
                      type="number"
                      min={0}
                      value={signal.comments}
                      onChange={(e) => setSignal({ ...signal, comments: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="s-tags">Hashtags (space/comma separated)</Label>
                  <Input
                    id="s-tags"
                    placeholder="#protein #cleanlabel"
                    value={signal.hashtags}
                    onChange={(e) => setSignal({ ...signal, hashtags: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="s-topics">Topics (comma separated)</Label>
                  <Input
                    id="s-topics"
                    placeholder="protein, myth busting"
                    value={signal.topics}
                    onChange={(e) => setSignal({ ...signal, topics: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSignal(null)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={saveSignal} disabled={pending || !signal?.title.trim()}>
              {pending ? "Saving…" : "Record signal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProfileField({ label, value }: { label: string; value: string }) {
  if (!value || value === "—") return null;
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}
