import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiGet, apiPost } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import type { Folio, Reservation, ReservationGuest, StayRecord } from "@/types/domain";
import type { CreateReservationValues } from "@/features/reservations/schemas/create-reservation.schema";

export function useReservations(hotelId: string) {
  return useQuery({
    queryKey: queryKeys.reservations(hotelId),
    queryFn: () => apiGet<Reservation[]>(`/hotels/${hotelId}/reservations`),
    enabled: Boolean(hotelId),
  });
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
    queryFn: () => apiGet<any[]>(`/hotels/${hotelId}/reservations/${reservationId}/messages`),
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
