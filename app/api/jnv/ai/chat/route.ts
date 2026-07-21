import { NextResponse } from "next/server";
import { z } from "zod";
import { runJnvAssistantStream } from "@/lib/jnv/ai-chat";
import { buildJnvResourceContext } from "@/lib/jnv/ai-context";
import { checkRateLimit, limiters } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 45;

const bodySchema = z.object({
  classLevel: z.number().int().min(6).max(10).nullish(),
  /** When set, resolved server-side into title/description/extracted-text
   *  context — the client only ever sends the id, never raw file content. */
  resourceId: z.string().max(60).nullish(),
  contextTitle: z.string().max(200).nullish(),
  contextText: z.string().max(8000).nullish(),
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
    "Byte isn't configured yet on this server. Ask your teacher to check back soon, or browse the resources directly.",
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
  const { messages, resourceId } = parsed.data;
  let classLevel = parsed.data.classLevel;
  let contextTitle = parsed.data.contextTitle;
  let contextText = parsed.data.contextText;

  const rl = await checkRateLimit(limiters.jnvAi, clientId(req));
  if (!rl.success) {
    return fallbackResponse(FALLBACK.rate_limited, 429);
  }

  if (resourceId) {
    const resourceContext = await buildJnvResourceContext(resourceId);
    if (resourceContext) {
      contextTitle = resourceContext.title;
      contextText = resourceContext.text;
      classLevel = classLevel ?? resourceContext.classLevel;
    }
  }

  const stream = await runJnvAssistantStream({ messages, classLevel, contextTitle, contextText });
  if (!stream.ok) {
    return fallbackResponse(FALLBACK[stream.reason]);
  }

  return stream.result.toTextStreamResponse();
}
