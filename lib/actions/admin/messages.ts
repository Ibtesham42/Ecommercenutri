"use server";

import { revalidatePath } from "next/cache";
import { ContactStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { getStoreSettings } from "@/lib/queries/settings";
import type { AdminResult } from "@/lib/actions/admin/types";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Update a message's support status. */
export async function setMessageStatus(id: string, status: string): Promise<AdminResult> {
  await requirePermission("customers");
  if (!Object.values(ContactStatus).includes(status as ContactStatus)) {
    return { ok: false, error: "Invalid status." };
  }
  const s = status as ContactStatus;
  await prisma.contactMessage.update({
    where: { id },
    data: { status: s, handled: s !== ContactStatus.NEW },
  });
  revalidatePath("/admin/messages");
  return { ok: true };
}

/**
 * Reply to a contact message: send the email via the configured provider (SMTP),
 * store the reply in the conversation history (with the sending admin + delivery
 * result), and move the message to REPLIED. Returns whether the email delivered.
 */
export async function replyToMessage(
  messageId: string,
  body: string,
): Promise<AdminResult<{ delivered: boolean }>> {
  const admin = await requirePermission("customers");

  const text = body.trim();
  if (text.length < 2) return { ok: false, error: "Write a reply first." };
  if (text.length > 5000) return { ok: false, error: "Reply is too long." };

  const message = await prisma.contactMessage.findUnique({ where: { id: messageId } });
  if (!message) return { ok: false, error: "Message not found." };

  const store = await getStoreSettings();
  const subject = `Re: ${message.subject?.trim() || "Your enquiry with " + store.siteName}`;
  const html =
    `<div style="font-family:system-ui,sans-serif;font-size:14px;line-height:1.6;color:#1a2e22">` +
    `<p>Hi ${escapeHtml(message.name)},</p>` +
    `<div>${escapeHtml(text).replace(/\n/g, "<br>")}</div>` +
    `<p style="margin-top:20px">Warm regards,<br>${escapeHtml(store.siteName)} Support</p>` +
    `<hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0">` +
    `<p style="color:#6b7280;font-size:12px">On ${message.createdAt.toDateString()}, you wrote:</p>` +
    `<blockquote style="color:#6b7280;font-size:12px;border-left:3px solid #e5e7eb;padding-left:10px;margin:0">` +
    `${escapeHtml(message.message).replace(/\n/g, "<br>")}</blockquote></div>`;

  // Send email (best-effort) and record the delivery outcome.
  let delivered = false;
  let error: string | null = null;
  try {
    await sendEmail({
      to: message.email,
      subject,
      html,
      text,
      replyTo: store.supportEmail,
    });
    delivered = true;
  } catch (err) {
    error = err instanceof Error ? err.message : "Email failed to send";
    console.error("[messages] reply email failed:", err);
  }

  await prisma.$transaction([
    prisma.contactReply.create({
      data: {
        messageId,
        body: text,
        adminId: admin.id,
        adminName: admin.name,
        delivered,
        error,
      },
    }),
    prisma.contactMessage.update({
      where: { id: messageId },
      data: { status: ContactStatus.REPLIED, handled: true },
    }),
  ]);

  revalidatePath("/admin/messages");

  if (!delivered) {
    return {
      ok: false,
      error: `Reply saved, but email delivery failed: ${error ?? "unknown error"}.`,
    };
  }
  return { ok: true, data: { delivered } };
}

/** Delete a contact message (and its replies via cascade). */
export async function deleteContactMessage(id: string): Promise<AdminResult> {
  await requirePermission("customers");
  await prisma.contactMessage.delete({ where: { id } });
  revalidatePath("/admin/messages");
  return { ok: true };
}
