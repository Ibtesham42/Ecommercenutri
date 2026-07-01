"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, RotateCcw, AlertTriangle, Globe, Share2, Search, Link2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ImageUploadField } from "@/components/admin/image-upload-field";
import { cn } from "@/lib/utils";
import { cldUrl } from "@/lib/cld";
import { hostOf } from "@/lib/seo-preview";
import type { SeoFormValues } from "@/lib/validations/seo";
import { updateSeoSettings } from "@/lib/actions/admin/seo";
import { PLATFORMS, PlatformPreview, type PlatformKey, type PreviewData } from "./seo/social-previews";
import { UrlTester } from "./seo/url-tester";

type Fallback = {
  siteName: string;
  title: string;
  description: string;
  shareImage: string;
  favicon: string;
  domain: string;
};

const TABS = [
  { key: "global", label: "Global SEO", icon: Globe },
  { key: "social", label: "Social Share", icon: Share2 },
  { key: "search", label: "Search & Analytics", icon: Search },
  { key: "links", label: "Social Links", icon: Link2 },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export function SeoManager({
  initial,
  defaults,
  fallback,
  siteUrl,
  cloudinaryReady,
}: {
  initial: SeoFormValues;
  defaults: SeoFormValues;
  fallback: Fallback;
  siteUrl: string;
  cloudinaryReady: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState<SeoFormValues>(initial);
  const [saved, setSaved] = useState<SeoFormValues>(initial);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<TabKey>("global");
  const [platform, setPlatform] = useState<PlatformKey>("google");
  const savedJson = useRef(JSON.stringify(initial));

  const dirty = JSON.stringify(form) !== savedJson.current;

  // Warn on navigating away with unsaved changes.
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  function set<K extends keyof SeoFormValues>(key: K, value: SeoFormValues[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    setSaving(true);
    const res = await updateSeoSettings(form);
    setSaving(false);
    if (res.ok) {
      setSaved(form);
      savedJson.current = JSON.stringify(form);
      toast.success("SEO settings saved — metadata refreshed site-wide.");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  function resetToDefaults() {
    setForm(defaults);
    toast.message("Filled with defaults — review, then Save to apply.");
  }

  function discard() {
    setForm(saved);
  }

  // Effective preview data (form value → fallback).
  const eff: PreviewData = useMemo(() => {
    const domain = form.siteUrl ? hostOf(form.siteUrl, fallback.domain) : fallback.domain;
    return {
      title: form.shareTitle || form.metaTitle || fallback.title,
      description: form.shareDescription || form.metaDescription || fallback.description,
      image: form.shareImage || form.ogImage || fallback.shareImage,
      siteName: form.siteName || fallback.siteName,
      domain,
      url: form.siteUrl || siteUrl,
      favicon: form.favicon ? cldUrl(form.favicon, { w: 64, h: 64 }) : fallback.favicon,
      twitterCard: form.twitterCardType,
    };
  }, [form, fallback, siteUrl]);

  // Validation warnings (soft — never block saving).
  const warnings = useMemo(() => {
    const w: string[] = [];
    const titleLen = (form.metaTitle || fallback.title).length;
    const descLen = (form.metaDescription || fallback.description).length;
    if (titleLen > 60) w.push(`Meta title is ${titleLen} chars — Google truncates near 60.`);
    if (descLen > 160) w.push(`Meta description is ${descLen} chars — aim for ~160.`);
    const shareTitleLen = (form.shareTitle || form.metaTitle || fallback.title).length;
    if (shareTitleLen > 88) w.push(`Share title is long (${shareTitleLen}); ~60 shows fully.`);
    if (!form.ogImage && !form.shareImage && !fallback.shareImage)
      w.push("No Open Graph / share image set — links will look plain.");
    if (form.siteUrl && !/^https?:\/\/.+\..+/.test(form.siteUrl))
      w.push("Site URL doesn't look like a valid https:// URL.");
    return w;
  }, [form, fallback]);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
      {/* ---- Editor ---- */}
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap gap-1.5">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                tab === t.key ? "border-primary bg-primary/10 text-primary" : "hover:bg-accent",
              )}
            >
              <t.icon className="size-4" /> {t.label}
            </button>
          ))}
        </div>

        <div className="space-y-4 rounded-xl border p-4">
          {tab === "global" && (
            <>
              <Row>
                <Field label="Website name" hint="Falls back to Nutriyet.">
                  <Input value={form.siteName} onChange={(e) => set("siteName", e.target.value)} placeholder={fallback.siteName} />
                </Field>
                <Field label="Brand name">
                  <Input value={form.brandName} onChange={(e) => set("brandName", e.target.value)} placeholder={fallback.siteName} />
                </Field>
                <Field label="Short name (PWA)">
                  <Input value={form.shortName} onChange={(e) => set("shortName", e.target.value)} placeholder="Nutriyet" />
                </Field>
              </Row>
              <Field label="Meta title" counter={`${form.metaTitle.length}/60`} hint="Blank = “Name — tagline”.">
                <Input value={form.metaTitle} onChange={(e) => set("metaTitle", e.target.value)} placeholder={fallback.title} />
              </Field>
              <Field label="Meta description" counter={`${form.metaDescription.length}/160`}>
                <Textarea rows={2} value={form.metaDescription} onChange={(e) => set("metaDescription", e.target.value)} placeholder={fallback.description} />
              </Field>
              <Field label="Meta keywords" hint="Comma-separated.">
                <Input value={form.keywords} onChange={(e) => set("keywords", e.target.value)} placeholder="makhana, dry fruits, protein…" />
              </Field>
              <Row>
                <Field label="Site URL (canonical base)">
                  <Input value={form.siteUrl} onChange={(e) => set("siteUrl", e.target.value)} placeholder={siteUrl} />
                </Field>
                <Field label="Business category">
                  <Input value={form.businessCategory} onChange={(e) => set("businessCategory", e.target.value)} placeholder="Health & Nutrition" />
                </Field>
              </Row>
              <Row>
                <Field label="Locale">
                  <Input value={form.locale} onChange={(e) => set("locale", e.target.value)} placeholder="en_IN" />
                </Field>
                <Field label="Language">
                  <Input value={form.language} onChange={(e) => set("language", e.target.value)} placeholder="en" />
                </Field>
                <Field label="Theme color">
                  <div className="flex gap-2">
                    <input type="color" value={form.themeColor || "#16803c"} onChange={(e) => set("themeColor", e.target.value)} className="h-9 w-12 rounded-md border bg-transparent" aria-label="Theme color" />
                    <Input value={form.themeColor} onChange={(e) => set("themeColor", e.target.value)} placeholder="#16803c" />
                  </div>
                </Field>
              </Row>
              <Row>
                <Field label="Publisher">
                  <Input value={form.publisher} onChange={(e) => set("publisher", e.target.value)} placeholder={fallback.siteName} />
                </Field>
                <Field label="Author">
                  <Input value={form.author} onChange={(e) => set("author", e.target.value)} placeholder={fallback.siteName} />
                </Field>
              </Row>
              <Row>
                <Field label="Default OG image">
                  <ImageUploadField value={form.ogImage} onChange={(v) => set("ogImage", v)} cloudinaryReady={cloudinaryReady} folder="seo" />
                </Field>
                <Field label="Favicon">
                  <ImageUploadField value={form.favicon} onChange={(v) => set("favicon", v)} cloudinaryReady={cloudinaryReady} folder="branding" accept="image/png,image/svg+xml,image/x-icon,.png,.svg,.ico" />
                </Field>
                <Field label="Apple touch icon">
                  <ImageUploadField value={form.appleTouchIcon} onChange={(v) => set("appleTouchIcon", v)} cloudinaryReady={cloudinaryReady} folder="branding" />
                </Field>
              </Row>
              <label className="flex items-center justify-between rounded-lg border p-3 text-sm">
                <span>
                  Allow search engines to index the site
                  <span className="block text-xs text-muted-foreground">Turn off to add a site-wide noindex.</span>
                </span>
                <Switch checked={form.robotsIndex} onCheckedChange={(v) => set("robotsIndex", v)} />
              </label>
            </>
          )}

          {tab === "social" && (
            <>
              <Field label="Share title" counter={`${form.shareTitle.length}/60`} hint="Shown on WhatsApp/Facebook/etc. Blank = meta title.">
                <Input value={form.shareTitle} onChange={(e) => set("shareTitle", e.target.value)} placeholder={fallback.title} />
              </Field>
              <Field label="Share description" counter={`${form.shareDescription.length}/200`}>
                <Textarea rows={2} value={form.shareDescription} onChange={(e) => set("shareDescription", e.target.value)} placeholder={fallback.description} />
              </Field>
              <Row>
                <Field label="Share image (OG)" hint="1200×630 recommended.">
                  <ImageUploadField value={form.shareImage} onChange={(v) => set("shareImage", v)} cloudinaryReady={cloudinaryReady} folder="seo" />
                </Field>
                <Field label="Twitter/X image" hint="Blank = share image.">
                  <ImageUploadField value={form.twitterImage} onChange={(v) => set("twitterImage", v)} cloudinaryReady={cloudinaryReady} folder="seo" />
                </Field>
              </Row>
              <Row>
                <Field label="Open Graph type">
                  <Select value={form.ogType} onChange={(v) => set("ogType", v)} options={["website", "article", "product", "profile"]} />
                </Field>
                <Field label="Twitter card type">
                  <Select value={form.twitterCardType} onChange={(v) => set("twitterCardType", v as SeoFormValues["twitterCardType"])} options={["summary_large_image", "summary"]} />
                </Field>
                <Field label="Twitter @creator">
                  <Input value={form.twitterCreator} onChange={(e) => set("twitterCreator", e.target.value)} placeholder="@nutriyet" />
                </Field>
              </Row>
            </>
          )}

          {tab === "search" && (
            <>
              <p className="text-xs text-muted-foreground">
                Site-verification codes (rendered as meta tags) and analytics IDs. Each is optional.
              </p>
              <Row>
                <Field label="Google Search Console"><Input value={form.googleVerification} onChange={(e) => set("googleVerification", e.target.value)} placeholder="verification token" /></Field>
                <Field label="Bing Webmaster"><Input value={form.bingVerification} onChange={(e) => set("bingVerification", e.target.value)} /></Field>
              </Row>
              <Row>
                <Field label="Pinterest"><Input value={form.pinterestVerification} onChange={(e) => set("pinterestVerification", e.target.value)} /></Field>
                <Field label="Yandex"><Input value={form.yandexVerification} onChange={(e) => set("yandexVerification", e.target.value)} /></Field>
              </Row>
              <Row>
                <Field label="Facebook App ID"><Input value={form.facebookAppId} onChange={(e) => set("facebookAppId", e.target.value)} /></Field>
              </Row>
              <div className="border-t pt-3" />
              <Row>
                <Field label="Google Analytics (G-…)"><Input value={form.gaId} onChange={(e) => set("gaId", e.target.value)} placeholder="G-XXXXXXX" /></Field>
                <Field label="Google Tag Manager"><Input value={form.gtmId} onChange={(e) => set("gtmId", e.target.value)} placeholder="GTM-XXXXXX" /></Field>
                <Field label="Meta Pixel ID"><Input value={form.metaPixelId} onChange={(e) => set("metaPixelId", e.target.value)} placeholder="1234567890" /></Field>
              </Row>
            </>
          )}

          {tab === "links" && (
            <Row>
              <Field label="Instagram"><Input value={form.instagram} onChange={(e) => set("instagram", e.target.value)} placeholder="https://instagram.com/…" /></Field>
              <Field label="Facebook"><Input value={form.facebook} onChange={(e) => set("facebook", e.target.value)} /></Field>
              <Field label="YouTube"><Input value={form.youtube} onChange={(e) => set("youtube", e.target.value)} /></Field>
              <Field label="X (Twitter)"><Input value={form.twitter} onChange={(e) => set("twitter", e.target.value)} /></Field>
              <Field label="LinkedIn"><Input value={form.linkedin} onChange={(e) => set("linkedin", e.target.value)} /></Field>
              <Field label="Pinterest"><Input value={form.pinterest} onChange={(e) => set("pinterest", e.target.value)} /></Field>
              <Field label="WhatsApp"><Input value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} placeholder="+91…" /></Field>
              <Field label="Telegram"><Input value={form.telegram} onChange={(e) => set("telegram", e.target.value)} /></Field>
            </Row>
          )}
        </div>

        <UrlTester siteUrl={siteUrl} />
      </div>

      {/* ---- Live preview (sticky on desktop) ---- */}
      <div className="space-y-3 lg:sticky lg:top-20 lg:self-start">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Live preview</h3>
          <span className="text-xs text-muted-foreground">updates as you type</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PLATFORMS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPlatform(p.key)}
              title={p.label}
              className={cn(
                "rounded-full border px-2 py-1 text-xs transition-colors",
                platform === p.key ? "border-primary bg-primary/10 text-primary" : "hover:bg-accent",
              )}
            >
              {p.emoji}
            </button>
          ))}
        </div>
        <div className="grid place-items-center rounded-xl border bg-muted/30 p-4">
          <PlatformPreview platform={platform} data={eff} />
        </div>
        {warnings.length > 0 && (
          <div className="space-y-1.5 rounded-lg border border-amber-300/50 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-300">
            {warnings.map((w) => (
              <p key={w} className="flex items-start gap-1.5">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> {w}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* ---- Sticky save bar ---- */}
      <div className="sticky bottom-0 z-10 -mx-1 flex items-center justify-between gap-3 rounded-t-xl border bg-background/95 p-3 shadow-elev-2 backdrop-blur lg:col-span-2">
        <div className="flex items-center gap-2 text-sm">
          {dirty ? (
            <Badge variant="secondary" className="gap-1.5">
              <span className="size-2 rounded-full bg-amber-500" /> Unsaved changes
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1.5">
              <span className="size-2 rounded-full bg-emerald-500" /> All changes saved
            </Badge>
          )}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={resetToDefaults} className="gap-1.5">
            <RotateCcw className="size-4" /> Reset to defaults
          </Button>
          {dirty && (
            <Button type="button" variant="outline" onClick={discard}>
              Discard
            </Button>
          )}
          <Button type="button" onClick={save} disabled={saving || !dirty} className="gap-2">
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Save changes
          </Button>
        </div>
      </div>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2">{children}</div>;
}

function Field({
  label,
  hint,
  counter,
  children,
}: {
  label: string;
  hint?: string;
  counter?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        {counter && <span className="text-[11px] text-muted-foreground">{counter}</span>}
      </div>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}
