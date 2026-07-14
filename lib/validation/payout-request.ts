import { z } from "zod";

// Whole dinars only, same integer-DZD rule as everywhere else in the app.
export const payoutRequestSchema = z.object({
  amount_dzd: z.coerce
    .number({ message: "invalidAmount" })
    .int({ message: "invalidAmount" })
    .positive({ message: "invalidAmount" }),
  payout_account_id: z.string().uuid({ message: "accountRequired" }),
});

export type PayoutRequestInput = z.infer<typeof payoutRequestSchema>;
