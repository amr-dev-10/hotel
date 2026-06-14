import { z } from "zod";

export const createStaffSchema = z.object({
  name: z.string().min(2).max(255),
  email: z.string().email(),
  password: z.string().min(8),
  department_id: z.string().optional(),
  reports_to: z.string().optional(),
  staff_level: z.enum(["attendant", "supervisor", "manager"]).optional(),
  job_role: z.string().optional(),
  is_on_duty: z.boolean(),
});

export type CreateStaffValues = z.infer<typeof createStaffSchema>;
