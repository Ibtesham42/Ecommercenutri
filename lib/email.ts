import nodemailer, { type Transporter } from "nodemailer";
import { Resend } from "resend";
import { env, isConfigured } from "@/lib/env";
import { EMAIL_BRAND_MARKER, getEmailBrandHtml } from "@/lib/email-brand";

/**
 * Transactional email with a graceful provider chain:
 *   1. Custom SMTP (nodemailer) when SMTP_* is configured — the primary provider.
 *   2. Resend when RESEND_API_KEY is set.
 *   3. Console stub otherwise — the message (and any verification/reset link) is
 *      logged so local auth flows still work with no email provider.
 */
const resend = isConfigured.resend() ? new Resend(env.resendApiKey) : null;

let transporter: Transporter | null = null;
if (isConfigured.smtp()) {
  const port = Number(env.smtpPort) || 587;
  transporter = nodemailer.createTransport({
    host: env.smtpHost,
    port,
    // `secure` true = implicit TLS (465); false = STARTTLS (587/2525).
    secure: env.smtpSecure ? env.smtpSecure === "true" : port === 465,
    auth: { user: env.smtpUser, pass: env.smtpPass },
  });
}

type EmailAttachment = { filename: string; content: Buffer };

type SendEmailArgs = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  /** Address customer replies should go to (e.g. the support inbox). */
  replyTo?: string;
  /** Optional file attachments (e.g. the invoice PDF). */
  attachments?: EmailAttachment[];
};

export async function sendEmail({
  to,
  subject,
  html,
  text,
  replyTo,
  attachments,
}: SendEmailArgs) {
  const hasAttachments = !!attachments && attachments.length > 0;

  // Brand the email header with the admin-uploaded logo (or the wordmark fallback).
  // Best-effort: a failure here must never block the send.
  if (html.includes(EMAIL_BRAND_MARKER)) {
    try {
      const brand = await getEmailBrandHtml();
      html = html.split(EMAIL_BRAND_MARKER).join(brand);
    } catch {
      /* leave the marker out rather than fail the send */
      html = html.split(EMAIL_BRAND_MARKER).join("");
    }
  }

  if (transporter) {
    const info = await transporter.sendMail({
      from: env.emailFrom,
      to,
      subject,
      html,
      ...(text ? { text } : {}),
      ...(replyTo ? { replyTo } : {}),
      ...(hasAttachments ? { attachments } : {}),
    });
    return { id: info.messageId, stubbed: false as const };
  }

  if (resend) {
    const { data, error } = await resend.emails.send({
      from: env.emailFrom,
      to,
      subject,
      html,
      text: text ?? "",
      ...(replyTo ? { replyTo } : {}),
      ...(hasAttachments
        ? { attachments: attachments!.map((a) => ({ filename: a.filename, content: a.content })) }
        : {}),
    });
    if (error) throw new Error(error.message);
    return { id: data?.id ?? "", stubbed: false as const };
  }

  console.log(
    `\n──────── [email:stub] ────────\nTo: ${Array.isArray(to) ? to.join(", ") : to}\nSubject: ${subject}${hasAttachments ? `\nAttachments: ${attachments!.map((a) => a.filename).join(", ")}` : ""}\n\n${text ?? html}\n──────────────────────────────\n`,
  );
  return { id: "stubbed", stubbed: true as const };
}
