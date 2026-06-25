import { Resend } from "resend";
import { env, isConfigured } from "@/lib/env";

const resend = isConfigured.resend() ? new Resend(env.resendApiKey) : null;

type SendEmailArgs = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
};

/**
 * Send a transactional email. Without a Resend key, the message (and any
 * verification/reset link inside it) is logged to the server console so local
 * auth flows still work.
 */
export async function sendEmail({ to, subject, html, text }: SendEmailArgs) {
  if (!resend) {
    console.log(
      `\n──────── [email:stub] ────────\nTo: ${Array.isArray(to) ? to.join(", ") : to}\nSubject: ${subject}\n\n${text ?? html}\n──────────────────────────────\n`,
    );
    return { id: "stubbed", stubbed: true as const };
  }
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
