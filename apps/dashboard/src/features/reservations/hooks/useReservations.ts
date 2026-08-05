import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiDelete, apiGet, apiGetEnvelope, apiPost, apiPut } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import type { ApiEnvelope, CursorPageMeta, Folio, Reservation, ReservationGuest, StayRecord, WhatsAppMessage } from "@/types/domain";
import type { CreateReservationValues } from "@/features/reservations/schemas/create-reservation.schema";

export type ReservationUpdatePayload = {
  room_id?: string | null;
  rate_plan_id?: string | null;
  status?: string | null;
  checkin_date?: string | null;
  checkout_date?: string | null;
  source?: string | null;
  notes?: string | null;
};

export type ReservationFilters = {
  q?: string;
  status?: string;
  from?: string;
  to?: string;
  limit?: number;
  enabled?: boolean;
};

export function useReservations(hotelId: string, filters: ReservationFilters = {}) {
  const limit = filters.limit ?? 50;
  const { enabled, ...apiFilters } = filters;
  const query = useInfiniteQuery<ApiEnvelope<Reservation[]>, Error>({
    queryKey: queryKeys.reservationsList(hotelId, compactParams({ ...apiFilters, limit })),
    queryFn: ({ pageParam }) =>
      apiGetEnvelope<Reservation[]>(`/hotels/${hotelId}/reservations`, {
        params: compactParams({ ...apiFilters, limit, cursor: pageParam as string | undefined }),
      }),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => {
      const meta = lastPage.meta as CursorPageMeta | null | undefined;
      return meta?.has_more ? meta.next_cursor : undefined;
    },
    enabled: Boolean(hotelId) && (enabled ?? true),
  });

  return {
    ...query,
    data: query.data?.pages.flatMap((page) => page.data) ?? [],
    pages: query.data?.pages.map((page) => page.data) ?? [],
    pageMeta: query.data?.pages.at(-1)?.meta as CursorPageMeta | null | undefined,
    totalItems: (query.data?.pages.at(-1)?.meta as CursorPageMeta | null | undefined)?.total,
  };
}

export function useReservation(hotelId: string, reservationId: string) {
  return useQuery({
    queryKey: queryKeys.reservationDetail(hotelId, reservationId),
    queryFn: () => apiGet<Reservation>(`/hotels/${hotelId}/reservations/${reservationId}`),
    enabled: Boolean(hotelId && reservationId),
  });
}

export function useReservationGuests(hotelId: string, reservationId: string) {
  return useQuery({
    queryKey: queryKeys.reservationGuests(hotelId, reservationId),
    queryFn: () => apiGet<ReservationGuest[]>(`/hotels/${hotelId}/reservations/${reservationId}/guests`),
    enabled: Boolean(hotelId && reservationId),
  });
}

export function useReservationMessages(hotelId: string, reservationId: string) {
  return useQuery({
    queryKey: queryKeys.reservationMessages(hotelId, reservationId),
    queryFn: () => apiGet<WhatsAppMessage[]>(`/hotels/${hotelId}/reservations/${reservationId}/messages`),
    enabled: Boolean(hotelId && reservationId),
  });
}

export function useReservationStays(hotelId: string, reservationId: string) {
  return useQuery({
    queryKey: queryKeys.reservationStays(hotelId, reservationId),
    queryFn: () => apiGet<StayRecord[]>(`/hotels/${hotelId}/reservations/${reservationId}/stays`),
    enabled: Boolean(hotelId && reservationId),
  });
}

export function useReservationFolios(hotelId: string, reservationId: string) {
  return useQuery({
    queryKey: queryKeys.reservationFolios(hotelId, reservationId),
    queryFn: async () => {
      const folios = await apiGet<Folio[]>(`/hotels/${hotelId}/folios`);
      return folios.filter((folio) => folio.reservation_id === reservationId);
    },
    enabled: Boolean(hotelId && reservationId),
  });
}

export function useCreateReservation(hotelId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateReservationValues) =>
      apiPost<Reservation>(`/hotels/${hotelId}/reservations`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.reservations(hotelId) }),
  });
}

export function useUpdateReservation(hotelId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ reservationId, payload }: { reservationId: string; payload: ReservationUpdatePayload }) =>
      apiPut<Reservation>(`/hotels/${hotelId}/reservations/${reservationId}`, payload),
    onSuccess: (_reservation, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.reservations(hotelId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.reservationDetail(hotelId, variables.reservationId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.reservationStays(hotelId, variables.reservationId) });
    },
  });
}

export function useCheckInReservation(hotelId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (reservationId: string) =>
      apiPost<Reservation>(`/hotels/${hotelId}/reservations/${reservationId}/check-in`, {
        auto_assign: true,
        room_assignments: [],
      }),
    onSuccess: (_reservation, reservationId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.reservations(hotelId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.reservationDetail(hotelId, reservationId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.reservationStays(hotelId, reservationId) });
    },
  });
}

export function useCheckOutReservation(hotelId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (reservationId: string) =>
      apiPost<Reservation>(`/hotels/${hotelId}/reservations/${reservationId}/check-out`),
    onSuccess: (_reservation, reservationId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.reservations(hotelId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.reservationDetail(hotelId, reservationId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.reservationStays(hotelId, reservationId) });
    },
  });
}

export function useCancelReservation(hotelId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ reservationId, reason }: { reservationId: string; reason: string }) =>
      apiPost<Reservation>(`/hotels/${hotelId}/reservations/${reservationId}/cancel`, {
        reason: reason.trim() || null,
      }),
    onSuccess: (_reservation, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.reservations(hotelId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.reservationDetail(hotelId, variables.reservationId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.reservationStays(hotelId, variables.reservationId) });
    },
  });
}

export function useDeleteReservation(hotelId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (reservationId: string) =>
      apiDelete<{ deleted: boolean; reservation_id: string }>(`/hotels/${hotelId}/reservations/${reservationId}`),
    onSuccess: (_reservation, reservationId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.reservations(hotelId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.reservationDetail(hotelId, reservationId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.reservationStays(hotelId, reservationId) });
    },
  });
}

function compactParams(params: Record<string, string | number | undefined>) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== ""),
  );
}
