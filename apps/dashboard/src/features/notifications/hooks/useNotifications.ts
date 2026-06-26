import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiGet, apiPost } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import type { AppNotification } from "@/types/domain";

export function useNotifications(hotelId: string) {
  return useQuery({
    queryKey: queryKeys.notifications(hotelId),
    queryFn: () => apiGet<AppNotification[]>(`/hotels/${hotelId}/notifications/me`),
    enabled: Boolean(hotelId),
  });
}

export function useMarkNotificationRead(hotelId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) =>
      apiPost<AppNotification>(`/hotels/${hotelId}/notifications/${notificationId}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications(hotelId) }),
  });
}
