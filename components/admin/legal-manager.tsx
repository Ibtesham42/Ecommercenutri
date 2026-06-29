"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, ExternalLink, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { saveContentPage, resetContentPage } from "@/lib/actions/admin/content";
import { formatDate } from "@/lib/format";

export type LegalPageRow = {
  slug: string;
  title: string;
  body: string;
  isCustom: boolean;
  updatedAt: string | null;
};

function PageEditor({ page }: { page: LegalPageRow }) {
  const router = useRouter();
  const [title, setTitle] = useState(page.title);
  const [body, setBody] = useState(page.body);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  async function onSave() {
    if (!title.trim() || !body.trim()) {
      toast.error("Title and content are required.");
      return;
    }
    setSaving(true);
    const res = await saveContentPage({ slug: page.slug, title, body });
    setSaving(false);
    if (res.ok) {
      toast.success("Saved — your custom content is now live.");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  async function onReset() {
    if (!confirm("Reset this page to the built-in default? Your custom content will be removed.")) return;
    setResetting(true);
    const res = await resetContentPage(page.slug);
    setResetting(false);
    if (res.ok) {
      toast.success("Reset to default.");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <section className="space-y-3 rounded-2xl border p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold">{page.title}</h2>
          <Badge variant={page.isCustom ? "default" : "secondary"}>
            {page.isCustom ? "Custom" : "Default"}
          </Badge>
          <Button asChild variant="ghost" size="sm" className="gap-1 text-muted-foreground">
            <Link href={`/${page.slug}`} target="_blank">
              <ExternalLink className="size-3.5" /> /{page.slug}
            </Link>
          </Button>
        </div>
        {page.isCustom && page.updatedAt && (
          <span className="text-xs text-muted-foreground">Updated {formatDate(page.updatedAt)}</span>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`title-${page.slug}`}>Title</Label>
        <Input id={`title-${page.slug}`} value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`body-${page.slug}`}>Content (HTML)</Label>
        <Textarea
          id={`body-${page.slug}`}
          rows={10}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="font-mono text-xs"
        />
        <p className="text-xs text-muted-foreground">
          HTML is sanitized on save. {page.isCustom ? "" : "This is pre-filled from the built-in default — edit and save to override."}
        </p>
      </div>

      <div className="flex flex-wrap justify-end gap-2 pt-1">
        {page.isCustom && (
          <Button variant="outline" className="gap-1.5" disabled={resetting} onClick={onReset}>
            {resetting ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
            Reset to default
          </Button>
        )}
        <Button className="gap-1.5" disabled={saving} onClick={onSave}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Save
        </Button>
      </div>
    </section>
  );
}

export function LegalManager({ pages }: { pages: LegalPageRow[] }) {
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Override the built-in Shipping, Privacy and Terms pages with your own content. Each renders
        the default until you save a custom version; reset any time.
      </p>
      {pages.map((p) => (
        <PageEditor key={p.slug} page={p} />
      ))}
    </div>
  );
}
