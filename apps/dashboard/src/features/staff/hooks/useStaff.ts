import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import type { EmployeeShift, StaffUser } from "@/types/domain";
import type {
  CreateStaffValues,
  ResetStaffPasswordValues,
  ShiftValues,
  UpdateStaffValues,
} from "@/features/staff/schemas/create-staff.schema";

export type ShiftUpdatePayload = {
  status?: "scheduled" | "checked_in" | "completed" | "absent" | "late" | "on_leave";
  actual_start?: string | null;
  actual_end?: string | null;
  notes?: string | null;
};

export type StaffQueryOptions = {
  enabled?: boolean;
  limit?: number;
  q?: string;
};

export type EmployeeCodeGeneratePayload = {
  staff_level?: string | null;
  job_role?: string | null;
};

export type EmployeeCodeGenerateResponse = {
  employee_code: string;
};

export function useStaff(hotelId: string, options: StaffQueryOptions = {}) {
  const limit = options.limit ?? 200;
  const q = options.q?.trim() || undefined;

  return useQuery({
    queryKey: queryKeys.staff(hotelId, { limit, q }),
    queryFn: () => apiGet<StaffUser[]>(`/hotels/${hotelId}/users`, { params: { limit, q } }),
    enabled: Boolean(hotelId) && (options.enabled ?? true),
  });
}

export function useCreateStaff(hotelId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateStaffValues) => apiPost<StaffUser>(`/hotels/${hotelId}/users`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.staff(hotelId) }),
  });
}

export function useGenerateEmployeeCode(hotelId: string) {
  return useMutation({
    mutationFn: (payload: EmployeeCodeGeneratePayload) =>
      apiPost<EmployeeCodeGenerateResponse>(`/hotels/${hotelId}/users/employee-code/generate`, payload),
  });
}

export function useUpdateStaff(hotelId: string, staffId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpdateStaffValues) =>
      apiPatch<StaffUser>(`/hotels/${hotelId}/users/${staffId}`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.staff(hotelId) }),
  });
}

export function useResetStaffPassword(hotelId: string, staffId: string) {
  return useMutation({
    mutationFn: (payload: ResetStaffPasswordValues) =>
      apiPost<{ password_changed: boolean }>(`/hotels/${hotelId}/users/${staffId}/password`, payload),
  });
}

export function useDeleteStaff(hotelId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (staffId: string) =>
      apiDelete<{ deleted: boolean; user_id: string }>(`/hotels/${hotelId}/users/${staffId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.staff(hotelId) }),
  });
}

export function useShifts(hotelId: string) {
  return useQuery({
    queryKey: queryKeys.shifts(hotelId),
    queryFn: () => apiGet<EmployeeShift[]>(`/hotels/${hotelId}/shifts`),
    enabled: Boolean(hotelId),
  });
}

export function useCreateShift(hotelId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: ShiftValues) => apiPost<EmployeeShift>(`/hotels/${hotelId}/shifts`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.shifts(hotelId) }),
  });
}

export function useUpdateShift(hotelId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ shiftId, payload }: { shiftId: string; payload: ShiftUpdatePayload }) =>
      apiPatch<EmployeeShift>(`/hotels/${hotelId}/shifts/${shiftId}`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.shifts(hotelId) }),
  });
}
