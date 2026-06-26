import { useQuery } from "@tanstack/react-query";

import { apiGet } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import type { Department } from "@/types/domain";

export function useDepartments(hotelId: string) {
  return useQuery({
    queryKey: queryKeys.departments(hotelId),
    queryFn: () => apiGet<Department[]>(`/hotels/${hotelId}/departments`),
    enabled: Boolean(hotelId),
  });
}
