import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  platformGet,
  platformPatch,
  platformPost,
  platformPut,
} from "@/lib/api/platform-client";
import type {
  PlatformDashboard,
  PlatformHotelCreateResponse,
  PlatformHotelSummary,
  PlatformSetting,
  PlatformSubscriptionSummary,
  PlatformUserSummary,
} from "@/types/domain";
import {
  toPlatformHotelPayload,
  type CreatePlatformHotelValues,
} from "@/features/platform/schemas/create-platform-hotel.schema";

export const platformKeys = {
  dashboard: ["platform", "dashboard"] as const,
  hotels: ["platform", "hotels"] as const,
  users: ["platform", "users"] as const,
  subscriptions: ["platform", "subscriptions"] as const,
  settings: ["platform", "settings"] as const,
};

export interface PlatformUserUpdatePayload {
  name?: string;
  email?: string;
  department_id?: string | null;
  reports_to?: string | null;
  staff_level?: string | null;
  user_type?: string | null;
  job_role?: string | null;
  is_active?: boolean;
  is_on_duty?: boolean;
}

export interface PlatformHotelUpdatePayload {
  slug?: string;
  name?: string;
  subscription_tier?: string;
  status?: string;
}

export interface PlatformSubscriptionUpdatePayload {
  plan?: string;
  status?: string;
  billing_cycle?: string;
  renewal_date?: string | null;
  current_period_start?: string | null;
  current_period_end?: string | null;
  cancelled_at?: string | null;
}

export interface PasswordChangePayload {
  current_password: string;
  new_password: string;
  confirm_password: string;
}

export interface PlatformUserPasswordResetPayload {
  new_password: string;
  confirm_password: string;
}

export function usePlatformDashboard() {
  return useQuery({
    queryKey: platformKeys.dashboard,
    queryFn: () => platformGet<PlatformDashboard>("/platform/dashboard"),
  });
}

export function usePlatformHotels() {
  return useQuery({
    queryKey: platformKeys.hotels,
    queryFn: () => platformGet<PlatformHotelSummary[]>("/platform/hotels"),
  });
}

export function usePlatformUsers() {
  return useQuery({
    queryKey: platformKeys.users,
    queryFn: () => platformGet<PlatformUserSummary[]>("/platform/users"),
  });
}

export function usePlatformSubscriptions() {
  return useQuery({
    queryKey: platformKeys.subscriptions,
    queryFn: () => platformGet<PlatformSubscriptionSummary[]>("/platform/subscriptions"),
  });
}

export function usePlatformSettings() {
  return useQuery({
    queryKey: platformKeys.settings,
    queryFn: () => platformGet<PlatformSetting[]>("/platform/platform-settings"),
  });
}

export function useCreatePlatformHotel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: CreatePlatformHotelValues) =>
      platformPost<PlatformHotelCreateResponse>(
        "/platform/hotels",
        toPlatformHotelPayload(values),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: platformKeys.dashboard });
      queryClient.invalidateQueries({ queryKey: platformKeys.hotels });
      queryClient.invalidateQueries({ queryKey: platformKeys.users });
      queryClient.invalidateQueries({ queryKey: platformKeys.subscriptions });
    },
  });
}

export function useUpdatePlatformHotel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ hotelId, payload }: { hotelId: string; payload: PlatformHotelUpdatePayload }) =>
      platformPatch<PlatformHotelSummary>(`/platform/hotels/${hotelId}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: platformKeys.dashboard });
      queryClient.invalidateQueries({ queryKey: platformKeys.hotels });
      queryClient.invalidateQueries({ queryKey: platformKeys.subscriptions });
    },
  });
}

export function useSavePlatformSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (settings: Record<string, unknown>) =>
      platformPut<PlatformSetting[]>("/platform/platform-settings", { settings }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: platformKeys.settings });
    },
  });
}

export function useUpdatePlatformUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, payload }: { userId: string; payload: PlatformUserUpdatePayload }) =>
      platformPatch<PlatformUserSummary>(`/platform/users/${userId}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: platformKeys.users });
      queryClient.invalidateQueries({ queryKey: platformKeys.hotels });
    },
  });
}

export function useResetPlatformUserPassword() {
  return useMutation({
    mutationFn: ({ userId, payload }: { userId: string; payload: PlatformUserPasswordResetPayload }) =>
      platformPost<{ password_changed: boolean }>(`/platform/users/${userId}/password`, payload),
  });
}

export function useUpdatePlatformSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      subscriptionId,
      payload,
    }: {
      subscriptionId: string;
      payload: PlatformSubscriptionUpdatePayload;
    }) => platformPatch<PlatformSubscriptionSummary>(`/platform/subscriptions/${subscriptionId}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: platformKeys.dashboard });
      queryClient.invalidateQueries({ queryKey: platformKeys.hotels });
      queryClient.invalidateQueries({ queryKey: platformKeys.subscriptions });
    },
  });
}

export function useChangePlatformPassword() {
  return useMutation({
    mutationFn: (payload: PasswordChangePayload) =>
      platformPost<{ password_changed: boolean }>("/platform/auth/change-password", payload),
  });
}
