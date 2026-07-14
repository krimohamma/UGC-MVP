import { z } from "zod";

export const reviewSchema = z.object({
  orderId: z.string().uuid(),
  rating: z.coerce.number().int().min(1, { message: "ratingRequired" }).max(5),
  comment: z.string().trim().max(1000).optional(),
});

export type ReviewInput = z.infer<typeof reviewSchema>;
