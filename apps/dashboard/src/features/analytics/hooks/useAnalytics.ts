import { format, subDays } from "date-fns";
import { useQuery } from "@tanstack/react-query";

import { apiGet } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import type { AnalyticsSnapshot } from "@/types/domain";

export function defaultAnalyticsRange() {
  return {
    from: format(subDays(new Date(), 6), "yyyy-MM-dd"),
    to: format(new Date(), "yyyy-MM-dd"),
  };
}

export function useAnalytics(hotelId: string, range = defaultAnalyticsRange()) {
  return useQuery({
    queryKey: queryKeys.analytics(hotelId, range),
    queryFn: () =>
      apiGet<AnalyticsSnapshot[]>(`/hotels/${hotelId}/analytics`, {
        params: {
          from: range.from,
          to: range.to,
        },
      }),
    enabled: Boolean(hotelId),
  });
}
