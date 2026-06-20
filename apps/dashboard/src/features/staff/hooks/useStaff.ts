import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import type { EmployeeShift, StaffUser } from "@/types/domain";
import type {
  CreateStaffValues,
  ShiftValues,
  UpdateStaffValues,
} from "@/features/staff/schemas/create-staff.schema";

export function useStaff(hotelId: string) {
  return useQuery({
    queryKey: queryKeys.staff(hotelId),
    queryFn: () => apiGet<StaffUser[]>(`/hotels/${hotelId}/users`),
    enabled: Boolean(hotelId),
  });
}

export function useCreateStaff(hotelId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateStaffValues) => apiPost<StaffUser>(`/hotels/${hotelId}/users`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.staff(hotelId) }),
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
    mutationFn: ({ shiftId, payload }: { shiftId: string; payload: Partial<ShiftValues> }) =>
      apiPatch<EmployeeShift>(`/hotels/${hotelId}/shifts/${shiftId}`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.shifts(hotelId) }),
  });
}
