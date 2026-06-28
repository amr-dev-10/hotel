import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import type { AIAnalyticsSummary, AISettings, AISettingsTest } from "@/types/domain";

export interface AISettingsPayload {
  provider: string;
  api_key?: string | null;
  model?: string | null;
  embedding_provider?: string | null;
  embedding_model?: string | null;
  is_active?: boolean | null;
  temperature?: number;
  high_confidence_threshold?: number;
  low_confidence_threshold?: number;
  max_context_messages?: number;
  language?: string;
  enable_ticket_creation?: boolean;
  enable_auto_reply?: boolean;
  enable_sentiment_analysis?: boolean;
  escalation_department_key?: string;
  system_prompt?: string | null;
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

export function useAiAnalytics(hotelId: string) {
  return useQuery({
    queryKey: queryKeys.aiAnalytics(hotelId),
    queryFn: () => apiGet<AIAnalyticsSummary>(`/hotels/${hotelId}/ai/analytics`),
    enabled: Boolean(hotelId),
  });
}
