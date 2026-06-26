"use server";

import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { contactSchema } from "@/lib/validations/contact";
import { checkRateLimit, limiters } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email";
import { getStoreSettings } from "@/lib/queries/settings";

export type ContactResult = { ok: true } | { ok: false; error: string };

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function clientId(): Promise<string> {
  const fwd = (await headers()).get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || "anon";
}

/** Persist a contact-form message and best-effort notify the store inbox. */
export async function submitContactMessage(input: unknown): Promise<ContactResult> {
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the form." };
  }
  const d = parsed.data;
  const subject = d.subject?.trim() || null;

  const rl = await checkRateLimit(limiters.api, `contact:${await clientId()}`);
  if (!rl.success) {
    return { ok: false, error: "Too many messages. Please try again in a minute." };
  }

  try {
    await prisma.contactMessage.create({
      data: { name: d.name, email: d.email, subject, message: d.message },
    });
  } catch (err) {
    console.error("[contact] persist failed:", err);
    return { ok: false, error: "Could not send your message. Please try again." };
  }

  // Best-effort inbox notification — never fail the submission on email trouble.
  try {
    const store = await getStoreSettings();
    await sendEmail({
      to: store.supportEmail,
      subject: `New contact message${subject ? `: ${subject}` : ""}`,
      html: `<p><strong>From:</strong> ${escapeHtml(d.name)} &lt;${escapeHtml(d.email)}&gt;</p>${
        subject ? `<p><strong>Subject:</strong> ${escapeHtml(subject)}</p>` : ""
      }<p>${escapeHtml(d.message).replace(/\n/g, "<br>")}</p>`,
      text: `From: ${d.name} <${d.email}>\n${subject ? `Subject: ${subject}\n` : ""}\n${d.message}`,
    });
  } catch (err) {
    console.error("[contact] notify failed:", err);
  }

  return { ok: true };
}
