import Razorpay from "razorpay";
import crypto from "node:crypto";
import { env, isConfigured } from "@/lib/env";

export const razorpayEnabled = isConfigured.razorpay();

/** Razorpay client; `null` when not configured (checkout uses a mock flow). */
export const razorpay = razorpayEnabled
  ? new Razorpay({
      key_id: env.razorpayKeyId,
      key_secret: env.razorpayKeySecret,
    })
  : null;

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  try {
    return crypto.timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

/** Verify the checkout handler signature: HMAC_SHA256(order_id|payment_id, secret). */
export function verifyPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string,
): boolean {
  if (!env.razorpayKeySecret) return false;
  const expected = crypto
    .createHmac("sha256", env.razorpayKeySecret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  return safeEqual(expected, signature);
}

/** Verify a Razorpay webhook payload signature. */
export function verifyWebhookSignature(body: string, signature: string): boolean {
  if (!env.razorpayWebhookSecret) return false;
  const expected = crypto
    .createHmac("sha256", env.razorpayWebhookSecret)
    .update(body)
    .digest("hex");
  return safeEqual(expected, signature);
}
