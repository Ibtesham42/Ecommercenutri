"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, limiters } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email";
import { newsletterWelcomeEmail } from "@/lib/emails";

const subscribeSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid email address"),
  source: z.string().max(40).optional(),
});

/**
 * Public newsletter signup (guests included — independent of User accounts).
 * Idempotent: an existing subscriber is simply re-activated, so the form can
 * always answer "you're on the list" without leaking whether the email was
 * already known.
 */
export async function subscribeToNewsletter(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = subscribeSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Enter a valid email address.",
    };
  }

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
  const rl = await checkRateLimit(limiters.api, `newsletter:${ip}`);
  if (!rl.success) {
    return { ok: false, error: "Too many attempts — please try again in a minute." };
  }

  const { email, source } = parsed.data;
  try {
    // Detect a genuinely new subscriber so the welcome email fires once — a
    // re-subscribe just reactivates the row silently.
    const existing = await prisma.newsletterSubscriber.findUnique({
      where: { email },
      select: { id: true },
    });
    await prisma.newsletterSubscriber.upsert({
      where: { email },
      update: { unsubscribedAt: null },
      create: { email, source: source ?? null },
    });

    if (!existing) {
      // Best-effort — a mail failure must never fail the subscription.
      try {
        const mail = newsletterWelcomeEmail();
        await sendEmail({ to: email, ...mail });
      } catch (err) {
        console.error("[newsletter] welcome email failed:", err);
      }
    }
    return { ok: true };
  } catch (err) {
    console.error("[newsletter] subscribe failed:", err);
    return { ok: false, error: "Could not subscribe right now. Please try again." };
  }
}
