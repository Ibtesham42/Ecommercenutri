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
  invoiceNumber?: string;
  paymentMethod?: "RAZORPAY" | "COD";
  subtotal: number;
  discount: number;
  shipping: number;
  shippingSaved: number;
  codFee: number;
  tax: number;
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
      <tr><td>Delivery</td><td align="right"${order.shipping === 0 ? ' style="color:#16803c;font-weight:600"' : ""}>${order.shipping === 0 ? "Free Delivery" : formatPrice(order.shipping)}</td></tr>
      ${order.shipping === 0 && order.shippingSaved > 0 ? `<tr><td colspan="2" align="right" style="font-size:11px;color:#16803c">You saved ${formatPrice(order.shippingSaved)} on shipping</td></tr>` : ""}
      ${order.codFee > 0 ? `<tr><td>Cash on Delivery fee</td><td align="right">${formatPrice(order.codFee)}</td></tr>` : ""}
      <tr><td style="padding-top:8px;font-weight:700;color:#13241c">Total</td><td align="right" style="padding-top:8px;font-weight:700;color:#13241c">${formatPrice(order.total)}</td></tr>
      ${order.tax > 0 ? `<tr><td colspan="2" style="padding-top:4px;font-size:11px;color:#9aa79f">Inclusive of GST ${formatPrice(order.tax)}</td></tr>` : ""}
      ${order.paymentMethod === "COD" ? `<tr><td colspan="2" style="padding-top:4px;font-size:11px;color:#9aa79f">Payment: Cash on Delivery — pay ${formatPrice(order.total)} at delivery</td></tr>` : ""}
    </table>`;

  const invoiceNote = order.invoiceNumber
    ? `<p style="margin:16px 0 0;font-size:12px;color:#8a978f">Tax invoice <strong>${order.invoiceNumber}</strong> is attached to this email. You can also download it from your order page.</p>`
    : "";

  return {
    subject: `Order confirmed #${order.orderNumber} — ${siteConfig.name}`,
    html: shell({
      heading: `Thanks for your order${order.user?.name ? `, ${order.user.name}` : ""}! 🌿`,
      intro: `We've received your order <strong>#${order.orderNumber}</strong> and it's now being processed.${summary}${invoiceNote}`,
      ctaLabel: "View your order",
      ctaUrl: url,
      outro: "We'll email you again when it ships.",
    }),
    text: `Order #${order.orderNumber} confirmed. Total ${formatPrice(order.total)}. View it: ${url}`,
  };
}

type OrderStatus =
  | "PENDING"
  | "PAID"
  | "APPROVED"
  | "PROCESSING"
  | "PACKED"
  | "SHIPPED"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "CANCELLED"
  | "RETURNED"
  | "REFUNDED";

const STATUS_COPY: Partial<Record<OrderStatus, { heading: string; intro: string }>> = {
  APPROVED: {
    heading: "Your order is confirmed! ✅",
    intro: "Good news — we've approved your order and started preparing it.",
  },
  SHIPPED: {
    heading: "Your order is on its way! 📦",
    intro: "Good news — your order has shipped and is heading to you.",
  },
  OUT_FOR_DELIVERY: {
    heading: "Out for delivery! 🚚",
    intro: "Your order is out for delivery and should arrive today.",
  },
  DELIVERED: {
    heading: "Delivered — enjoy! 🌿",
    intro: "Your order has been delivered. We hope you love it!",
  },
  CANCELLED: {
    heading: "Your order was cancelled",
    intro:
      "Your order has been cancelled. If this was paid for, a refund has been initiated.",
  },
  RETURNED: {
    heading: "Your return is complete",
    intro: "We've processed the return for your order.",
  },
  REFUNDED: {
    heading: "Your refund is on the way",
    intro: "We've processed a refund for your order. It may take a few days to reflect.",
  },
};

/** Notification when an order's fulfillment status changes. Returns null for
 *  statuses that don't warrant a customer email (e.g. internal PROCESSING). */
export function orderStatusEmail(order: {
  orderNumber: string;
  status: OrderStatus;
  name?: string | null;
  reason?: string | null;
}): Email | null {
  const copy = STATUS_COPY[order.status];
  if (!copy) return null;
  const url = `${siteConfig.url}/account/orders/${order.orderNumber}`;
  const reasonLine =
    order.status === "CANCELLED" && order.reason
      ? ` Reason: <em>${order.reason}</em>.`
      : "";
  return {
    subject: `Order #${order.orderNumber} — ${order.status.replace(/_/g, " ").toLowerCase()} · ${siteConfig.name}`,
    html: shell({
      heading: copy.heading,
      intro: `Hi${order.name ? ` ${order.name}` : ""}, ${copy.intro} (Order <strong>#${order.orderNumber}</strong>.)${reasonLine}`,
      ctaLabel: "Track your order",
      ctaUrl: url,
    }),
    text: `Order #${order.orderNumber} is now ${order.status}. Track it: ${url}`,
  };
}

type ReturnStatusName =
  | "REQUESTED"
  | "UNDER_REVIEW"
  | "INFO_REQUESTED"
  | "APPROVED"
  | "REJECTED"
  | "PICKUP_SCHEDULED"
  | "ITEM_RECEIVED"
  | "REFUNDED"
  | "CANCELLED";

/** Customer notification when a return/refund request changes status. Returns null
 *  for statuses that don't warrant an email (e.g. internal ITEM_RECEIVED). */
export function returnStatusEmail(data: {
  returnNumber: string;
  orderNumber: string;
  status: ReturnStatusName;
  name?: string | null;
  reason?: string | null; // rejection reason / info request message
  amount?: number; // paise (REFUNDED)
  method?: string | null; // refund method (REFUNDED)
  pickupAt?: string | null; // ISO (PICKUP_SCHEDULED)
}): Email | null {
  const url = `${siteConfig.url}/account/returns/${data.returnNumber}`;
  const hi = `Hi${data.name ? ` ${data.name}` : ""},`;
  const ref = `return <strong>${data.returnNumber}</strong> (order #${data.orderNumber})`;

  const copy: Partial<Record<ReturnStatusName, { heading: string; intro: string }>> = {
    REQUESTED: {
      heading: "We've received your return request 📋",
      intro: `${hi} we've received your ${ref}. Our team will review it shortly.`,
    },
    UNDER_REVIEW: {
      heading: "Your return is under review 🔎",
      intro: `${hi} your ${ref} is now being reviewed by our team.`,
    },
    INFO_REQUESTED: {
      heading: "We need a little more information",
      intro: `${hi} to proceed with your ${ref}, we need more info.${data.reason ? ` <em>${data.reason}</em>` : ""}`,
    },
    APPROVED: {
      heading: "Your return is approved ✅",
      intro: `${hi} good news — your ${ref} has been approved. We'll process the refund shortly.`,
    },
    REJECTED: {
      heading: "About your return request",
      intro: `${hi} unfortunately your ${ref} could not be approved.${data.reason ? ` Reason: <em>${data.reason}</em>.` : ""}`,
    },
    PICKUP_SCHEDULED: {
      heading: "Pickup scheduled 🚚",
      intro: `${hi} a pickup has been scheduled for your ${ref}${data.pickupAt ? ` on <strong>${new Date(data.pickupAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}</strong>` : ""}. Please keep the item packed and ready.`,
    },
    REFUNDED: {
      heading: "Your refund is on the way 💸",
      intro: `${hi} we've processed a refund of <strong>${formatPrice(data.amount ?? 0)}</strong> for your ${ref}${data.method ? ` via ${data.method.replace(/_/g, " ").toLowerCase()}` : ""}. It may take a few days to reflect.`,
    },
  };

  const c = copy[data.status];
  if (!c) return null;
  return {
    subject: `Return ${data.returnNumber} — ${data.status.replace(/_/g, " ").toLowerCase()} · ${siteConfig.name}`,
    html: shell({ heading: c.heading, intro: c.intro, ctaLabel: "View your return", ctaUrl: url }),
    text: `Return ${data.returnNumber} for order #${data.orderNumber} is now ${data.status}. View it: ${url}`,
  };
}

// --- Affiliate program --------------------------------------------------------

const AFF_URL = `${siteConfig.url}/account/affiliate`;

/** Affiliate application status change (approved / rejected / suspended). */
export function affiliateStatusEmail(data: {
  status: "APPROVED" | "REJECTED" | "SUSPENDED";
  name?: string | null;
  code?: string | null;
  couponCode?: string | null;
  reason?: string | null;
}): Email | null {
  const hi = `Hi${data.name ? ` ${data.name}` : ""},`;
  const map: Record<string, { heading: string; intro: string }> = {
    APPROVED: {
      heading: "You're in — welcome to the Nutriyet Partner Program! 🎉",
      intro: `${hi} your affiliate application has been approved.${
        data.code ? ` Your referral link and${data.couponCode ? ` coupon <strong>${data.couponCode}</strong> are` : " QR code are"} ready in your dashboard.` : ""
      } Start sharing and earning.`,
    },
    REJECTED: {
      heading: "About your affiliate application",
      intro: `${hi} thanks for applying to the Nutriyet Partner Program. Unfortunately we couldn't approve your application at this time.${
        data.reason ? ` Reason: <em>${data.reason}</em>.` : ""
      }`,
    },
    SUSPENDED: {
      heading: "Your affiliate account has been suspended",
      intro: `${hi} your affiliate account has been suspended.${
        data.reason ? ` Reason: <em>${data.reason}</em>.` : ""
      } Please contact support if you think this is a mistake.`,
    },
  };
  const c = map[data.status];
  if (!c) return null;
  return {
    subject: `Affiliate ${data.status.toLowerCase()} · ${siteConfig.name}`,
    html: shell({ heading: c.heading, intro: c.intro, ctaLabel: "Open your dashboard", ctaUrl: AFF_URL }),
    text: `Your affiliate application is ${data.status}. ${AFF_URL}`,
  };
}

/** Commission earned / approved notification. */
export function commissionEmail(data: {
  name?: string | null;
  amount: number;
  kind: "earned" | "approved";
}): Email {
  const hi = `Hi${data.name ? ` ${data.name}` : ""},`;
  const heading = data.kind === "earned" ? "You earned a commission! 💸" : "Commission approved ✅";
  const intro =
    data.kind === "earned"
      ? `${hi} you earned <strong>${formatPrice(data.amount)}</strong> on a new referred order. It becomes payable after the order is delivered and the return window passes.`
      : `${hi} <strong>${formatPrice(data.amount)}</strong> of commission is now approved and available to withdraw.`;
  return {
    subject: `Commission ${data.kind} · ${siteConfig.name}`,
    html: shell({ heading, intro, ctaLabel: "View earnings", ctaUrl: AFF_URL }),
    text: `Commission ${data.kind}: ${formatPrice(data.amount)}. ${AFF_URL}`,
  };
}

/** Coupon used by a shopper. */
export function couponUsedEmail(data: { name?: string | null; code: string }): Email {
  const hi = `Hi${data.name ? ` ${data.name}` : ""},`;
  return {
    subject: `Your coupon ${data.code} was used · ${siteConfig.name}`,
    html: shell({
      heading: "Your coupon was just used 🎟️",
      intro: `${hi} someone used your coupon <strong>${data.code}</strong> on an order. Keep sharing!`,
      ctaLabel: "View your stats",
      ctaUrl: AFF_URL,
    }),
    text: `Your coupon ${data.code} was used. ${AFF_URL}`,
  };
}

/** Payout processed notification. */
export function payoutEmail(data: {
  name?: string | null;
  amount: number;
  method?: string | null;
  reference?: string | null;
}): Email {
  const hi = `Hi${data.name ? ` ${data.name}` : ""},`;
  return {
    subject: `Payout processed · ${siteConfig.name}`,
    html: shell({
      heading: "Your payout is on the way 🏦",
      intro: `${hi} we've processed your payout of <strong>${formatPrice(data.amount)}</strong>${
        data.method ? ` via ${data.method.replace(/_/g, " ").toLowerCase()}` : ""
      }${data.reference ? ` (ref ${data.reference})` : ""}.`,
      ctaLabel: "View payout history",
      ctaUrl: AFF_URL,
    }),
    text: `Payout of ${formatPrice(data.amount)} processed. ${AFF_URL}`,
  };
}
