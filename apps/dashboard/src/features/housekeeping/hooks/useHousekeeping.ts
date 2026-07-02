import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiGet, apiPost, apiPut } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import type { HousekeepingTask } from "@/types/domain";
import type {
  CreateHousekeepingValues,
  UpdateHousekeepingValues,
} from "@/features/housekeeping/schemas/housekeeping.schema";

export function useHousekeeping(hotelId: string) {
  return useQuery({
    queryKey: queryKeys.housekeeping(hotelId),
    queryFn: () => apiGet<HousekeepingTask[]>(`/hotels/${hotelId}/housekeeping`),
    enabled: Boolean(hotelId),
  });
}

export function useCreateHousekeeping(hotelId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateHousekeepingValues) =>
      apiPost<HousekeepingTask>(`/hotels/${hotelId}/housekeeping`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.housekeeping(hotelId) }),
  });
}

export function useUpdateHousekeeping(hotelId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, payload }: { taskId: string; payload: UpdateHousekeepingValues }) =>
      apiPut<HousekeepingTask>(`/hotels/${hotelId}/housekeeping/${taskId}`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.housekeeping(hotelId) }),
  });
}
