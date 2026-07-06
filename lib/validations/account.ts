import { z } from "zod";

export const profileSchema = z.object({
  name: z.string().min(2, "Name is too short").max(80),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  dob: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date")
    .refine((v) => {
      const d = new Date(`${v}T00:00:00Z`);
      return !Number.isNaN(d.getTime()) && d < new Date() && d.getUTCFullYear() >= 1900;
    }, "Enter a valid date of birth")
    .optional(),
});

export const emailChangeSchema = z.object({
  email: z.string().email("Enter a valid email").max(120),
});

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().max(100).optional(),
    password: z.string().min(8, "Password must be at least 8 characters").max(100),
    confirm: z.string().max(100),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Passwords don't match",
    path: ["confirm"],
  });

export const avatarSchema = z
  .string()
  .max(300)
  .refine(
    (v) => v === "" || v.startsWith("https://res.cloudinary.com/"),
    "Invalid image URL",
  );

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
