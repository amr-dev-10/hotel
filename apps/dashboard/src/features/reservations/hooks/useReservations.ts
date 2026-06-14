import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiGet, apiPost } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import type { Reservation } from "@/types/domain";
import type { CreateReservationValues } from "@/features/reservations/schemas/create-reservation.schema";

export function useReservations(hotelId: string) {
  return useQuery({
    queryKey: queryKeys.reservations(hotelId),
    queryFn: () => apiGet<Reservation[]>(`/hotels/${hotelId}/reservations`),
    enabled: Boolean(hotelId),
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.reservations(hotelId) }),
  });
}

export function useCheckOutReservation(hotelId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (reservationId: string) =>
      apiPost<Reservation>(`/hotels/${hotelId}/reservations/${reservationId}/check-out`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.reservations(hotelId) }),
  });
}
