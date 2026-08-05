import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiDelete, apiGet, apiGetEnvelope, apiPatch, apiPost } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import type { ApiEnvelope, CursorPageMeta, Guest, GuestConsent, GuestTimelineEvent } from "@/types/domain";
import type { CreateGuestValues } from "@/features/guests/schemas/create-guest.schema";

export type GuestUpdatePayload = {
  name?: string;
  phone?: string | null;
  whatsapp_phone?: string | null;
  email?: string | null;
  check_in_date?: string | null;
  check_out_date?: string | null;
  status?: string;
  internal_notes?: string | null;
};

export type GuestFilters = {
  q?: string;
  status?: string;
  limit?: number;
  enabled?: boolean;
};

export function useGuests(hotelId: string, filters: GuestFilters = {}) {
  const limit = filters.limit ?? 50;
  const { enabled, ...apiFilters } = filters;
  const query = useInfiniteQuery<ApiEnvelope<Guest[]>, Error>({
    queryKey: queryKeys.guestsList(hotelId, compactParams({ ...apiFilters, limit })),
    queryFn: ({ pageParam }) =>
      apiGetEnvelope<Guest[]>(`/hotels/${hotelId}/guests`, {
        params: compactParams({ ...apiFilters, limit, cursor: pageParam as string | undefined }),
      }),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => {
      const meta = lastPage.meta as CursorPageMeta | null | undefined;
      return meta?.has_more ? meta.next_cursor : undefined;
    },
    enabled: Boolean(hotelId) && (enabled ?? true),
    staleTime: 30_000,
  });

  return {
    ...query,
    data: query.data?.pages.flatMap((page) => page.data) ?? [],
    pages: query.data?.pages.map((page) => page.data) ?? [],
    pageMeta: query.data?.pages.at(-1)?.meta as CursorPageMeta | null | undefined,
    totalItems: (query.data?.pages.at(-1)?.meta as CursorPageMeta | null | undefined)?.total,
  };
}

export function useGuest(hotelId: string, guestId: string) {
  return useQuery({
    queryKey: queryKeys.guestDetail(hotelId, guestId),
    queryFn: () => apiGet<Guest>(`/hotels/${hotelId}/guests/${guestId}`),
    enabled: Boolean(hotelId && guestId),
  });
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
    mutationFn: (payload: GuestUpdatePayload) =>
      apiPatch<Guest>(`/hotels/${hotelId}/guests/${guestId}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.guests(hotelId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.guestDetail(hotelId, guestId) });
      queryClient.invalidateQueries({ queryKey: ["guestConversation", hotelId, guestId] });
      queryClient.invalidateQueries({ queryKey: queryKeys.whatsapp.conversations(hotelId) });
    },
  });
}

export function useDeleteGuest(hotelId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (guestId: string) => apiDelete<{ deleted: boolean; guest_id: string }>(`/hotels/${hotelId}/guests/${guestId}`),
    onSuccess: (_data, guestId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.guests(hotelId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.guestDetail(hotelId, guestId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.whatsapp.conversations(hotelId) });
    },
  });
}

export function useGuestTimeline(hotelId: string, guestId: string) {
  return useQuery({
    queryKey: queryKeys.guestTimeline(hotelId, guestId),
    queryFn: () => apiGet<GuestTimelineEvent[]>(`/hotels/${hotelId}/guests/${guestId}/timeline`),
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

function compactParams(params: Record<string, string | number | undefined>) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== ""),
  );
}
