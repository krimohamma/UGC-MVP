import { z } from "zod";

// Supabase Auth's own default minimum is 6 characters — too weak. Enforce 8
// here so it's checked server-side regardless of what a client sends,
// independent of the project's Auth settings.
export const emailSchema = z.string().trim().email({ message: "invalidEmail" });
export const passwordSchema = z.string().min(8, { message: "passwordTooShort" });

export const signupSchema = z.object({
  fullName: z.string().trim().min(2, { message: "required" }),
  email: emailSchema,
  password: passwordSchema,
  role: z.enum(["creator", "brand"], { message: "invalidRole" }),
});

export type SignupInput = z.infer<typeof signupSchema>;
