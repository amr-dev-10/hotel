import { z } from "zod";

export const createGuestSchema = z
  .object({
    name: z.string().min(2).max(255),
    phone: z.string().optional(),
    whatsapp_phone: z.string().optional(),
    email: z.string().email().optional().or(z.literal("")),
    check_in_date: z.string().optional(),
    check_out_date: z.string().optional(),
    status: z.string().min(1),
  })
  .refine(
    (values) =>
      !values.check_in_date ||
      !values.check_out_date ||
      new Date(values.check_out_date) >= new Date(values.check_in_date),
    {
      message: "Check-out must be on or after check-in",
      path: ["check_out_date"],
    },
  );

export type CreateGuestValues = z.infer<typeof createGuestSchema>;
