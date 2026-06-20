import { z } from "zod";

export const createReservationSchema = z
  .object({
    guest_name: z.string().min(2).max(255),
    phone: z.string().optional(),
    whatsapp_phone: z.string().optional(),
    room_id: z.string().optional(),
    room_type_id: z.string().optional(),
    checkin_date: z.string().min(1),
    checkout_date: z.string().min(1),
    source: z.string().min(1),
    notes: z.string().optional(),
    guests: z
      .array(
        z.object({
          guest_id: z.string().min(1),
          is_primary: z.boolean().optional(),
          relationship: z.string().optional(),
        }),
      )
      .optional(),
  })
  .refine((values) => new Date(values.checkout_date) > new Date(values.checkin_date), {
    message: "Checkout must be after check-in",
    path: ["checkout_date"],
  });

export type CreateReservationValues = z.infer<typeof createReservationSchema>;
