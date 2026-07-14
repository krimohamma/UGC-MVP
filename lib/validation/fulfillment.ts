import { z } from "zod";

export const sendMessageSchema = z.object({
  conversationId: z.string().uuid(),
  body: z.string().min(1, "Message cannot be empty").max(2000),
  attachmentUrl: z.string().url().optional().nullable(),
});

export const deliverOrderSchema = z.object({
  orderId: z.string().uuid(),
  fileUrl: z.string().min(1, "A deliverable file is required"),
  fileType: z.string().default("video"),
  note: z.string().max(1000).optional().nullable(),
});

export const reviewDeliverySchema = z.object({
  orderId: z.string().uuid(),
  action: z.enum(["accept", "revise", "dispute"]),
  note: z.string().max(1000).optional().nullable(),
}).superRefine((data, ctx) => {
  if ((data.action === "revise" || data.action === "dispute") && (!data.note || data.note.trim() === "")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "A note or reason is required for revisions and disputes.",
      path: ["note"],
    });
  }
});

export type SendMessageData = z.infer<typeof sendMessageSchema>;
export type DeliverOrderData = z.infer<typeof deliverOrderSchema>;
export type ReviewDeliveryData = z.infer<typeof reviewDeliverySchema>;
