import { z } from "zod";

export const createHousekeepingSchema = z.object({
  room_id: z.string().min(1),
  assigned_to: z.string().optional(),
  task_type: z.string().min(2),
  scheduled_date: z.string().min(1),
  scheduled_time: z.string().optional(),
  status: z.enum(["pending", "assigned", "in_progress", "completed", "blocked"]),
  priority: z.number().min(1).max(5),
  notes: z.string().optional(),
});

export const updateHousekeepingSchema = createHousekeepingSchema.partial();

export type CreateHousekeepingValues = z.infer<typeof createHousekeepingSchema>;
export type UpdateHousekeepingValues = z.infer<typeof updateHousekeepingSchema>;
