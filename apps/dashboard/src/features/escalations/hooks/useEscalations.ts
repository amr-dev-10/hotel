import { useQuery } from "@tanstack/react-query";

import { apiGet } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import type { EscalatedTicket } from "@/types/domain";

export function useEscalatedTickets(hotelId: string, scope: string) {
  return useQuery({
    queryKey: queryKeys.tickets.escalatedTickets(hotelId, scope),
    queryFn: () =>
      apiGet<EscalatedTicket[]>(`/hotels/${hotelId}/tickets/escalations`, {
        params: { scope },
      }),
    enabled: Boolean(hotelId),
    refetchInterval: 15000,
  });
}
