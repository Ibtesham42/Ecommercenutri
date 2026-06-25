import { z } from "zod";

export const reviewSchema = z.object({
  productId: z.string().min(1),
  slug: z.string().min(1),
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().max(120).optional(),
  comment: z.string().max(2000).optional(),
});

export type ReviewInput = z.infer<typeof reviewSchema>;
