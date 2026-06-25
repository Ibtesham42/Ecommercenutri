import { siteConfig } from "@/config/site";
import { formatPrice } from "@/lib/format";

type Email = { subject: string; html: string; text: string };

function shell(opts: {
  heading: string;
  intro: string;
  ctaLabel: string;
  ctaUrl: string;
  outro?: string;
}): string {
  const { heading, intro, ctaLabel, ctaUrl, outro } = opts;
  return `<!doctype html>
<html>
  <body style="margin:0;background:#f4f7f5;font-family:Arial,Helvetica,sans-serif;color:#1a2b22">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 0">
      <tr><td align="center">
        <table role="presentation" width="100%" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e3ece6">
          <tr><td style="background:#16803c;padding:20px 28px">
            <span style="color:#ffffff;font-size:20px;font-weight:800;letter-spacing:-0.5px">Nutri<span style="color:#c8f5d6">yet</span></span>
          </td></tr>
          <tr><td style="padding:28px">
            <h1 style="margin:0 0 12px;font-size:20px;color:#13241c">${heading}</h1>
            <p style="margin:0 0 20px;font-size:14px;line-height:22px;color:#48584f">${intro}</p>
            <a href="${ctaUrl}" style="display:inline-block;background:#16803c;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:10px;font-size:14px;font-weight:600">${ctaLabel}</a>
            <p style="margin:20px 0 0;font-size:12px;line-height:20px;color:#8a978f">${outro ?? "If the button doesn't work, copy and paste this link into your browser:"}<br><a href="${ctaUrl}" style="color:#16803c;word-break:break-all">${ctaUrl}</a></p>
          </td></tr>
          <tr><td style="padding:18px 28px;border-top:1px solid #eef3f0;font-size:12px;color:#9aa79f">
            © ${new Date().getFullYear()} ${siteConfig.name} · ${siteConfig.contact.email}
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

export function verificationEmail(url: string, name?: string | null): Email {
  return {
    subject: `Verify your email — ${siteConfig.name}`,
    html: shell({
      heading: `Welcome${name ? `, ${name}` : ""}! 🌿`,
      intro:
        "Thanks for joining Nutriyet. Please confirm your email address to secure your account.",
      ctaLabel: "Verify email",
      ctaUrl: url,
    }),
    text: `Welcome to Nutriyet! Verify your email: ${url}`,
  };
}

export function passwordResetEmail(url: string, name?: string | null): Email {
  return {
    subject: `Reset your password — ${siteConfig.name}`,
    html: shell({
      heading: "Reset your password",
      intro: `Hi${name ? ` ${name}` : ""}, we received a request to reset your Nutriyet password. This link expires in 1 hour. If you didn't request it, you can safely ignore this email.`,
      ctaLabel: "Reset password",
      ctaUrl: url,
    }),
    text: `Reset your Nutriyet password (expires in 1 hour): ${url}`,
  };
}

type OrderEmailData = {
  orderNumber: string;
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  user?: { name?: string | null } | null;
  items: { productName: string; variantLabel: string; quantity: number; price: number }[];
};

export function orderConfirmationEmail(order: OrderEmailData): Email {
  const url = `${siteConfig.url}/account/orders/${order.orderNumber}`;
  const rows = order.items
    .map(
      (i) =>
        `<tr><td style="padding:6px 0;font-size:13px;color:#48584f">${i.productName} <span style="color:#9aa79f">(${i.variantLabel}) × ${i.quantity}</span></td><td align="right" style="padding:6px 0;font-size:13px;color:#13241c;font-weight:600">${formatPrice(i.price * i.quantity)}</td></tr>`,
    )
    .join("");
  const summary = `
    <table role="presentation" width="100%" style="margin:16px 0;border-top:1px solid #eef3f0;border-bottom:1px solid #eef3f0;padding:8px 0">
      ${rows}
    </table>
    <table role="presentation" width="100%" style="font-size:13px;color:#48584f">
      <tr><td>Subtotal</td><td align="right">${formatPrice(order.subtotal)}</td></tr>
      ${order.discount > 0 ? `<tr><td>Discount</td><td align="right" style="color:#16803c">−${formatPrice(order.discount)}</td></tr>` : ""}
      <tr><td>Shipping</td><td align="right">${order.shipping === 0 ? "Free" : formatPrice(order.shipping)}</td></tr>
      <tr><td style="padding-top:8px;font-weight:700;color:#13241c">Total</td><td align="right" style="padding-top:8px;font-weight:700;color:#13241c">${formatPrice(order.total)}</td></tr>
    </table>`;

  return {
    subject: `Order confirmed #${order.orderNumber} — ${siteConfig.name}`,
    html: shell({
      heading: `Thanks for your order${order.user?.name ? `, ${order.user.name}` : ""}! 🌿`,
      intro: `We've received your order <strong>#${order.orderNumber}</strong> and it's now being processed.${summary}`,
      ctaLabel: "View your order",
      ctaUrl: url,
      outro: "We'll email you again when it ships.",
    }),
    text: `Order #${order.orderNumber} confirmed. Total ${formatPrice(order.total)}. View it: ${url}`,
  };
}
