import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiGet, apiPatch, apiPost } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import type { Guest, GuestConsent } from "@/types/domain";
import type { CreateGuestValues } from "@/features/guests/schemas/create-guest.schema";

export function useGuests(hotelId: string) {
  return useQuery({
    queryKey: queryKeys.guests(hotelId),
    queryFn: () => apiGet<Guest[]>(`/hotels/${hotelId}/guests`),
    enabled: Boolean(hotelId),
  });
}

export function useGuest(hotelId: string, guestId: string) {
  const guests = useGuests(hotelId);

  return {
    ...guests,
    data: guests.data?.find((guest) => guest.id === guestId),
  };
}

export function useGuestConsent(hotelId: string, guestId: string) {
  return useQuery({
    queryKey: queryKeys.guestConsent(hotelId, guestId),
    queryFn: () => apiGet<GuestConsent | null>(`/hotels/${hotelId}/guests/${guestId}/consent`),
    enabled: Boolean(hotelId && guestId),
  });
}

export function useCreateGuest(hotelId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateGuestValues) => apiPost<Guest>(`/hotels/${hotelId}/guests`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.guests(hotelId) }),
  });
}

export function useUpdateGuest(hotelId: string, guestId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { internal_notes?: string | null }) =>
      apiPatch<Guest>(`/hotels/${hotelId}/guests/${guestId}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.guests(hotelId) });
    },
  });
}

export function useGuestTimeline(hotelId: string, guestId: string) {
  return useQuery({
    queryKey: queryKeys.guestTimeline(hotelId, guestId),
    queryFn: () => apiGet<any[]>(`/hotels/${hotelId}/guests/${guestId}/timeline`),
    enabled: Boolean(hotelId && guestId),
  });
}

export function useGuestConversation(hotelId: string, guestId: string) {
  return useQuery({
    queryKey: ["guestConversation", hotelId, guestId],
    queryFn: () => apiGet<{ conversation_id: string; reservation_id: string | null }>(`/hotels/${hotelId}/guests/${guestId}/conversation`),
    enabled: Boolean(hotelId && guestId),
    staleTime: 0,
  });
}
