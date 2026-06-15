import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  platformGet,
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
