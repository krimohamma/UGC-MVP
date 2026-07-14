import { z } from "zod";
import { Constants } from "@/lib/database.types";

const PACKAGE_TIERS = Constants.public.Enums.package_tier; // ['basic','standard','premium']

// Whole dinars only — money is an integer count of DZD (CLAUDE.md), never a
// float. `.int()` rejects "3000.5"; the coercion handles the string coming off
// a number input.
const priceDzd = z
  .number({ message: "invalid_price" })
  .int({ message: "no_decimals" })
  .positive({ message: "invalid_price" })
  .max(10_000_000);

export const packageSchema = z.object({
  tier: z.enum(PACKAGE_TIERS),
  title: z.string().trim().min(2, { message: "required" }).max(120),
  description: z.string().trim().min(2, { message: "required" }).max(600),
  price_dzd: priceDzd,
  delivery_days: z.number().int().min(1).max(90),
  revisions_included: z.number().int().min(0).max(20),
  features: z.array(z.string().trim().min(1)).max(12),
});

export type PackageInput = z.infer<typeof packageSchema>;

export const gigSchema = z.object({
  title: z.string().trim().min(5, { message: "required" }).max(120),
  description: z.string().trim().min(20, { message: "too_short" }).max(3000),
  niche_id: z.string().uuid({ message: "niche_required" }),
  cover_media_url: z.string().trim().url().optional().or(z.literal("")),
  status: z.enum(Constants.public.Enums.gig_status),
  language_codes: z
    .array(z.string())
    .min(1, { message: "language_required" }),
  // Exactly three packages, one per tier, in canonical order.
  packages: z
    .array(packageSchema)
    .length(3, { message: "three_packages_required" })
    .refine(
      (pkgs) =>
        PACKAGE_TIERS.every((tier) => pkgs.some((p) => p.tier === tier)),
      { message: "one_package_per_tier" },
    ),
});

export type GigInput = z.infer<typeof gigSchema>;
