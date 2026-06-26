import nodemailer, { type Transporter } from "nodemailer";
import { Resend } from "resend";
import { env, isConfigured } from "@/lib/env";

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

type SendEmailArgs = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
};

export async function sendEmail({ to, subject, html, text }: SendEmailArgs) {
  if (transporter) {
    const info = await transporter.sendMail({
      from: env.emailFrom,
      to,
      subject,
      html,
      ...(text ? { text } : {}),
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
    });
    if (error) throw new Error(error.message);
    return { id: data?.id ?? "", stubbed: false as const };
  }

  console.log(
    `\n──────── [email:stub] ────────\nTo: ${Array.isArray(to) ? to.join(", ") : to}\nSubject: ${subject}\n\n${text ?? html}\n──────────────────────────────\n`,
  );
  return { id: "stubbed", stubbed: true as const };
}
