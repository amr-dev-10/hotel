import { useQuery } from "@tanstack/react-query";

import { apiGet } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import type { DepartmentHierarchy } from "@/types/domain";

export function useDepartmentHierarchy(hotelId: string, departmentId: string) {
  return useQuery({
    queryKey: queryKeys.hierarchy(hotelId, departmentId),
    queryFn: () => apiGet<DepartmentHierarchy>(`/hotels/${hotelId}/departments/${departmentId}/hierarchy`),
    enabled: Boolean(hotelId && departmentId),
  });
}
