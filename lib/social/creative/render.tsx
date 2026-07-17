import "server-only";
import type { ReactElement } from "react";
import { ImageResponse } from "next/og";
import type { Palette } from "@/lib/social/design";
import { withAlpha } from "@/lib/social/creative/primitives";
import { GlassCard, BenefitChip, CtaPill, OrganicBlob, Watermark, IconStatCard } from "@/lib/social/creative/primitives";
import { SERIF, SANS, loadCreativeFonts } from "@/lib/social/creative/fonts";
import type { LookKey } from "@/lib/social/creative/looks";
import type { PlatformSize } from "@/lib/social/creative/platforms";

/**
 * The premium creative renderer: one JSX layout per LookKey, composed from the
 * shared primitives (lib/social/creative/primitives.tsx) and rendered to a PNG
 * via `next/og`'s ImageResponse (satori + resvg — already a project dependency,
 * used today for the OG/favicon images). This REPLACES the old Cloudinary
 * URL-transform compositor: real typography hierarchy, layered cards, glass
 * surfaces, organic shapes and a genuinely different layout per look, instead
 * of a product photo padded onto a tinted square with one or two text layers.
 */

export type CreativeContent = {
  headline: string;
  support?: string | null;
  /** 3-5 short benefit phrases (already length-capped by the caller). */
  benefits: string[];
  cta: string;
  categoryLabel?: string | null;
  priceLabel?: string | null;
  discountLabel?: string | null;
};

export type CreativeInput = {
  /** Pre-fetched data: URI of the product cutout (Cloudinary-prepped: trimmed,
   *  fit into a box, rounded card), or null for a brand-only / photo-less post. */
  productImageDataUri: string | null;
  palette: Palette;
  content: CreativeContent;
  size: PlatformSize;
  handle?: string | null;
};

const PAD = 72;

function ProductImage({
  src,
  maxWidth,
  maxHeight,
}: {
  src: string;
  maxWidth: number;
  maxHeight: number;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- satori requires a plain <img>, not next/image
    <img
      src={src}
      alt=""
      style={{ maxWidth, maxHeight, objectFit: "contain" }}
      // width/height are unknown ahead of decode; satori sizes from the style box.
    />
  );
}

function BenefitRow({ benefits, palette, dark }: { benefits: string[]; palette: Palette; dark?: boolean }) {
  if (!benefits.length) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
      {benefits.slice(0, 5).map((b, i) => (
        <BenefitChip key={b} text={b} index={i} palette={palette} dark={dark} />
      ))}
    </div>
  );
}

function Kicker({ text, palette, dark }: { text: string; palette: Palette; dark?: boolean }) {
  return (
    <span
      style={{
        fontFamily: SANS,
        fontWeight: 700,
        fontSize: 26,
        letterSpacing: 5,
        textTransform: "uppercase",
        color: dark ? withAlpha("#FFFFFF", 0.85) : palette.accent,
      }}
    >
      {text}
    </span>
  );
}

// ── One layout function per look ────────────────────────────────────────────

function editorial(input: CreativeInput) {
  const { palette, content, size, productImageDataUri: img } = input;
  const dark = palette.mood === "dark";
  return (
    <div
      style={{
        width: size.width,
        height: size.height,
        display: "flex",
        background: palette.bg,
        padding: PAD,
        fontFamily: SANS,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", width: "48%", justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          {content.categoryLabel && <Kicker text={content.categoryLabel} palette={palette} dark={dark} />}
          <span
            style={{
              fontFamily: SERIF,
              fontWeight: 700,
              fontSize: 76,
              lineHeight: 1.04,
              color: dark ? "#FBF8F2" : palette.ink,
              letterSpacing: -1,
            }}
          >
            {content.headline}
          </span>
          {content.support && (
            <span style={{ fontFamily: SANS, fontWeight: 500, fontSize: 30, color: withAlpha(palette.ink, 0.72) }}>
              {content.support}
            </span>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <BenefitRow benefits={content.benefits} palette={palette} dark={dark} />
          <div style={{ display: "flex" }}>
            <CtaPill text={content.cta} palette={palette} />
          </div>
        </div>
      </div>
      <div style={{ display: "flex", width: "52%", alignItems: "center", justifyContent: "center", position: "relative" }}>
        <div
          style={{
            position: "absolute",
            width: "88%",
            height: "78%",
            borderRadius: 32,
            background: withAlpha(palette.ink, 0.05),
          }}
        />
        {img && <ProductImage src={img} maxWidth={size.width * 0.42} maxHeight={size.height * 0.62} />}
      </div>
      <div style={{ display: "flex", position: "absolute", left: PAD, bottom: PAD }}>
        <Watermark palette={palette} dark={dark} handle={input.handle} />
      </div>
    </div>
  );
}

function luxuryMinimal(input: CreativeInput) {
  const { palette, content, size, productImageDataUri: img } = input;
  const dark = palette.mood === "dark";
  return (
    <div
      style={{
        width: size.width,
        height: size.height,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        background: palette.bg,
        padding: PAD + 20,
      }}
    >
      <div style={{ display: "flex" }}>
        <Watermark palette={palette} dark={dark} handle={input.handle} />
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        {img && <ProductImage src={img} maxWidth={size.width * 0.56} maxHeight={size.height * 0.5} />}
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20, textAlign: "center" }}>
        <div style={{ display: "flex", width: 64, height: 2, background: palette.accent }} />
        <span
          style={{
            fontFamily: SERIF,
            fontWeight: 600,
            fontSize: 58,
            color: dark ? "#FBF8F2" : palette.ink,
            letterSpacing: -0.5,
            textAlign: "center",
            maxWidth: size.width * 0.78,
          }}
        >
          {content.headline}
        </span>
        {content.support && (
          <span style={{ fontFamily: SANS, fontWeight: 500, fontSize: 28, color: withAlpha(palette.ink, 0.68) }}>
            {content.support}
          </span>
        )}
        <div style={{ display: "flex", marginTop: 8 }}>
          <CtaPill text={content.cta} palette={palette} />
        </div>
      </div>
    </div>
  );
}

function organicWellness(input: CreativeInput) {
  const { palette, content, size, productImageDataUri: img } = input;
  const dark = palette.mood === "dark";
  return (
    <div
      style={{
        width: size.width,
        height: size.height,
        display: "flex",
        flexDirection: "column",
        background: palette.bg,
        position: "relative",
        padding: PAD,
      }}
    >
      <OrganicBlob color={palette.accent} size={size.width * 0.7} top={-size.width * 0.2} left={-size.width * 0.2} />
      <OrganicBlob color={palette.ink} size={size.width * 0.55} top={size.height * 0.45} left={size.width * 0.55} opacity={0.18} />
      <div style={{ display: "flex", flexDirection: "column", gap: 16, zIndex: "1" }}>
        {content.categoryLabel && <Kicker text={content.categoryLabel} palette={palette} dark={dark} />}
        <span
          style={{
            fontFamily: SERIF,
            fontWeight: 700,
            fontSize: 66,
            lineHeight: 1.08,
            color: dark ? "#FBF8F2" : palette.ink,
            maxWidth: size.width * 0.72,
          }}
        >
          {content.headline}
        </span>
      </div>
      <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", zIndex: "1" }}>
        {img && <ProductImage src={img} maxWidth={size.width * 0.6} maxHeight={size.height * 0.44} />}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 22, zIndex: "1" }}>
        <GlassCard palette={palette} style={{ padding: "28px 32px" }}>
          <BenefitRow benefits={content.benefits} palette={palette} />
        </GlassCard>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Watermark palette={palette} dark={dark} handle={input.handle} />
          <CtaPill text={content.cta} palette={palette} />
        </div>
      </div>
    </div>
  );
}

function modernD2c(input: CreativeInput) {
  const { palette, content, size, productImageDataUri: img } = input;
  const dark = palette.mood === "dark";
  return (
    <div
      style={{
        width: size.width,
        height: size.height,
        display: "flex",
        flexDirection: "column",
        background: dark ? palette.bg : `linear-gradient(160deg, ${palette.bg} 0%, ${withAlpha(palette.accent, 0.16)} 100%)`,
        padding: PAD,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Watermark palette={palette} dark={dark} handle={input.handle} />
        {content.priceLabel && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 22px",
              borderRadius: 999,
              background: palette.ink,
            }}
          >
            <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: 24, color: palette.bg }}>
              {content.priceLabel}
            </span>
            {content.discountLabel && (
              <span style={{ fontFamily: SANS, fontWeight: 600, fontSize: 20, color: palette.accent }}>
                {content.discountLabel}
              </span>
            )}
          </div>
        )}
      </div>
      <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center" }}>
        {img && <ProductImage src={img} maxWidth={size.width * 0.58} maxHeight={size.height * 0.42} />}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <span
          style={{
            fontFamily: SANS,
            fontWeight: 800,
            fontSize: 56,
            lineHeight: 1.06,
            color: dark ? "#FBF8F2" : palette.ink,
            letterSpacing: -1,
            maxWidth: size.width * 0.86,
          }}
        >
          {content.headline}
        </span>
        <BenefitRow benefits={content.benefits} palette={palette} dark={dark} />
        <div style={{ display: "flex" }}>
          <CtaPill text={content.cta} palette={palette} />
        </div>
      </div>
    </div>
  );
}

function appleMinimal(input: CreativeInput) {
  const { palette, content, size, productImageDataUri: img } = input;
  const dark = palette.mood === "dark";
  return (
    <div
      style={{
        width: size.width,
        height: size.height,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: palette.bg,
        padding: PAD,
        gap: 44,
      }}
    >
      {img && <ProductImage src={img} maxWidth={size.width * 0.66} maxHeight={size.height * 0.56} />}
      <span
        style={{
          fontFamily: SANS,
          fontWeight: 700,
          fontSize: 50,
          color: dark ? "#FBF8F2" : palette.ink,
          textAlign: "center",
          letterSpacing: -0.5,
          maxWidth: size.width * 0.8,
        }}
      >
        {content.headline}
      </span>
      {content.support && (
        <span style={{ fontFamily: SANS, fontWeight: 400, fontSize: 28, color: withAlpha(palette.ink, 0.6) }}>
          {content.support}
        </span>
      )}
      <div style={{ position: "absolute", bottom: PAD, display: "flex" }}>
        <Watermark palette={palette} dark={dark} handle={input.handle} />
      </div>
    </div>
  );
}

function recipeEdu(input: CreativeInput) {
  const { palette, content, size, productImageDataUri: img } = input;
  const dark = palette.mood === "dark";
  const steps = content.benefits.slice(0, 4);
  return (
    <div
      style={{
        width: size.width,
        height: size.height,
        display: "flex",
        flexDirection: "column",
        background: palette.bg,
        padding: PAD,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 36 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, flex: 1 }}>
          {content.categoryLabel && <Kicker text={content.categoryLabel} palette={palette} dark={dark} />}
          <span
            style={{
              fontFamily: SERIF,
              fontWeight: 700,
              fontSize: 60,
              lineHeight: 1.08,
              color: dark ? "#FBF8F2" : palette.ink,
            }}
          >
            {content.headline}
          </span>
        </div>
        {img && <ProductImage src={img} maxWidth={size.width * 0.32} maxHeight={size.height * 0.3} />}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1, justifyContent: "center" }}>
        {steps.map((s, i) => (
          <div key={s} style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 48,
                height: 48,
                borderRadius: "50%",
                background: palette.accent,
                fontFamily: SERIF,
                fontWeight: 700,
                fontSize: 24,
                color: "#1B1B1A",
                flexShrink: 0,
              }}
            >
              {i + 1}
            </div>
            <span style={{ fontFamily: SANS, fontWeight: 500, fontSize: 30, color: withAlpha(palette.ink, 0.9) }}>
              {s}
            </span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Watermark palette={palette} dark={dark} handle={input.handle} />
        <CtaPill text={content.cta} palette={palette} />
      </div>
    </div>
  );
}

function healthFact(input: CreativeInput) {
  const { palette, content, size, productImageDataUri: img } = input;
  const dark = palette.mood === "dark";
  return (
    <div
      style={{
        width: size.width,
        height: size.height,
        display: "flex",
        flexDirection: "column",
        background: dark ? palette.bg : `linear-gradient(135deg, ${withAlpha(palette.accent, 0.14)} 0%, ${palette.bg} 55%)`,
        padding: PAD,
      }}
    >
      <div style={{ display: "flex" }}>
        <Watermark palette={palette} dark={dark} handle={input.handle} />
      </div>
      <div style={{ display: "flex", flex: 1, alignItems: "center", gap: 48 }}>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 20 }}>
          {content.categoryLabel && <Kicker text={content.categoryLabel} palette={palette} dark={dark} />}
          <span
            style={{
              fontFamily: SERIF,
              fontWeight: 700,
              fontSize: 62,
              lineHeight: 1.06,
              color: dark ? "#FBF8F2" : palette.ink,
            }}
          >
            {content.headline}
          </span>
          {content.support && (
            <span style={{ fontFamily: SANS, fontWeight: 500, fontSize: 28, color: withAlpha(palette.ink, 0.68) }}>
              {content.support}
            </span>
          )}
        </div>
        {img && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1 }}>
            <ProductImage src={img} maxWidth={size.width * 0.4} maxHeight={size.height * 0.4} />
          </div>
        )}
      </div>
      <GlassCard palette={palette} style={{ padding: "30px 34px", gap: 4 }}>
        <BenefitRow benefits={content.benefits} palette={palette} />
      </GlassCard>
      <div style={{ display: "flex", marginTop: 24 }}>
        <CtaPill text={content.cta} palette={palette} />
      </div>
    </div>
  );
}

function infographicGrid(input: CreativeInput) {
  const { palette, content, size, productImageDataUri: img } = input;
  const dark = palette.mood === "dark";
  const stats = content.benefits.slice(0, 4);
  return (
    <div
      style={{
        width: size.width,
        height: size.height,
        display: "flex",
        flexDirection: "column",
        background: palette.bg,
        padding: PAD,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, flex: 1 }}>
          {content.categoryLabel && <Kicker text={content.categoryLabel} palette={palette} dark={dark} />}
          <span
            style={{
              fontFamily: SERIF,
              fontWeight: 700,
              fontSize: 58,
              lineHeight: 1.08,
              color: dark ? "#FBF8F2" : palette.ink,
              maxWidth: size.width * 0.62,
            }}
          >
            {content.headline}
          </span>
        </div>
        {img && (
          <div style={{ display: "flex", borderRadius: 24, overflow: "hidden" }}>
            <ProductImage src={img} maxWidth={size.width * 0.26} maxHeight={size.width * 0.26} />
          </div>
        )}
      </div>
      <div style={{ display: "flex", flex: 1, alignItems: "center" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
          {stats.map((s, i) => (
            <IconStatCard key={s} text={s} index={i} palette={palette} dark={dark} />
          ))}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Watermark palette={palette} dark={dark} handle={input.handle} />
        <CtaPill text={content.cta} palette={palette} />
      </div>
    </div>
  );
}

const LAYOUTS: Record<LookKey, (input: CreativeInput) => ReactElement> = {
  EDITORIAL: editorial,
  LUXURY_MINIMAL: luxuryMinimal,
  ORGANIC_WELLNESS: organicWellness,
  MODERN_D2C: modernD2c,
  APPLE_MINIMAL: appleMinimal,
  RECIPE_EDU: recipeEdu,
  HEALTH_FACT: healthFact,
  INFOGRAPHIC: infographicGrid,
};

/** Render one look to a PNG buffer at the given platform size. */
export async function renderCreative(look: LookKey, input: CreativeInput): Promise<Buffer> {
  const tree = LAYOUTS[look](input);
  const response = new ImageResponse(tree, {
    width: input.size.width,
    height: input.size.height,
    fonts: loadCreativeFonts(),
  });
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * A lightweight carousel frame: product-forward, same palette/canvas as the
 * cover, only the watermark for text. Instagram crops every carousel item to
 * the cover's aspect ratio, so this must share `size` with the cover render.
 */
export async function renderCarouselFrame(
  productImageDataUri: string,
  palette: Palette,
  size: PlatformSize,
  handle?: string | null,
): Promise<Buffer> {
  const dark = palette.mood === "dark";
  const tree = (
    <div
      style={{
        width: size.width,
        height: size.height,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: palette.bg,
        padding: PAD,
        position: "relative",
      }}
    >
      <ProductImage src={productImageDataUri} maxWidth={size.width * 0.72} maxHeight={size.height * 0.72} />
      <div style={{ position: "absolute", left: PAD, bottom: PAD, display: "flex" }}>
        <Watermark palette={palette} dark={dark} handle={handle} />
      </div>
    </div>
  );
  const response = new ImageResponse(tree, { width: size.width, height: size.height, fonts: loadCreativeFonts() });
  return Buffer.from(await response.arrayBuffer());
}
