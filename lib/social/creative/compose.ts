import "server-only";
import https from "node:https";
import { prisma } from "@/lib/prisma";
import { cloudinary, cloudinaryEnabled, safeFolder } from "@/lib/cloudinary";
import { stripTransforms, type Palette } from "@/lib/social/design";
import { paletteForImage } from "@/lib/social/palette";
import { pickLook, getLookByKey, type LookKey } from "@/lib/social/creative/looks";
import { PLATFORM_SIZES, DEFAULT_PLATFORM, type PlatformKey } from "@/lib/social/creative/platforms";
import { renderCreative, renderCarouselFrame, type CreativeContent } from "@/lib/social/creative/render";

/**
 * The creative pipeline: pick a look, prep the product photo (Cloudinary does
 * the trim/fit/round — cheap, no bytes through our server), render the full
 * premium composition with `next/og` (typography, cards, badges, layering),
 * then upload the finished PNG to Cloudinary so `imageUrls` stays a plain
 * public URL exactly like every other post image. Replaces the old
 * lib/social/design.ts URL-transform compositor end to end.
 *
 * Degrades gracefully like every other social feature: no Cloudinary configured
 * → the raw product photo ships undesigned (today's keyless behaviour) rather
 * than failing the post.
 */

export type ComposeInput = {
  /** pickPostImages() output — [0] is the cover source. */
  rawImages: string[];
  content: CreativeContent;
  rotation: number;
  recentLookKeys: string[];
  platform?: PlatformKey;
  handle?: string | null;
  /** True only when the post's content style is RECIPE — the one case the
   *  numbered-step RECIPE_EDU look fits (see looks.ts#pickLook). */
  sequentialContent?: boolean;
  /** Re-render in this EXACT look instead of rotating to a new one — used when
   *  an admin edits the on-image text (headline/support/benefits) on an
   *  existing post: the words change, but the visual style the admin already
   *  saw shouldn't jump to something else. */
  forceLookKey?: string;
};

export type ComposeResult = {
  imageUrls: string[];
  lookKey: string;
  /** True only when `imageUrls` is an actual satori-rendered composition —
   *  false for every fallback path (no image, keyless, or a caught render/
   *  upload failure), where `imageUrls` is just the plain, undesigned
   *  photo(s) passed through unchanged. Callers that need the image to
   *  actually REFLECT `content` (e.g. an admin editing on-image text) must
   *  check this — a non-throwing return is NOT the same guarantee as a
   *  successful render, and conflating the two would silently let stored
   *  text drift from what the image shows, exactly backwards from the whole
   *  point of forceLookKey. Callers that just want a post to ship with
   *  SOMETHING (the planner, "Generate a post") can ignore it. */
  designed: boolean;
};

/** The connected IG handle for the creative watermark — optional, so a
 *  not-yet-connected install still designs posts, just without it. Shared by
 *  the planner and the admin generate/regenerate actions. */
export async function resolveSocialHandle(): Promise<string | null> {
  const account = await prisma.socialAccount.findUnique({ where: { id: "singleton" } });
  return account?.username ? `@${account.username.replace(/^@/, "")}` : null;
}

/** A trimmed, fit, rounded-corner cutout of the product photo. `f_png` keeps
 *  the rounded corners genuinely transparent so it sits naturally on whatever
 *  background the chosen look paints — no stray white/black corner squares. */
function cutoutUrl(imageUrl: string, boxW: number, boxH: number): string {
  const base = stripTransforms(imageUrl);
  const chain = [`e_trim:10`, `c_fit,w_${boxW},h_${boxH}`, `r_24`, `f_png`].join(",");
  return base.replace("/upload/", `/upload/${chain}/`);
}

/** Fetch a remote image as a data URI, via the classic `https` module rather
 *  than `fetch` — deliberately dependency-free and avoids any undici-specific
 *  connection quirks; never throws (a failed cutout degrades the look rather
 *  than failing the whole post — see the call sites below). */
function toDataUri(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const req = https.get(url, { timeout: 15_000 }, (res) => {
      if (res.statusCode !== 200) {
        console.error(`[social] product cutout fetch got HTTP ${res.statusCode} for ${url}`);
        res.resume();
        resolve(null);
        return;
      }
      const contentType = res.headers["content-type"] || "image/png";
      const chunks: Buffer[] = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(`data:${contentType};base64,${Buffer.concat(chunks).toString("base64")}`));
      res.on("error", (err) => {
        console.error(`[social] product cutout stream error for ${url}:`, err);
        resolve(null);
      });
    });
    req.on("timeout", () => req.destroy(new Error("timed out")));
    req.on("error", (err) => {
      console.error(`[social] failed to fetch product cutout ${url}:`, err);
      resolve(null);
    });
  });
}

async function uploadBuffer(buf: Buffer): Promise<string> {
  const dataUri = `data:image/png;base64,${buf.toString("base64")}`;
  const result = await cloudinary.uploader.upload(dataUri, {
    folder: safeFolder("social/generated"),
    resource_type: "image",
  });
  return result.secure_url;
}

export async function composeCreative(input: ComposeInput): Promise<ComposeResult> {
  const look = input.forceLookKey
    ? getLookByKey(input.forceLookKey)
    : pickLook(input.rotation, input.recentLookKeys, input.sequentialContent);
  const { rawImages } = input;

  if (!rawImages.length) return { imageUrls: [], lookKey: look.key, designed: false };

  // Keyless / no Cloudinary: ship the plain product photo(s), same as before
  // this engine existed, rather than fail the post over a missing dependency.
  if (!cloudinaryEnabled || !rawImages[0].includes("res.cloudinary.com")) {
    return { imageUrls: rawImages, lookKey: look.key, designed: false };
  }

  const size = PLATFORM_SIZES[input.platform ?? DEFAULT_PLATFORM];

  // The cover is the one image every post needs. Any failure anywhere in this
  // chain (palette lookup, satori rendering, the Cloudinary upload itself —
  // all real, observed failure modes: a Cloudinary outage, a network blip, a
  // malformed source image) used to throw all the way out of this function,
  // which meant a single bad product photo could abort an entire planner run
  // (every OTHER campaign due in that cron tick silently never got planned)
  // or surface as a raw unhandled error in the admin "Generate" action. Now it
  // degrades to the plain product photo(s) — exactly the keyless fallback
  // above — so a transient failure costs a nicer cover, never the post.
  try {
    const palette: Palette = await paletteForImage(rawImages[0]);
    const coverCutout = await toDataUri(cutoutUrl(rawImages[0], Math.round(size.width * 0.72), Math.round(size.height * 0.6)));
    const coverBuf = await renderCreative(look.key as LookKey, {
      productImageDataUri: coverCutout,
      palette,
      content: input.content,
      size,
      handle: input.handle,
    });
    const imageUrls = [await uploadBuffer(coverBuf)];

    for (const raw of rawImages.slice(1)) {
      // A single carousel frame failing (fetch/render/upload) shouldn't lose
      // the cover we already have — skip just that frame.
      try {
        const frameCutout = await toDataUri(cutoutUrl(raw, Math.round(size.width * 0.8), Math.round(size.height * 0.8)));
        if (!frameCutout) continue; // fetch failed — drop the frame rather than fail the whole post
        const frameBuf = await renderCarouselFrame(frameCutout, palette, size, input.handle);
        imageUrls.push(await uploadBuffer(frameBuf));
      } catch (err) {
        console.error(`[social] carousel frame compose failed, skipping frame ${raw}:`, err);
      }
    }

    return { imageUrls, lookKey: look.key, designed: true };
  } catch (err) {
    console.error(
      `[social] creative compose failed (look=${look.key}, cover=${rawImages[0]}) — shipping the plain product photo instead:`,
      err,
    );
    return { imageUrls: rawImages, lookKey: look.key, designed: false };
  }
}
