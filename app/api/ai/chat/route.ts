import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { runAssistantStream } from "@/lib/ai/chat";
import { getGroundedRecommendations, wantsRecommendations } from "@/lib/ai/recommend";
import { RECO_MARKER } from "@/lib/ai/reco-types";
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
  const anonId = (await cookies()).get("nut_anon")?.value ?? null;
  const lastUser = [...messages].reverse().find((m) => m.role === "user");

  // Grounded product cards (live DB data only) — computed in parallel with the
  // LLM stream and appended after the text. General chat only, and only when
  // the message actually asks for something shoppable; never blocks the reply.
  const recoPromise =
    !productId && lastUser && wantsRecommendations(lastUser.content)
      ? getGroundedRecommendations({
          query: lastUser.content,
          userId: user?.id ?? null,
          anonId,
        })
      : null;

  const stream = await runAssistantStream({
    messages,
    productId,
    userId: user?.id ?? null,
    anonId,
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
    // Keyless philosophy: the reco engine is pure DB — when the model isn't
    // configured we can still answer a shoppable question with real products.
    if (stream.reason === "unavailable" && recoPromise) {
      const reco = await recoPromise;
      if (reco && reco.primary.length > 0) {
        const friendly =
          "Here's what we recommend from our store based on what you asked — every pick below is in stock right now.";
        return new Response(`${friendly}${RECO_MARKER}${JSON.stringify(reco)}`, {
          status: 200,
          headers: { "Content-Type": "text/plain; charset=utf-8", "X-AI-Fallback": "1" },
        });
      }
    }
    return fallbackResponse(FALLBACK[stream.reason]);
  }

  if (!recoPromise) {
    return stream.result.toTextStreamResponse();
  }

  // Pipe the model text through, then append the reco payload as a trailer the
  // client splits on RECO_MARKER. Card data never comes from the model.
  const encoder = new TextEncoder();
  const textStream = stream.result.textStream;
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of textStream) {
          controller.enqueue(encoder.encode(chunk));
        }
        const reco = await recoPromise;
        if (reco && (reco.primary.length > 0 || reco.crossSell.length > 0)) {
          controller.enqueue(encoder.encode(`${RECO_MARKER}${JSON.stringify(reco)}`));
        }
      } catch (err) {
        console.error("[ai] stream relay failed:", err);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
