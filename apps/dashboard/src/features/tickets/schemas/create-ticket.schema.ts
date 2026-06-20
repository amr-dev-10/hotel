import { z } from "zod";

export const createTicketSchema = z.object({
  guest_id: z.string().optional(),
  reservation_id: z.string().optional(),
  conversation_id: z.string().optional(),
  department_key: z.enum(["front_office", "housekeeping", "engineering", "food_beverage"]),
  room_id: z.string().optional(),
  type: z.enum(["Ticket", "Complaint", "Food Order"]),
  task_category: z.string().optional(),
  source: z.string().optional(),
  priority: z.number().min(1).max(5),
  item_description: z.string().min(2, "Description is required").max(255),
});

export type CreateTicketValues = z.infer<typeof createTicketSchema>;
