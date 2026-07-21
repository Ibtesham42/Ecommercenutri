/**
 * Best-effort server-side PDF text extraction so Byte can answer "summarize
 * this chapter" / "explain page 8" honestly, from the resource's real
 * content rather than just its title/subject. Bounded and defensive — never
 * throws, never blocks a chat turn for long, nothing is persisted (extracted
 * fresh per request, matching the module's "no shared writes" isolation).
 */
import { isTrustedCloudinaryUrl } from "@/lib/cloudinary";

const MAX_PAGES = 20;
const MAX_CHARS = 12000;
const FETCH_TIMEOUT_MS = 8000;

export type PdfExtractResult = { text: string; truncated: boolean; pageCount: number };

export async function extractPdfText(fileUrl: string): Promise<PdfExtractResult | null> {
  // Belt-and-suspenders: fileUrl is already constrained at the DB boundary
  // (lib/validations/jnv.ts), but this is a server-side fetch of
  // admin-supplied input firing on every public student page view — never
  // let it become an SSRF primitive even if that boundary is ever bypassed.
  if (!isTrustedCloudinaryUrl(fileUrl)) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(fileUrl, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const buffer = new Uint8Array(await res.arrayBuffer());

    // Legacy Node build — no DOM/Worker required, runs on the main thread.
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const doc = await pdfjs.getDocument({ data: buffer, useSystemFonts: true }).promise;

    const pageCount = doc.numPages;
    const pagesToRead = Math.min(pageCount, MAX_PAGES);
    let text = "";
    let truncated = pageCount > pagesToRead;

    for (let i = 1; i <= pagesToRead; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      text += `\n--- Page ${i} ---\n${pageText}`;
      if (text.length >= MAX_CHARS) {
        truncated = true;
        break;
      }
    }

    await doc.destroy();

    if (text.length > MAX_CHARS) {
      text = text.slice(0, MAX_CHARS);
      truncated = true;
    }

    return { text: text.trim(), truncated, pageCount };
  } catch (err) {
    console.error("[jnv] PDF text extraction failed:", err);
    return null;
  }
}
