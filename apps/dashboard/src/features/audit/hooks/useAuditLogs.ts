import { useQuery } from "@tanstack/react-query";

import { apiGet } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import type { AuditLog } from "@/types/domain";

export interface AuditLogFilters {
  search?: string;
  action?: string;
  entity?: string;
  user_id?: string;
  limit?: number;
}

export function useAuditLogs(hotelId: string, filters: AuditLogFilters = {}, enabled = true) {
  const params = Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== undefined && value !== ""),
  ) as Record<string, string | number>;

  return useQuery({
    queryKey: queryKeys.auditLogs(hotelId, params),
    queryFn: () => apiGet<AuditLog[]>(`/hotels/${hotelId}/audit-logs`, { params }),
    enabled: Boolean(hotelId) && enabled,
  });
}
