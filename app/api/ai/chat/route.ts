import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { runAssistantStream } from "@/lib/ai/chat";
import { recordAIUsage } from "@/lib/ai/settings";
import { persistChatTurn } from "@/lib/ai/history";
import { checkRateLimit, limiters } from "@/lib/rate-limit";

export const runtime = "nodejs"; // Prisma needs the Node runtime
export const maxDuration = 30;

const bodySchema = z.object({
  sessionId: z.string().min(1).max(80),
  productId: z.string().max(60).nullish(),
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
  disabled: "The AI assistant is currently turned off. Please check back soon.",
  unavailable:
    "The AI assistant isn't configured yet. Meanwhile, browse our products or email support@nutriyet.in and we'll gladly help.",
  not_found: "Sorry, I couldn't find that product. Please try another one.",
  rate_limited:
    "You're sending messages a little too fast. Please wait a moment and try again.",
} as const;

/** Best-effort client identifier for rate limiting (proxy-aware). */
function clientId(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "anonymous";
}

function fallbackResponse(message: string) {
  // Plain-text 200 so the client renders it exactly like a streamed answer.
  return new Response(message, {
    status: 200,
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
  const { messages, sessionId, productId } = parsed.data;

  // Rate limit per client (no-op when Upstash isn't configured).
  const rl = await checkRateLimit(limiters.ai, clientId(req));
  if (!rl.success) {
    return new Response(FALLBACK.rate_limited, {
      status: 429,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-AI-Fallback": "1",
        "Retry-After": "30",
      },
    });
  }

  const user = await getCurrentUser();
  const lastUser = [...messages].reverse().find((m) => m.role === "user");

  const stream = await runAssistantStream({
    messages,
    productId,
    onFinish: async (text, tokens) => {
      await recordAIUsage(tokens);
      if (user?.id && lastUser) {
        await persistChatTurn({
          userId: user.id,
          sessionId,
          productId,
          userText: lastUser.content,
          assistantText: text,
        });
      }
    },
  });

  if (!stream.ok) {
    return fallbackResponse(FALLBACK[stream.reason]);
  }

  return stream.result.toTextStreamResponse();
}
