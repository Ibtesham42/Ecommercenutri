import { z } from "zod";

export const contactSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(80),
  email: z.string().trim().email("Enter a valid email"),
  subject: z.string().trim().max(120).optional().or(z.literal("")),
  message: z
    .string()
    .trim()
    .min(10, "Please add a little more detail")
    .max(2000, "Message is too long"),
});

export type ContactInput = z.infer<typeof contactSchema>;

export const trackOrderSchema = z.object({
  orderNumber: z
    .string()
    .trim()
    .min(3, "Enter your order number")
    .max(40)
    .transform((v) => v.toUpperCase()),
  email: z.string().trim().email("Enter the email used at checkout"),
});

export type TrackOrderInput = z.infer<typeof trackOrderSchema>;
