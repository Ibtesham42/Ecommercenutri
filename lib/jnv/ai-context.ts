import { getJnvResourceById } from "@/lib/queries/jnv";
import { extractPdfText } from "@/lib/jnv/extract-pdf-text";
import { cached } from "@/lib/redis";

export type JnvResourceAiContext = { title: string; classLevel: number; text: string };

/**
 * Resolves a resource into context text for Byte — real extracted PDF text
 * when possible (Redis-cached per resource for an hour so a multi-turn
 * conversation doesn't re-parse the same PDF every message), metadata-only
 * for kinds we can't read yet (image/PPT/DOC — no vision model or
 * doc-parsing wired up). Never throws; returns null only if the resource
 * itself doesn't exist.
 */
export async function buildJnvResourceContext(resourceId: string): Promise<JnvResourceAiContext | null> {
  const resource = await getJnvResourceById(resourceId).catch(() => null);
  if (!resource) return null;

  const metaLines = [
    `Title: ${resource.title}`,
    resource.subject ? `Subject: ${resource.subject}` : null,
    `Class: ${resource.classLevel}`,
    resource.teacherName ? `Teacher: ${resource.teacherName}` : null,
    resource.description ? `Description: ${resource.description}` : null,
    `File type: ${resource.fileKind}`,
  ]
    .filter(Boolean)
    .join("\n");

  let bodyText = "";
  if (resource.fileKind === "PDF") {
    const extracted = await cached(`jnv:pdf-text:${resourceId}`, 3600, () =>
      extractPdfText(resource.fileUrl),
    );
    if (extracted?.text) {
      bodyText = `\n\nExtracted text from the PDF${
        extracted.truncated ? " (truncated — only the first part of the document is shown)" : ""
      }:\n${extracted.text}`;
    }
  }

  if (!bodyText) {
    bodyText =
      "\n\n(No extracted document text is available for this file type yet — answer using the title/subject/description above, and be upfront with the student/teacher that you're working from that metadata, not the literal file content.)";
  }

  return { title: resource.title, classLevel: resource.classLevel, text: `${metaLines}${bodyText}` };
}
