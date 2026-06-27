import { z } from "zod";

/** A single line a client asks us to purchase. We re-price everything on the
 *  server from the database — the client only tells us *what* and *how many*. */
export const checkoutItemSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.number().int().min(1).max(99),
});

export const createOrderSchema = z.object({
  items: z.array(checkoutItemSchema).min(1, "Your cart is empty."),
  addressId: z.string().min(1, "Select a delivery address."),
  couponCode: z.string().trim().max(40).optional(),
  notes: z.string().trim().max(500).optional(),
});

export const applyCouponSchema = z.object({
  code: z.string().trim().min(1, "Enter a coupon code.").max(40),
  items: z.array(checkoutItemSchema).min(1),
});

/** Live, server-authoritative cart/checkout pricing preview. */
export const previewPricingSchema = z.object({
  items: z.array(checkoutItemSchema).min(1),
  couponCode: z.string().trim().max(40).optional(),
});

export const verifyPaymentSchema = z.object({
  orderId: z.string().min(1),
  razorpayOrderId: z.string().min(1),
  razorpayPaymentId: z.string().min(1),
  razorpaySignature: z.string().min(1),
});

export type CheckoutItem = z.infer<typeof checkoutItemSchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type VerifyPaymentInput = z.infer<typeof verifyPaymentSchema>;
