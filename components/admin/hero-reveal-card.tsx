"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Play, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ImageUploadField } from "@/components/admin/image-upload-field";
import { HeroRevealOverlay } from "@/components/storefront/hero-reveal/hero-reveal-overlay";
import { updateHeroReveal } from "@/lib/actions/admin/hero";
import type { HeroRevealSettings } from "@/lib/hero-reveal";
import { DEFAULT_PIECE_SPRITE } from "@/lib/hero-reveal-config";

/**
 * Admin → Hero Slider → "Product Reveal Animation" — settings card for the
 * optional packet-pour overlay on the storefront hero slider. The preview
 * dialog renders the REAL storefront component so what the admin sees is
 * exactly what ships.
 */
export function HeroRevealCard({
  initial,
  cloudinaryReady,
}: {
  initial: HeroRevealSettings;
  cloudinaryReady: boolean;
}) {
  const [values, setValues] = useState<HeroRevealSettings>(initial);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function set<K extends keyof HeroRevealSettings>(key: K, value: HeroRevealSettings[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function save() {
    startTransition(async () => {
      const res = await updateHeroReveal(values);
      if (res.ok) toast.success("Product Reveal settings saved.");
      else toast.error(res.error);
    });
  }

  return (
    <div className="rounded-2xl border bg-card p-4 shadow-elev-1 sm:p-5">
      <div className="mb-1 flex items-center justify-between gap-4">
        <h2 className="flex items-center gap-2 font-heading text-lg font-semibold">
          <Sparkles className="size-4 text-primary" /> Product Reveal Animation
        </h2>
        <Switch
          id="revealEnabled"
          checked={values.enabled}
          onCheckedChange={(c) => set("enabled", c)}
          aria-label="Enable Product Reveal Animation"
        />
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        A premium packet-pour animation overlaid on the hero slider: the packet rips open, tilts,
        and makhana pieces fall, bounce and roll to rest. Decorative only — it never blocks slide
        text, buttons or swipe, and reduced-motion visitors see a still packet.
      </p>

      {values.enabled && !values.packetImage && (
        <p className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-700 dark:text-amber-400">
          Upload a packet image below — the animation stays hidden on the storefront until one is
          set.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Packet image</Label>
          <ImageUploadField
            value={values.packetImage}
            onChange={(url) => set("packetImage", url)}
            cloudinaryReady={cloudinaryReady}
            folder="hero-reveal"
            placeholder="https://… (PNG with a transparent background works best)"
          />
          <p className="text-xs text-muted-foreground">
            The product packet that appears and rips open. Transparent PNG recommended.
          </p>
        </div>
        <div className="space-y-2">
          <Label>Piece image (optional)</Label>
          <ImageUploadField
            value={values.pieceImage}
            onChange={(url) => set("pieceImage", url)}
            cloudinaryReady={cloudinaryReady}
            folder="hero-reveal"
            placeholder="https://… (a single makhana piece)"
          />
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            {!values.pieceImage && (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element -- tiny inline sprite preview */}
                <img src={DEFAULT_PIECE_SPRITE} alt="" className="size-5" />
                Leave empty to use the built-in makhana sprite.
              </>
            )}
            {values.pieceImage && <>The falling pieces use this image.</>}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="revealSpeed">Speed: {values.speed}</Label>
          <input
            id="revealSpeed"
            type="range"
            min={0}
            max={100}
            step={1}
            value={values.speed}
            onChange={(e) => set("speed", Number(e.target.value))}
            className="h-9 w-full accent-primary"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="revealDelay">Delay between loops: {values.delaySec}s</Label>
          <input
            id="revealDelay"
            type="range"
            min={0}
            max={15}
            step={0.5}
            value={values.delaySec}
            onChange={(e) => set("delaySec", Number(e.target.value))}
            className="h-9 w-full accent-primary"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="revealPieces">Falling pieces: {values.pieceCount}</Label>
          <input
            id="revealPieces"
            type="range"
            min={4}
            max={16}
            step={1}
            value={values.pieceCount}
            onChange={(e) => set("pieceCount", Number(e.target.value))}
            className="h-9 w-full accent-primary"
          />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => setPreviewOpen(true)}
          disabled={!values.packetImage}
        >
          <Play className="size-4" /> Preview
        </Button>
        <Button onClick={save} disabled={pending} className="min-w-32">
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Product Reveal preview</DialogTitle>
          </DialogHeader>
          <div className="relative h-[420px] overflow-hidden rounded-xl bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900">
            <p className="absolute left-5 top-5 max-w-[45%] text-sm text-white/40">
              Your hero slide renders here — the animation overlays it exactly like this.
            </p>
            {previewOpen && values.packetImage && (
              <HeroRevealOverlay
                key={`${values.packetImage}|${values.pieceImage}|${values.speed}|${values.delaySec}|${values.pieceCount}`}
                settings={{ ...values, enabled: true }}
                preview
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
