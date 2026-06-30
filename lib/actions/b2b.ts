"use server";

import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { b2bInquirySchema } from "@/lib/validations/b2b";
import { checkRateLimit, limiters } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email";
import { getStoreSettings } from "@/lib/queries/settings";
import { b2bConfirmationEmail, b2bAdminAlertEmail } from "@/lib/emails";
import { notifyAdmins } from "@/lib/notifications";

export type B2BResult = { ok: true } | { ok: false; error: string };

async function clientId(): Promise<string> {
  const fwd = (await headers()).get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || "anon";
}

/**
 * Public B2B business-inquiry submission. Server-validated + rate-limited +
 * honeypot + duplicate-guarded; persists the inquiry, emails the buyer a
 * branded confirmation, and alerts the admin team (email + in-app bell).
 */
export async function submitB2BInquiry(input: unknown): Promise<B2BResult> {
  const parsed = b2bInquirySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the form." };
  }
  const d = parsed.data;

  // Honeypot — a filled hidden field means a bot. Accept silently (don't reveal).
  if (d.website) return { ok: true };

  const rl = await checkRateLimit(limiters.api, `b2b:${await clientId()}`);
  if (!rl.success) {
    return { ok: false, error: "Too many requests. Please try again in a minute." };
  }

  // Duplicate guard — same email + message within 10 minutes is a re-submit.
  try {
    const dupe = await prisma.b2BInquiry.findFirst({
      where: {
        email: d.email,
        message: d.message,
        createdAt: { gt: new Date(Date.now() - 10 * 60 * 1000) },
      },
      select: { id: true },
    });
    if (dupe) return { ok: true };
  } catch {
    /* non-fatal — fall through to create */
  }

  try {
    await prisma.b2BInquiry.create({
      data: {
        fullName: d.fullName,
        companyName: d.companyName || null,
        businessType: d.businessType,
        phone: d.phone,
        email: d.email,
        city: d.city || null,
        state: d.state || null,
        country: d.country || null,
        purpose: d.purpose,
        message: d.message,
      },
    });
  } catch (err) {
    console.error("[b2b] persist failed:", err);
    return { ok: false, error: "Could not submit your inquiry. Please try again." };
  }

  // Buyer confirmation — best-effort (never fail the submission on email trouble).
  try {
    const store = await getStoreSettings();
    const email = b2bConfirmationEmail(d.fullName);
    await sendEmail({ to: d.email, ...email, replyTo: store.supportEmail });
  } catch (err) {
    console.error("[b2b] confirmation email failed:", err);
  }

  // Admin alert — email + in-app notification.
  try {
    const store = await getStoreSettings();
    const alert = b2bAdminAlertEmail(d);
    await sendEmail({ to: store.supportEmail, ...alert, replyTo: d.email });
    await notifyAdmins({
      title: "New B2B inquiry",
      body: `${d.fullName}${d.companyName ? ` · ${d.companyName}` : ""} — ${d.purpose}`,
      link: "/admin/b2b",
    });
  } catch (err) {
    console.error("[b2b] admin alert failed:", err);
  }

  return { ok: true };
}
