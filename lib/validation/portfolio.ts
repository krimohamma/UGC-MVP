import { z } from "zod";

/**
 * A portfolio item is EITHER an uploaded video (with optional thumbnail) OR an
 * external TikTok/Instagram link — never both, never neither. This mirrors the
 * `portfolio_items_has_a_source` check constraint in 0003, but tightens "at
 * least one" to "exactly one" so the form has a single clear mode.
 */
export const portfolioItemSchema = z
  .object({
    title: z.string().trim().max(200).optional().or(z.literal("")),
    video_url: z.string().trim().url().optional().or(z.literal("")),
    thumbnail_url: z.string().trim().url().optional().or(z.literal("")),
    external_url: z.string().trim().url().optional().or(z.literal("")),
  })
  .superRefine((val, ctx) => {
    const hasUpload = Boolean(val.video_url);
    const hasExternal = Boolean(val.external_url);
    if (hasUpload === hasExternal) {
      // both set, or neither set
      ctx.addIssue({
        code: "custom",
        message: "one_source_required",
        path: ["external_url"],
      });
    }
    if (val.thumbnail_url && !hasUpload) {
      ctx.addIssue({
        code: "custom",
        message: "thumbnail_needs_upload",
        path: ["thumbnail_url"],
      });
    }
  });

export type PortfolioItemInput = z.infer<typeof portfolioItemSchema>;
