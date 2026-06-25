import { z } from "zod";

export const profileSchema = z.object({
  name: z.string().min(2, "Name is too short").max(80),
  phone: z.string().max(20).optional(),
});

export const addressSchema = z.object({
  id: z.string().optional(),
  fullName: z.string().min(2, "Enter a name").max(80),
  phone: z.string().min(7, "Enter a valid phone").max(15),
  line1: z.string().min(3, "Enter an address").max(120),
  line2: z.string().max(120).optional(),
  city: z.string().min(2, "Enter a city").max(60),
  state: z.string().min(2, "Enter a state").max(60),
  pincode: z.string().regex(/^\d{6}$/, "Enter a valid 6-digit pincode"),
  type: z.enum(["HOME", "WORK", "OTHER"]).default("HOME"),
  isDefault: z.boolean().optional(),
});

export type ProfileInput = z.infer<typeof profileSchema>;
export type AddressInput = z.infer<typeof addressSchema>;
