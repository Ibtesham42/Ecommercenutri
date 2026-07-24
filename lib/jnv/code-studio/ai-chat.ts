import { streamText, type ModelMessage } from "ai";
import { getModel, aiAvailable } from "@/lib/ai/provider";
import { DEFAULT_GROQ_MODEL } from "@/lib/groq";
import { buildCodeMentorSystemPrompt } from "@/lib/jnv/code-studio/ai-prompts";

export type CodeMentorMessage = { role: "user" | "assistant"; content: string };

export type CodeMentorStream =
  | { ok: true; result: ReturnType<typeof streamText> }
  | { ok: false; reason: "unavailable" };

/**
 * The Code Mentor's orchestration. Deliberately stateless server-side: the
 * full conversation and the current code both arrive in the request body
 * every turn and are used only to build this one response — nothing here
 * ever gets written to a database, file, or cache. When the browser tab
 * closes (or the request finishes), there is no trace of the conversation
 * left on the server.
 */
export async function runCodeMentorStream(opts: {
  messages: CodeMentorMessage[];
  language: string;
  code?: string | null;
  consoleOutput?: string | null;
}): Promise<CodeMentorStream> {
  if (!aiAvailable()) return { ok: false, reason: "unavailable" };

  const model = getModel(DEFAULT_GROQ_MODEL);
  if (!model) return { ok: false, reason: "unavailable" };

  const system = buildCodeMentorSystemPrompt({
    language: opts.language,
    code: opts.code,
    consoleOutput: opts.consoleOutput,
  });

  const result = streamText({
    model,
    system,
    messages: opts.messages as ModelMessage[],
    temperature: 0.4,
    maxOutputTokens: 1200,
  });

  return { ok: true, result };
}
