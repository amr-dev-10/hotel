import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiGet, apiGetEnvelope, apiPatch, apiPost } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import type {
  ApiEnvelope,
  CursorPageMeta,
  EscalationLog,
  Ticket,
  TicketAcceptance,
  TicketMessage,
  TicketTimelineItem,
  WhatsAppMessage,
} from "@/types/domain";
import type { CreateTicketValues } from "@/features/tickets/schemas/create-ticket.schema";

type TicketFilters = Record<string, string | undefined>;

export type TicketUpdatePayload = {
  guest_id?: string | null;
  reservation_id?: string | null;
  conversation_id?: string | null;
  room_id?: string | null;
  department_id?: string | null;
  department_key?: string | null;
  assigned_to?: string | null;
  type?: string;
  task_category?: string | null;
  item_description?: string;
  source?: string;
  followers?: string[];
  priority?: number;
};

export function useTickets(hotelId: string, filters: TicketFilters) {
  const limit = Number(filters.limit ?? 100);
  const query = useInfiniteQuery<ApiEnvelope<Ticket[]>, Error>({
    queryKey: queryKeys.tickets.list(hotelId, compactFilters({ ...filters, limit: String(limit) })),
    queryFn: ({ pageParam }) =>
      apiGetEnvelope<Ticket[]>(`/hotels/${hotelId}/tickets`, {
        params: compactFilters({ ...filters, limit: String(limit), cursor: pageParam as string | undefined }),
      }),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => {
      const meta = lastPage.meta as CursorPageMeta | null | undefined;
      return meta?.has_more ? meta.next_cursor : undefined;
    },
    enabled: Boolean(hotelId),
  });

  return {
    ...query,
    data: query.data?.pages.flatMap((page) => page.data) ?? [],
    pageMeta: query.data?.pages.at(-1)?.meta as CursorPageMeta | null | undefined,
  };
}

export function useTicket(hotelId: string, ticketId: string) {
  return useQuery({
    queryKey: ["tickets", hotelId, ticketId],
    queryFn: () => apiGet<Ticket>(`/hotels/${hotelId}/tickets/${ticketId}`),
    enabled: Boolean(hotelId && ticketId),
  });
}

export function useTicketAcceptances(hotelId: string, ticketId: string | null) {
  return useQuery({
    queryKey: queryKeys.tickets.acceptances(hotelId, ticketId ?? "none"),
    queryFn: () => apiGet<TicketAcceptance[]>(`/hotels/${hotelId}/tickets/${ticketId}/acceptances`),
    enabled: Boolean(hotelId && ticketId),
  });
}

export function useTicketEscalations(hotelId: string, ticketId: string | null) {
  return useQuery({
    queryKey: queryKeys.tickets.escalations(hotelId, ticketId ?? "none"),
    queryFn: () => apiGet<EscalationLog[]>(`/hotels/${hotelId}/tickets/${ticketId}/escalations`),
    enabled: Boolean(hotelId && ticketId),
  });
}

export function useTicketMessages(hotelId: string, ticketId: string | null) {
  return useQuery({
    queryKey: queryKeys.tickets.messages(hotelId, ticketId ?? "none"),
    queryFn: () => apiGet<TicketMessage[]>(`/hotels/${hotelId}/tickets/${ticketId}/messages`),
    enabled: Boolean(hotelId && ticketId),
  });
}

export function useTicketTimeline(hotelId: string, ticketId: string | null) {
  return useQuery({
    queryKey: queryKeys.tickets.timeline(hotelId, ticketId ?? "none"),
    queryFn: () => apiGet<TicketTimelineItem[]>(`/hotels/${hotelId}/tickets/${ticketId}/timeline`),
    enabled: Boolean(hotelId && ticketId),
  });
}

export function useTicketGuestMessages(hotelId: string, ticketId: string | null) {
  return useQuery({
    queryKey: queryKeys.tickets.guestMessages(hotelId, ticketId ?? "none"),
    queryFn: () => apiGet<WhatsAppMessage[]>(`/hotels/${hotelId}/tickets/${ticketId}/guest-messages`),
    enabled: Boolean(hotelId && ticketId),
    refetchInterval: 5000,
  });
}

export function useCreateTicketMessage(hotelId: string, ticketId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { content: string; sender_type?: string }) =>
      apiPost<TicketMessage>(`/hotels/${hotelId}/tickets/${ticketId}/messages`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tickets.messages(hotelId, ticketId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.tickets.timeline(hotelId, ticketId) });
    },
  });
}

export function useSendTicketGuestMessage(hotelId: string, ticketId: string, conversationId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { message: string; reservation_id?: string | null }) =>
      apiPost(`/hotels/${hotelId}/whatsapp/conversations/${conversationId}/messages`, {
        ...payload,
        ticket_id: ticketId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tickets.guestMessages(hotelId, ticketId) });
      if (conversationId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.whatsapp.messages(hotelId, conversationId) });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.whatsapp.conversations(hotelId) });
    },
  });
}

export function useCreateTicket(hotelId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateTicketValues) => apiPost<Ticket>(`/hotels/${hotelId}/tickets`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.tickets.all(hotelId) }),
  });
}

export function useAcceptTicket(hotelId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ticketId: string) => apiPost<Ticket>(`/hotels/${hotelId}/tickets/${ticketId}/accept`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.tickets.all(hotelId) }),
  });
}

export function useRejectTicket(hotelId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: string | { ticketId: string; reason?: string }) => {
      const ticketId = typeof input === "string" ? input : input.ticketId;
      const payload = typeof input === "string" ? undefined : { reason: input.reason };
      return apiPost<Ticket>(`/hotels/${hotelId}/tickets/${ticketId}/reject`, payload);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.tickets.all(hotelId) }),
  });
}

export function useCompleteTicket(hotelId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ticketId: string) => apiPost<Ticket>(`/hotels/${hotelId}/tickets/${ticketId}/complete`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.tickets.all(hotelId) }),
  });
}

export function useApproveTicket(hotelId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ticketId: string) => apiPost<Ticket>(`/hotels/${hotelId}/tickets/${ticketId}/approve`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.tickets.all(hotelId) }),
  });
}

export function useReopenTicket(hotelId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ ticketId, note }: { ticketId: string; note?: string }) =>
      apiPost<Ticket>(`/hotels/${hotelId}/tickets/${ticketId}/reopen`, { stage: "reopened", note }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.tickets.all(hotelId) }),
  });
}

export function useUpdateTicketStage(hotelId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ ticketId, stage }: { ticketId: string; stage: string }) =>
      apiPatch<Ticket>(`/hotels/${hotelId}/tickets/${ticketId}/stage`, { stage }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.tickets.all(hotelId) }),
  });
}

export function useUpdateTicket(hotelId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ ticketId, payload }: { ticketId: string; payload: TicketUpdatePayload }) =>
      apiPatch<Ticket>(`/hotels/${hotelId}/tickets/${ticketId}`, payload),
    onSuccess: (_ticket, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tickets.all(hotelId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.tickets.timeline(hotelId, variables.ticketId) });
    },
  });
}

function compactFilters(filters: Record<string, string | undefined>) {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== undefined && value !== ""),
  );
}
