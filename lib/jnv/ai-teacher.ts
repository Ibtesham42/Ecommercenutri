import { generateText } from "ai";
import { getModel, aiAvailable } from "@/lib/ai/provider";
import { DEFAULT_GROQ_MODEL } from "@/lib/groq";
import { buildJnvAssistantSystemPrompt } from "@/lib/jnv/ai-prompts";
import { JNV_TEACHER_CONTENT_TYPES, type JnvTeacherContentKey } from "@/lib/jnv/teacher-content-types";
import { buildJnvResourceContext } from "@/lib/jnv/ai-context";

export type GenerateTeacherContentInput = {
  contentType: JnvTeacherContentKey;
  classLevel: number;
  subject: string;
  topic: string;
  count?: number | null;
  extraInstructions?: string | null;
  /** Base the content on an existing uploaded resource instead of a topic. */
  resourceId?: string | null;
};

export type GenerateTeacherContentResult =
  | { ok: true; content: string }
  | { ok: false; error: string };

/**
 * Buffered (non-streaming) generation for the Teacher AI Toolkit — the
 * admin flow is "generate once, then edit," so `generateText` fits better
 * here than the live chat's `streamText` (used by `lib/jnv/ai-chat.ts`).
 * Same Byte persona/provider, different orchestration for a different UX.
 */
export async function generateJnvTeacherContent(
  input: GenerateTeacherContentInput,
): Promise<GenerateTeacherContentResult> {
  if (!aiAvailable()) {
    return { ok: false, error: "Byte isn't configured on this server yet (no AI provider key set)." };
  }
  const model = getModel(DEFAULT_GROQ_MODEL);
  if (!model) return { ok: false, error: "Byte isn't configured on this server yet (no AI provider key set)." };

  const type = JNV_TEACHER_CONTENT_TYPES.find((t) => t.key === input.contentType);
  if (!type) return { ok: false, error: "Unknown content type." };

  let contextTitle: string | null = null;
  let contextText: string | null = null;
  if (input.resourceId) {
    const ctx = await buildJnvResourceContext(input.resourceId);
    if (ctx) {
      contextTitle = ctx.title;
      contextText = ctx.text;
    }
  }

  const system = buildJnvAssistantSystemPrompt({
    classLevel: input.classLevel,
    contextTitle,
    contextText,
  });

  const countLine = input.count ? ` Generate exactly ${input.count}.` : "";
  const topicLine = input.resourceId
    ? `based on the shared resource above (topic/subject also given for reference: ${input.subject} — ${input.topic})`
    : `on the topic "${input.topic}" (subject: ${input.subject})`;
  const extra = input.extraInstructions?.trim()
    ? `\n\nAdditional instructions from the teacher: ${input.extraInstructions.trim()}`
    : "";

  const prompt = `Generate the following for a Class ${input.classLevel} Computer Science class, ${topicLine}.

${type.instruction}${countLine}${extra}

Write only the finished content — no preamble like "Sure, here is..." and no closing remarks.`;

  try {
    const { text } = await generateText({
      model,
      system,
      prompt,
      temperature: 0.5,
      maxOutputTokens: 2200,
    });
    if (!text.trim()) {
      return { ok: false, error: "Byte couldn't generate a response. Please try again." };
    }
    return { ok: true, content: text.trim() };
  } catch (err) {
    console.error("[jnv] teacher content generation failed:", err);
    return { ok: false, error: "Something went wrong generating this. Please try again." };
  }
}
