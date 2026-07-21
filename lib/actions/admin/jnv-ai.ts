"use server";

import { requirePermission } from "@/lib/auth";
import { jnvTeacherContentSchema } from "@/lib/validations/jnv";
import { generateJnvTeacherContent } from "@/lib/jnv/ai-teacher";
import type { JnvTeacherContentKey } from "@/lib/jnv/teacher-content-types";
import type { AdminResult } from "@/lib/actions/admin/types";

/** Teacher AI Toolkit — generates lesson plans, quizzes, worksheets, etc.
 *  Buffered (not streamed): the admin flow is generate-then-edit, so the
 *  client just needs the finished text. Nothing is persisted here — the
 *  teacher edits and exports client-side; saving isn't required to use it. */
export async function generateJnvTeacherContentAction(
  input: unknown,
): Promise<AdminResult<{ content: string }>> {
  await requirePermission("jnv");

  const parsed = jnvTeacherContentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };
  }

  const result = await generateJnvTeacherContent({
    ...parsed.data,
    // Zod's runtime-built enum widens to `string`; the schema's values come
    // from the same JNV_TEACHER_CONTENT_TYPES catalog, so this is safe.
    contentType: parsed.data.contentType as JnvTeacherContentKey,
  });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, data: { content: result.content } };
}
