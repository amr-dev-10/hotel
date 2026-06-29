import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import type {
  WhatsAppAccount,
  WhatsAppConversation,
  WhatsAppHealth,
  WhatsAppMessage,
  WhatsAppTemplate,
} from "@/types/domain";

const WHATSAPP_INBOX_REFETCH_INTERVAL_MS = 15_000;

export interface WhatsAppAccountPayload {
  business_name: string;
  phone_number?: string | null;
  phone_number_id: string;
  waba_id?: string | null;
  access_token?: string | null;
  webhook_verify_token?: string | null;
  status?: string;
  onboarding_step?: string;
}

export interface WhatsAppTemplatePayload {
  template_name: string;
  template_type: string;
  language: string;
  status?: string;
  meta_template_id?: string | null;
  header_params?: Record<string, unknown>[];
  body_params?: Record<string, unknown>[];
}

export function useWhatsappAccount(hotelId: string) {
  return useQuery({
    queryKey: queryKeys.whatsapp.account(hotelId),
    queryFn: () => apiGet<WhatsAppAccount | null>(`/hotels/${hotelId}/whatsapp/account`),
    enabled: Boolean(hotelId),
  });
}

export function useSaveWhatsappAccount(hotelId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: WhatsAppAccountPayload) =>
      apiPut<WhatsAppAccount>(`/hotels/${hotelId}/whatsapp/account`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.whatsapp.account(hotelId) }),
  });
}

export function useWhatsappHealth(hotelId: string) {
  return useQuery({
    queryKey: queryKeys.whatsapp.health(hotelId),
    queryFn: () => apiGet<WhatsAppHealth[]>(`/hotels/${hotelId}/whatsapp/health`),
    enabled: Boolean(hotelId),
  });
}

export function useUpdateWhatsappConversation(hotelId: string, conversationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { status?: string; priority?: string; assigned_staff_id?: string | null }) =>
      apiPatch<WhatsAppConversation>(`/hotels/${hotelId}/whatsapp/conversations/${conversationId}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.whatsapp.conversations(hotelId) });
    },
  });
}

export function useDeleteWhatsappConversationProfile(hotelId: string, conversationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      apiDelete<WhatsAppConversation>(`/hotels/${hotelId}/whatsapp/conversations/${conversationId}/profile`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.whatsapp.conversations(hotelId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.guests(hotelId) });
    },
  });
}

export function useDeleteWhatsappConversation(hotelId: string, conversationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiDelete<{ deleted: boolean; conversation_id: string }>(`/hotels/${hotelId}/whatsapp/conversations/${conversationId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.whatsapp.conversations(hotelId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.whatsapp.messages(hotelId, conversationId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.guests(hotelId) });
    },
  });
}

export function useWhatsappConversations(hotelId: string) {
  return useQuery({
    queryKey: queryKeys.whatsapp.conversations(hotelId),
    queryFn: () => apiGet<WhatsAppConversation[]>(`/hotels/${hotelId}/whatsapp/conversations`),
    enabled: Boolean(hotelId),
    refetchInterval: WHATSAPP_INBOX_REFETCH_INTERVAL_MS,
  });
}

export function useWhatsappMessages(hotelId: string, conversationId: string) {
  return useQuery({
    queryKey: queryKeys.whatsapp.messages(hotelId, conversationId),
    queryFn: () =>
      apiGet<WhatsAppMessage[]>(`/hotels/${hotelId}/whatsapp/conversations/${conversationId}/messages`),
    enabled: Boolean(hotelId && conversationId),
    refetchInterval: WHATSAPP_INBOX_REFETCH_INTERVAL_MS,
  });
}

export function useSendWhatsappMessage(hotelId: string, conversationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { message: string; reservation_id?: string; ticket_id?: string }) =>
      apiPost(`/hotels/${hotelId}/whatsapp/conversations/${conversationId}/messages`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.whatsapp.messages(hotelId, conversationId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.whatsapp.conversations(hotelId) });
    },
  });
}

export function useWhatsappTemplates(hotelId: string) {
  return useQuery({
    queryKey: queryKeys.whatsapp.templates(hotelId),
    queryFn: () => apiGet<WhatsAppTemplate[]>(`/hotels/${hotelId}/whatsapp/templates`),
    enabled: Boolean(hotelId),
  });
}

export function useCreateWhatsappTemplate(hotelId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: WhatsAppTemplatePayload) =>
      apiPost<WhatsAppTemplate>(`/hotels/${hotelId}/whatsapp/templates`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.whatsapp.templates(hotelId) }),
  });
}

export function useSyncWhatsappTemplates(hotelId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiPost<Record<string, unknown>>(`/hotels/${hotelId}/whatsapp/templates/sync`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.whatsapp.templates(hotelId) }),
  });
}
