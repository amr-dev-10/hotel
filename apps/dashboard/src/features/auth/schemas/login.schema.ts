import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().min(1, "Enter your email or employee code"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export type LoginValues = z.infer<typeof loginSchema>;
