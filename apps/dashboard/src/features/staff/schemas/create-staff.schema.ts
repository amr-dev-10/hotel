import { z } from "zod";

export const staffLevelSchema = z.enum(["attendant", "supervisor", "manager", "admin"]);

export const createStaffSchema = z.object({
  name: z.string().min(2).max(255),
  email: z.string().email(),
  password: z.string().min(8),
  employee_code: z
    .string()
    .trim()
    .max(40)
    .regex(/^[A-Za-z0-9]*$/, "Use letters and numbers only")
    .optional(),
  department_id: z.string().optional(),
  reports_to: z.string().optional(),
  staff_level: staffLevelSchema.optional(),
  job_role: z.string().optional(),
  is_on_duty: z.boolean(),
});

export const updateStaffSchema = createStaffSchema.omit({ password: true }).extend({
  is_active: z.boolean().optional(),
});

export const shiftSchema = z.object({
  user_id: z.string().min(1),
  department_id: z.string().optional(),
  shift_date: z.string().min(1),
  shift_start: z.string().min(1),
  shift_end: z.string().min(1),
  shift_type: z.enum(["morning", "afternoon", "night", "custom"]),
  status: z.enum(["scheduled", "checked_in", "completed", "absent", "late", "on_leave"]),
  notes: z.string().optional(),
});

export type CreateStaffValues = z.infer<typeof createStaffSchema>;
export type UpdateStaffValues = z.infer<typeof updateStaffSchema>;
export type ShiftValues = z.infer<typeof shiftSchema>;
