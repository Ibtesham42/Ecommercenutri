import { prisma } from "@/lib/prisma";
import { sanitizeRichText } from "@/lib/sanitize";
import {
  LEGAL_CONTENT,
  LEGAL_SLUGS,
  legalDefaultHtml,
  type LegalSlug,
  type LegalPageContent,
} from "@/lib/legal-content";

export type AdminLegalPage = {
  slug: LegalSlug;
  title: string;
  body: string; // current custom HTML, or the default rendered to HTML
  isCustom: boolean;
  updatedAt: string | null;
};

/** All three legal pages for the admin editor — custom row if present, else the
 *  built-in default rendered to editable HTML. */
export async function getAdminLegalPages(): Promise<AdminLegalPage[]> {
  const rows = await prisma.contentPage.findMany({ where: { slug: { in: [...LEGAL_SLUGS] } } });
  const bySlug = new Map(rows.map((r) => [r.slug, r]));
  return LEGAL_SLUGS.map((slug) => {
    const row = bySlug.get(slug);
    if (row) {
      return { slug, title: row.title, body: row.body, isCustom: true, updatedAt: row.updatedAt.toISOString() };
    }
    return {
      slug,
      title: LEGAL_CONTENT[slug].title,
      body: legalDefaultHtml(slug),
      isCustom: false,
      updatedAt: null,
    };
  });
}

export type LegalPage =
  | { mode: "default"; title: string; content: LegalPageContent; updatedAt: Date | null }
  | { mode: "custom"; title: string; html: string; updatedAt: Date };

/**
 * Resolve a legal/policy page: an admin-edited `ContentPage` row wins, otherwise
 * the built-in default from lib/legal-content.ts. Resilient to a brief DB outage.
 */
export async function getLegalPage(slug: LegalSlug): Promise<LegalPage> {
  let row: Awaited<ReturnType<typeof prisma.contentPage.findUnique>> = null;
  try {
    row = await prisma.contentPage.findUnique({ where: { slug } });
  } catch {
    /* fall back to defaults */
  }

  if (row) {
    // Sanitize here so the raw body never flows into the rendered tree / RSC payload
    // (defense-in-depth beyond the save-time sanitize). Keeps storefront pages from
    // ever serializing unsanitized HTML, even for a legacy/externally-written row.
    return { mode: "custom", title: row.title, html: sanitizeRichText(row.body), updatedAt: row.updatedAt };
  }
  return {
    mode: "default",
    title: LEGAL_CONTENT[slug].title,
    content: LEGAL_CONTENT[slug],
    updatedAt: null,
  };
}
