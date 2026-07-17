import { z } from "zod";

export const shiftTemplateSchema = z.object({
  name: z.string().min(1).max(120),
  code: z.string().min(1).max(40),
  start_time: z.string().min(1),
  end_time: z.string().min(1),
  break_minutes: z.number().int().min(0).max(240),
  grace_minutes: z.number().int().min(0).max(180),
  late_after_minutes: z.number().int().min(0).max(180),
  is_night_shift: z.boolean(),
  is_active: z.boolean(),
});

export const shiftAssignmentSchema = z.object({
  employee_id: z.string().min(1),
  shift_template_id: z.string().min(1),
  effective_from: z.string().min(1),
  effective_to: z.string().optional(),
  working_days: z.array(z.number().int().min(0).max(6)).min(1),
  rotation_type: z.string().min(1).max(40),
  is_active: z.boolean(),
});

export type ShiftTemplateValues = z.infer<typeof shiftTemplateSchema>;
export type ShiftAssignmentValues = z.infer<typeof shiftAssignmentSchema>;
