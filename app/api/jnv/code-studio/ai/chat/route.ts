import { NextResponse } from "next/server";
import { z } from "zod";
import { runCodeMentorStream } from "@/lib/jnv/code-studio/ai-chat";
import { checkRateLimit, limiters } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 45;

const bodySchema = z.object({
  language: z.enum(["html", "css", "javascript", "python"]),
  // The currently-open code, sent fresh on every request — never persisted
  // server-side, see lib/jnv/code-studio/ai-chat.ts.
  code: z.string().max(8000).nullish(),
  consoleOutput: z.string().max(2000).nullish(),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(4000),
      }),
    )
    .min(1)
    .max(40),
});

const FALLBACK = {
  unavailable:
    "The Code Mentor isn't configured yet on this server. Try again later, or keep experimenting on your own!",
  rate_limited: "You're asking a little too fast. Please wait a moment and try again.",
} as const;

function clientId(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "anonymous";
}

function fallbackResponse(message: string, status = 200) {
  return new Response(message, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "X-AI-Fallback": "1" },
  });
}

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { messages, language, code, consoleOutput } = parsed.data;

  const rl = await checkRateLimit(limiters.jnvCodeMentor, clientId(req));
  if (!rl.success) {
    return fallbackResponse(FALLBACK.rate_limited, 429);
  }

  const stream = await runCodeMentorStream({ messages, language, code, consoleOutput });
  if (!stream.ok) {
    return fallbackResponse(FALLBACK[stream.reason]);
  }

  return stream.result.toTextStreamResponse();
}
