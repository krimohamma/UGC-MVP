import { z } from "zod";
import { Constants } from "@/lib/database.types";

export const creatorProfileSchema = z.object({
  bio: z.string().trim().max(1000).optional().or(z.literal("")),
  niche_id: z.string().uuid({ message: "niche_required" }),
  years_experience: z
    .number({ message: "invalid_number" })
    .int()
    .min(0)
    .max(60)
    .optional(),
});

export type CreatorProfileInput = z.infer<typeof creatorProfileSchema>;

export const payoutAccountSchema = z.object({
  method: z.enum(Constants.public.Enums.payout_method),
  account_holder_name: z.string().trim().min(2, { message: "required" }).max(120),
  // CCP account number / BaridiMob RIP — kept as free text (digits/spaces).
  account_number: z
    .string()
    .trim()
    .min(4, { message: "required" })
    .max(40)
    .regex(/^[0-9 ]+$/, { message: "digits_only" }),
});

export type PayoutAccountInput = z.infer<typeof payoutAccountSchema>;
