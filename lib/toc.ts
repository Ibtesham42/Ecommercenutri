import { slugify } from "@/lib/format";

export type TocHeading = { id: string; text: string; level: 2 | 3 };

/**
 * Post-process already-sanitized article HTML: inject stable `id` anchors into
 * h2/h3 headings and return the heading list for a Table of Contents. Runs
 * AFTER sanitizeRichText, so the injected ids are our own slugified values
 * (safe) even though the sanitizer doesn't allow author-supplied ids. h4+ are
 * left as sub-detail and omitted from the TOC to keep it scannable.
 */
export function buildToc(html: string): { html: string; headings: TocHeading[] } {
  const headings: TocHeading[] = [];
  const used = new Set<string>();

  const withIds = html.replace(
    /<(h[23])(\s[^>]*)?>([\s\S]*?)<\/\1>/gi,
    (match, tag: string, attrs: string | undefined, inner: string) => {
      const text = inner.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
      if (!text) return match;
      const base = slugify(text) || "section";
      let id = base;
      for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
      used.add(id);
      headings.push({ id, text, level: tag.toLowerCase() === "h2" ? 2 : 3 });
      // Preserve any existing attributes the sanitizer allowed, then add id.
      return `<${tag}${attrs ?? ""} id="${id}">${inner}</${tag}>`;
    },
  );

  return { html: withIds, headings };
}
