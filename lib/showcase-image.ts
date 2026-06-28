/**
 * Browser-side showcase image pipeline — "upload one image, get a studio cutout".
 * Runs entirely in the admin browser (never SSR): EXIF-correct decode → optional
 * in-browser background removal (@imgly/background-removal, lazy-imported so its
 * multi-MB WASM model only loads when actually used) → alpha bounding-box
 * auto-frame (center + pad into a square, undistorted) → PNG cutout. The caller
 * uploads both the original (for `image`) and the cutout (for `imagePng`).
 *
 * Edge cases handled: animated GIF rejected; tiny image warned; low-confidence
 * removal falls back to the original; cancel via AbortSignal.
 */

const MAX_EDGE = 1200;
const FRAME_PADDING = 0.1; // ~10% — matches PRODUCT.framePadding in showcase-config

export type ProcessOptions = {
  removeBg?: boolean;
  signal?: AbortSignal;
  onProgress?: (ratio: number) => void;
};

export type ProcessResult = {
  originalBlob: Blob;
  cutoutBlob: Blob | null; // null when removal is off or low-confidence
  removed: boolean;
  warning?: string;
};

function abortIf(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
}

function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Image encoding failed"))),
      mime,
      quality,
    ),
  );
}

async function bitmapToBlob(
  bitmap: ImageBitmap,
  maxEdge: number,
  mime: string,
  quality: number,
): Promise<Blob> {
  let { width, height } = bitmap;
  const longest = Math.max(width, height);
  if (longest > maxEdge) {
    const s = maxEdge / longest;
    width = Math.round(width * s);
    height = Math.round(height * s);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, width, height);
  return canvasToBlob(canvas, mime, quality);
}

/** Crop to the product's alpha bounding box, then center + pad into a square. */
async function autoFrame(src: Blob): Promise<Blob | null> {
  const bmp = await createImageBitmap(src);
  const w = bmp.width;
  const h = bmp.height;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(bmp, 0, 0);
  const data = ctx.getImageData(0, 0, w, h).data;

  const A = 24; // alpha threshold for "is product"
  let minX = w,
    minY = h,
    maxX = -1,
    maxY = -1,
    opaque = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > A) {
        opaque++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  const coverage = opaque / (w * h);
  // Nothing isolated, or almost nothing removed → treat as low-confidence.
  if (maxX < minX || coverage < 0.03 || coverage > 0.985) {
    bmp.close();
    return null;
  }

  const bw = maxX - minX + 1;
  const bh = maxY - minY + 1;
  const box = Math.max(bw, bh);
  const out = Math.min(MAX_EDGE, Math.round(box * (1 + FRAME_PADDING * 2)));
  const inner = out / (1 + FRAME_PADDING * 2);
  const scale = inner / box;
  const dw = bw * scale;
  const dh = bh * scale;

  const oc = document.createElement("canvas");
  oc.width = out;
  oc.height = out;
  const octx = oc.getContext("2d")!;
  octx.imageSmoothingQuality = "high";
  octx.drawImage(bmp, minX, minY, bw, bh, (out - dw) / 2, (out - dh) / 2, dw, dh);
  bmp.close();
  return canvasToBlob(oc, "image/png");
}

export async function processShowcaseImage(
  file: File,
  opts: ProcessOptions = {},
): Promise<ProcessResult> {
  const { removeBg = true, signal, onProgress } = opts;
  abortIf(signal);

  const type = (file.type || "").toLowerCase();
  if (type === "image/gif") {
    throw new Error("Animated GIFs aren't supported — upload a JPG, PNG or WebP photo.");
  }
  if (!/^image\/(jpe?g|png|webp)$/.test(type)) {
    throw new Error("Unsupported file type. Use JPG, PNG or WebP.");
  }

  // 1. EXIF-correct decode (auto-rotates phone photos).
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  let warning: string | undefined;
  if (Math.max(bitmap.width, bitmap.height) < 500) {
    warning = "This image is small — it may look soft in the large 3D hero.";
  }

  // 2. Normalized original for the `image` field (keeps PNG alpha; JPEG otherwise).
  const originalBlob = await bitmapToBlob(
    bitmap,
    MAX_EDGE,
    type === "image/png" ? "image/png" : "image/jpeg",
    0.9,
  );

  // 3. Background removal + auto-frame → cutout for the `imagePng` field.
  let cutoutBlob: Blob | null = null;
  let removed = false;
  if (removeBg) {
    onProgress?.(0);
    const { removeBackground } = await import("@imgly/background-removal");
    abortIf(signal);
    const cut = await removeBackground(file, {
      output: { format: "image/png" },
      progress: (_key: string, current: number, total: number) =>
        onProgress?.(total ? current / total : 0),
    });
    abortIf(signal);
    const framed = await autoFrame(cut);
    if (framed) {
      cutoutBlob = framed;
      removed = true;
    } else {
      warning = "Couldn't isolate the product cleanly — using the original image instead.";
    }
  }

  bitmap.close();
  return { originalBlob, cutoutBlob, removed, warning };
}
