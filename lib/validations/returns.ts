import { z } from "zod";

const mediaUrl = z.string().url();
const mediaList = z.array(mediaUrl).max(8).optional().default([]);

// --- Customer -----------------------------------------------------------------

export const requestReturnSchema = z.object({
  orderNumber: z.string().min(1),
  reason: z.string().min(1, "Please select a reason").max(120),
  description: z.string().max(1000).optional().default(""),
  media: mediaList,
  items: z
    .array(
      z.object({
        orderItemId: z.string().min(1),
        quantity: z.number().int().min(1),
      }),
    )
    .min(1, "Select at least one item to return"),
});
export type RequestReturnInput = z.infer<typeof requestReturnSchema>;

export const cancelReturnSchema = z.object({ returnNumber: z.string().min(1) });

export const submitReturnInfoSchema = z.object({
  returnNumber: z.string().min(1),
  message: z.string().min(1, "Add a message").max(1000),
  media: mediaList,
});

// --- Admin --------------------------------------------------------------------

export const returnIdSchema = z.object({ returnId: z.string().min(1) });

export const approveReturnSchema = z.object({
  returnId: z.string().min(1),
  note: z.string().max(300).optional().default(""),
});

export const rejectReturnSchema = z.object({
  returnId: z.string().min(1),
  reason: z.string().min(1, "Add a rejection reason").max(300),
});

export const requestInfoSchema = z.object({
  returnId: z.string().min(1),
  message: z.string().min(1, "Add a message for the customer").max(500),
});

export const schedulePickupSchema = z.object({
  returnId: z.string().min(1),
  pickupAt: z.string().min(1, "Pick a date"), // ISO datetime
  note: z.string().max(300).optional().default(""),
});

export const addNoteSchema = z.object({
  returnId: z.string().min(1),
  note: z.string().min(1, "Add a note").max(1000),
});

export const REFUND_METHODS = ["ORIGINAL", "UPI", "BANK_TRANSFER", "STORE_CREDIT", "OTHER"] as const;

export const processRefundSchema = z.object({
  returnId: z.string().min(1),
  amount: z.number().int().min(1, "Enter a refund amount"), // paise
  method: z.enum(REFUND_METHODS),
  reference: z.string().max(120).optional().default(""),
});
