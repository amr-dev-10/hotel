import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import type { AISettings, AISettingsTest } from "@/types/domain";

export interface AISettingsPayload {
  provider: string;
  api_key?: string | null;
  model?: string | null;
  embedding_provider?: string | null;
  embedding_model?: string | null;
}

export function useAiSettings(hotelId: string) {
  return useQuery({
    queryKey: queryKeys.ai(hotelId),
    queryFn: () => apiGet<AISettings>(`/hotels/${hotelId}/settings/ai`),
    enabled: Boolean(hotelId),
  });
}

export function useSaveAiSettings(hotelId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: AISettingsPayload) => apiPut<AISettings>(`/hotels/${hotelId}/settings/ai`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.ai(hotelId) }),
  });
}

export function useTestAiConnection(hotelId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiPost<AISettingsTest>(`/hotels/${hotelId}/settings/ai/test`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.ai(hotelId) }),
  });
}

export function useResetAiSettings(hotelId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiDelete<AISettings>(`/hotels/${hotelId}/settings/ai`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.ai(hotelId) }),
  });
}
