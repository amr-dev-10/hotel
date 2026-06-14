import { z } from "zod";

export const createRoomSchema = z.object({
  room_number: z.string().min(1).max(40),
  room_type: z.string().optional(),
  floor: z.string().optional(),
  status: z.enum(["available", "occupied", "dirty", "maintenance", "blocked"]),
  notes: z.string().optional(),
});

export type CreateRoomValues = z.infer<typeof createRoomSchema>;
