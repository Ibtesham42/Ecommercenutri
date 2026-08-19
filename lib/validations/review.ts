import { z } from "zod";

export const MAX_REVIEW_PHOTOS = 5;

export const reviewSchema = z.object({
  productId: z.string().min(1),
  slug: z.string().min(1),
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().max(120).optional(),
  comment: z.string().max(2000).optional(),
  images: z.array(z.string().url()).max(MAX_REVIEW_PHOTOS).optional().default([]),
});

export type ReviewInput = z.infer<typeof reviewSchema>;
