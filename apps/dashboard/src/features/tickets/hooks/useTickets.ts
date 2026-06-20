import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiGet, apiPatch, apiPost } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import type { EscalationLog, Ticket, TicketAcceptance, TicketMessage, TicketTimelineItem } from "@/types/domain";
import type { CreateTicketValues } from "@/features/tickets/schemas/create-ticket.schema";

type TicketFilters = Record<string, string | undefined>;

export function useTickets(hotelId: string, filters: TicketFilters) {
  return useQuery({
    queryKey: queryKeys.tickets.list(hotelId, filters),
    queryFn: () => apiGet<Ticket[]>(`/hotels/${hotelId}/tickets`, { params: compactFilters(filters) }),
    enabled: Boolean(hotelId),
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
    mutationFn: (ticketId: string) => apiPost<Ticket>(`/hotels/${hotelId}/tickets/${ticketId}/reject`),
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

function compactFilters(filters: TicketFilters) {
  return Object.fromEntries(Object.entries(filters).filter(([, value]) => Boolean(value)));
}
