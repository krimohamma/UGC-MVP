import { z } from "zod";

export const createOrderSchema = z.object({
  gigId: z.string().uuid(),
  packageId: z.string().uuid(),
  requirements: z.string().max(2000).optional(),
});

export const submitPaymentSchema = z.object({
  orderId: z.string().uuid(),
  paymentMethod: z.enum(["ccp", "baridimob"]),
  referenceNumber: z.string().max(255).optional(),
});
