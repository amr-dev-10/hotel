import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiGet, apiPatch, apiPost } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import type { Room } from "@/types/domain";
import type { CreateRoomValues } from "@/features/rooms/schemas/create-room.schema";

export type RoomUpdatePayload = {
  room_number?: string;
  room_type?: string | null;
  floor?: string | null;
  status?: string;
  notes?: string | null;
};

export type RoomQueryOptions = {
  enabled?: boolean;
  limit?: number;
  q?: string;
};

export function useRooms(hotelId: string, options: RoomQueryOptions = {}) {
  const limit = options.limit ?? 200;
  const q = options.q?.trim() || undefined;

  return useQuery({
    queryKey: queryKeys.rooms(hotelId, { limit, q }),
    queryFn: () => apiGet<Room[]>(`/hotels/${hotelId}/rooms`, { params: { limit, q } }),
    enabled: Boolean(hotelId) && (options.enabled ?? true),
    staleTime: 30_000,
  });
}

export function useRoom(hotelId: string, roomId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.roomDetail(hotelId, roomId ?? ""),
    queryFn: () => apiGet<Room>(`/hotels/${hotelId}/rooms/${roomId}`),
    enabled: Boolean(hotelId && roomId),
  });
}

export function useCreateRoom(hotelId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateRoomValues) => apiPost<Room>(`/hotels/${hotelId}/rooms`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.rooms(hotelId) }),
  });
}

export function useUpdateRoom(hotelId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ roomId, payload }: { roomId: string; payload: RoomUpdatePayload }) =>
      apiPatch<Room>(`/hotels/${hotelId}/rooms/${roomId}`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.rooms(hotelId) }),
  });
}
