import { z } from "zod";
import { BUSINESS_TYPES, B2B_PURPOSES } from "@/lib/b2b";

const optText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

export const b2bInquirySchema = z.object({
  fullName: z.string().trim().min(2, "Please enter your full name").max(100),
  companyName: optText(120),
  businessType: z.enum(BUSINESS_TYPES, { message: "Select a business type" }),
  phone: z
    .string()
    .trim()
    .min(7, "Enter a valid mobile number")
    .max(20)
    .regex(/^[0-9+\-\s()]+$/, "Enter a valid mobile number"),
  email: z.string().trim().email("Enter a valid email"),
  city: optText(80),
  state: optText(80),
  country: optText(80),
  purpose: z.enum(B2B_PURPOSES, { message: "Select a purpose" }),
  message: z
    .string()
    .trim()
    .min(10, "Please add a little more detail")
    .max(2000, "Message is too long"),
  // Honeypot — real users never see/fill this; bots do.
  website: z.string().max(0).optional().or(z.literal("")),
});

export type B2BInquiryInput = z.infer<typeof b2bInquirySchema>;
