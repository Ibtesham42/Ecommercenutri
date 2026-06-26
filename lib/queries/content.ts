import { prisma } from "@/lib/prisma";
import {
  LEGAL_CONTENT,
  type LegalSlug,
  type LegalPageContent,
} from "@/lib/legal-content";

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
    return { mode: "custom", title: row.title, html: row.body, updatedAt: row.updatedAt };
  }
  return {
    mode: "default",
    title: LEGAL_CONTENT[slug].title,
    content: LEGAL_CONTENT[slug],
    updatedAt: null,
  };
}
