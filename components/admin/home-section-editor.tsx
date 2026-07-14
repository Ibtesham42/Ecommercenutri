"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { HomeHero } from "@/components/storefront/home/home-hero";
import { HomeAiBanner } from "@/components/storefront/home/home-ai-banner";
import { HomeWhyChooseUs } from "@/components/storefront/home/home-why-choose-us";
import { HomeTestimonials } from "@/components/storefront/home/home-testimonials";
import { VALUE_PROP_ICON_NAMES } from "@/lib/home-content";
import {
  saveHomeSectionContent,
  resetHomeSectionContent,
} from "@/lib/actions/admin/home-sections";
import type {
  HeroContent,
  AiBannerContent,
  HeadingContent,
  WhyChooseUsContent,
  TestimonialsContent,
  HomeContentKey,
} from "@/lib/validations/admin";

export type EditTarget =
  | { kind: "hero"; key: "hero"; label: string; value: HeroContent }
  | { kind: "aiBanner"; key: "aiBanner"; label: string; value: AiBannerContent }
  | { kind: "heading"; key: HomeContentKey; label: string; value: HeadingContent }
  | { kind: "whyChooseUs"; key: "whyChooseUs"; label: string; value: WhyChooseUsContent }
  | { kind: "testimonials"; key: "testimonials"; label: string; value: TestimonialsContent };

export function HomeSectionEditDialog({
  target,
  onClose,
}: {
  target: EditTarget | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={target != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        {target && (
          <>
            <DialogHeader>
              <DialogTitle>Edit · {target.label}</DialogTitle>
              <DialogDescription>
                Changes apply to the live homepage after saving. Reset restores the default content.
              </DialogDescription>
            </DialogHeader>
            <EditorBody target={target} onClose={onClose} />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditorBody({ target, onClose }: { target: EditTarget; onClose: () => void }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  async function save(draft: unknown) {
    setSaving(true);
    const res = await saveHomeSectionContent(target.key, draft);
    setSaving(false);
    if (res.ok) {
      toast.success("Section updated");
      onClose();
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  async function reset() {
    if (!confirm("Reset this section to its default content?")) return;
    setResetting(true);
    const res = await resetHomeSectionContent(target.key);
    setResetting(false);
    if (res.ok) {
      toast.success("Reset to default");
      onClose();
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  const footer = (
    <div className="flex items-center justify-between gap-2 pt-2">
      <Button type="button" variant="ghost" className="gap-1.5 text-muted-foreground" onClick={reset} disabled={resetting}>
        {resetting ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
        Reset to default
      </Button>
      <div className="flex gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  );

  switch (target.kind) {
    case "hero":
      return <HeroForm initial={target.value} onSave={save} saving={saving} footer={footer} />;
    case "aiBanner":
      return <AiBannerForm initial={target.value} onSave={save} saving={saving} footer={footer} />;
    case "heading":
      return <HeadingForm initial={target.value} onSave={save} saving={saving} footer={footer} />;
    case "whyChooseUs":
      return <WhyChooseUsForm initial={target.value} onSave={save} saving={saving} footer={footer} />;
    case "testimonials":
      return <TestimonialsForm initial={target.value} onSave={save} saving={saving} footer={footer} />;
  }
}

// --- shared field helpers ---------------------------------------------------

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null | undefined;
  onChange: (v: string) => void;
}) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value || "#00835b"}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 shrink-0 rounded border"
          aria-label={`${label} color picker`}
        />
        <Input value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder="auto (theme default)" />
        {value ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}>
            Clear
          </Button>
        ) : null}
      </div>
    </Field>
  );
}

function PreviewBox({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Live preview</p>
      <div className="overflow-hidden rounded-xl border bg-background">{children}</div>
    </div>
  );
}

function SaveBar({ saving, onSave, footer }: { saving: boolean; onSave: () => void; footer: React.ReactNode }) {
  return (
    <>
      <div className="flex justify-end">
        <Button type="button" onClick={onSave} disabled={saving} className="gap-2">
          {saving && <Loader2 className="size-4 animate-spin" />}
          Save changes
        </Button>
      </div>
      {footer}
    </>
  );
}

// --- per-kind forms ---------------------------------------------------------

function HeroForm({
  initial,
  onSave,
  saving,
  footer,
}: {
  initial: HeroContent;
  onSave: (d: HeroContent) => void;
  saving: boolean;
  footer: React.ReactNode;
}) {
  const [d, setD] = useState<HeroContent>(initial);
  const set = (patch: Partial<HeroContent>) => setD((p) => ({ ...p, ...patch }));
  const setStat = (i: number, patch: Partial<HeroContent["stats"][number]>) =>
    setD((p) => ({ ...p, stats: p.stats.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));

  return (
    <div className="space-y-4">
      <PreviewBox>
        <HomeHero content={d} />
      </PreviewBox>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Eyebrow / badge"><Input value={d.eyebrow} onChange={(e) => set({ eyebrow: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Title"><Input value={d.title} onChange={(e) => set({ title: e.target.value })} /></Field>
          <Field label="Highlight"><Input value={d.highlight} onChange={(e) => set({ highlight: e.target.value })} /></Field>
        </div>
      </div>
      <Field label="Description"><Textarea rows={2} value={d.description} onChange={(e) => set({ description: e.target.value })} /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Primary button label"><Input value={d.primaryLabel} onChange={(e) => set({ primaryLabel: e.target.value })} /></Field>
        <Field label="Primary button link"><Input value={d.primaryHref} onChange={(e) => set({ primaryHref: e.target.value })} /></Field>
        <Field label="Secondary button label"><Input value={d.secondaryLabel} onChange={(e) => set({ secondaryLabel: e.target.value })} /></Field>
        <Field label="Secondary button link"><Input value={d.secondaryHref} onChange={(e) => set({ secondaryHref: e.target.value })} /></Field>
      </div>
      <div>
        <Label>Stats</Label>
        <div className="mt-1.5 space-y-2">
          {d.stats.map((s, i) => (
            <div key={i} className="flex gap-2">
              <Input value={s.value} placeholder="10k+" onChange={(e) => setStat(i, { value: e.target.value })} />
              <Input value={s.label} placeholder="Happy customers" onChange={(e) => setStat(i, { label: e.target.value })} />
              <Button type="button" variant="ghost" size="icon" onClick={() => setD((p) => ({ ...p, stats: p.stats.filter((_, j) => j !== i) }))} aria-label="Remove stat">
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          {d.stats.length < 4 && (
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setD((p) => ({ ...p, stats: [...p.stats, { value: "", label: "" }] }))}>
              <Plus className="size-4" /> Add stat
            </Button>
          )}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <ColorInput label="Background color" value={d.bgColor} onChange={(v) => set({ bgColor: v })} />
        <ColorInput label="Text color" value={d.textColor} onChange={(v) => set({ textColor: v })} />
      </div>

      <SaveBar saving={saving} onSave={() => onSave(d)} footer={footer} />
    </div>
  );
}

function AiBannerForm({
  initial,
  onSave,
  saving,
  footer,
}: {
  initial: AiBannerContent;
  onSave: (d: AiBannerContent) => void;
  saving: boolean;
  footer: React.ReactNode;
}) {
  const [d, setD] = useState<AiBannerContent>(initial);
  const set = (patch: Partial<AiBannerContent>) => setD((p) => ({ ...p, ...patch }));
  return (
    <div className="space-y-4">
      <PreviewBox>
        <HomeAiBanner content={d} />
      </PreviewBox>
      <Field label="Eyebrow / badge"><Input value={d.eyebrow} onChange={(e) => set({ eyebrow: e.target.value })} /></Field>
      <Field label="Title"><Input value={d.title} onChange={(e) => set({ title: e.target.value })} /></Field>
      <Field label="Description"><Textarea rows={2} value={d.description} onChange={(e) => set({ description: e.target.value })} /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Button label"><Input value={d.ctaLabel} onChange={(e) => set({ ctaLabel: e.target.value })} /></Field>
        <Field label="Button link"><Input value={d.ctaHref} onChange={(e) => set({ ctaHref: e.target.value })} /></Field>
        <ColorInput label="Background color" value={d.bgColor} onChange={(v) => set({ bgColor: v })} />
        <ColorInput label="Text color" value={d.textColor} onChange={(v) => set({ textColor: v })} />
      </div>
      <SaveBar saving={saving} onSave={() => onSave(d)} footer={footer} />
    </div>
  );
}

function HeadingForm({
  initial,
  onSave,
  saving,
  footer,
}: {
  initial: HeadingContent;
  onSave: (d: HeadingContent) => void;
  saving: boolean;
  footer: React.ReactNode;
}) {
  const [d, setD] = useState<HeadingContent>(initial);
  const set = (patch: Partial<HeadingContent>) => setD((p) => ({ ...p, ...patch }));
  return (
    <div className="space-y-4">
      <PreviewBox>
        <div className="p-6">
          <h2 className="text-2xl font-bold sm:text-3xl">{d.title || "Section title"}</h2>
          {d.subtitle && <p className="text-muted-foreground">{d.subtitle}</p>}
          <p className="mt-3 text-xs text-muted-foreground">Products/items load from the catalog on the live site.</p>
        </div>
      </PreviewBox>
      <Field label="Title"><Input value={d.title} onChange={(e) => set({ title: e.target.value })} /></Field>
      <Field label="Subtitle"><Input value={d.subtitle} onChange={(e) => set({ subtitle: e.target.value })} /></Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Link label"><Input value={d.ctaLabel ?? ""} onChange={(e) => set({ ctaLabel: e.target.value })} /></Field>
        <Field label="Link URL"><Input value={d.ctaHref ?? ""} onChange={(e) => set({ ctaHref: e.target.value })} /></Field>
        <Field label="Items shown">
          <Input
            type="number"
            min={1}
            max={24}
            value={d.limit ?? 8}
            onChange={(e) => set({ limit: Number(e.target.value) || 1 })}
          />
        </Field>
      </div>
      <SaveBar saving={saving} onSave={() => onSave(d)} footer={footer} />
    </div>
  );
}

function WhyChooseUsForm({
  initial,
  onSave,
  saving,
  footer,
}: {
  initial: WhyChooseUsContent;
  onSave: (d: WhyChooseUsContent) => void;
  saving: boolean;
  footer: React.ReactNode;
}) {
  const [d, setD] = useState<WhyChooseUsContent>(initial);
  const set = (patch: Partial<WhyChooseUsContent>) => setD((p) => ({ ...p, ...patch }));
  const setItem = (i: number, patch: Partial<WhyChooseUsContent["items"][number]>) =>
    setD((p) => ({ ...p, items: p.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) }));

  return (
    <div className="space-y-4">
      <PreviewBox>
        <HomeWhyChooseUs content={d} />
      </PreviewBox>
      <Field label="Title"><Input value={d.title} onChange={(e) => set({ title: e.target.value })} /></Field>
      <Field label="Subtitle"><Input value={d.subtitle} onChange={(e) => set({ subtitle: e.target.value })} /></Field>
      <div className="space-y-3">
        <Label>Items</Label>
        {d.items.map((it, i) => (
          <div key={i} className="space-y-2 rounded-lg border p-3">
            <div className="flex gap-2">
              <select
                value={it.icon}
                onChange={(e) => setItem(i, { icon: e.target.value })}
                className="h-9 rounded-md border bg-transparent px-2 text-sm"
                aria-label="Icon"
              >
                {VALUE_PROP_ICON_NAMES.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              <Input value={it.title} placeholder="Title" onChange={(e) => setItem(i, { title: e.target.value })} />
              <Button type="button" variant="ghost" size="icon" onClick={() => setD((p) => ({ ...p, items: p.items.filter((_, j) => j !== i) }))} aria-label="Remove item">
                <Trash2 className="size-4" />
              </Button>
            </div>
            <Input value={it.desc} placeholder="Description" onChange={(e) => setItem(i, { desc: e.target.value })} />
          </div>
        ))}
        {d.items.length < 8 && (
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setD((p) => ({ ...p, items: [...p.items, { icon: "Leaf", title: "", desc: "" }] }))}>
            <Plus className="size-4" /> Add item
          </Button>
        )}
      </div>
      <SaveBar saving={saving} onSave={() => onSave(d)} footer={footer} />
    </div>
  );
}

function TestimonialsForm({
  initial,
  onSave,
  saving,
  footer,
}: {
  initial: TestimonialsContent;
  onSave: (d: TestimonialsContent) => void;
  saving: boolean;
  footer: React.ReactNode;
}) {
  const [d, setD] = useState<TestimonialsContent>(initial);
  const set = (patch: Partial<TestimonialsContent>) => setD((p) => ({ ...p, ...patch }));
  const setItem = (i: number, patch: Partial<TestimonialsContent["items"][number]>) =>
    setD((p) => ({ ...p, items: p.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) }));

  return (
    <div className="space-y-4">
      <PreviewBox>
        <HomeTestimonials content={d} />
      </PreviewBox>
      <Field label="Title"><Input value={d.title} onChange={(e) => set({ title: e.target.value })} /></Field>
      <Field label="Subtitle"><Input value={d.subtitle} onChange={(e) => set({ subtitle: e.target.value })} /></Field>
      <div className="space-y-3">
        <Label>Testimonials</Label>
        {d.items.map((it, i) => (
          <div key={i} className="space-y-2 rounded-lg border p-3">
            <div className="flex gap-2">
              <Input value={it.name} placeholder="Name" onChange={(e) => setItem(i, { name: e.target.value })} />
              <select
                value={it.rating}
                onChange={(e) => setItem(i, { rating: Number(e.target.value) })}
                className="h-9 rounded-md border bg-transparent px-2 text-sm"
                aria-label="Rating"
              >
                {[5, 4, 3, 2, 1].map((r) => (
                  <option key={r} value={r}>{r}★</option>
                ))}
              </select>
              <Button type="button" variant="ghost" size="icon" onClick={() => setD((p) => ({ ...p, items: p.items.filter((_, j) => j !== i) }))} aria-label="Remove testimonial">
                <Trash2 className="size-4" />
              </Button>
            </div>
            <Textarea rows={2} value={it.text} placeholder="Quote" onChange={(e) => setItem(i, { text: e.target.value })} />
          </div>
        ))}
        {d.items.length < 12 && (
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setD((p) => ({ ...p, items: [...p.items, { name: "", text: "", rating: 5 }] }))}>
            <Plus className="size-4" /> Add testimonial
          </Button>
        )}
      </div>
      <SaveBar saving={saving} onSave={() => onSave(d)} footer={footer} />
    </div>
  );
}
