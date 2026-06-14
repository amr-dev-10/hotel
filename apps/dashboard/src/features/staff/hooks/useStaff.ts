import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiGet, apiPost } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import type { StaffUser } from "@/types/domain";
import type { CreateStaffValues } from "@/features/staff/schemas/create-staff.schema";

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
