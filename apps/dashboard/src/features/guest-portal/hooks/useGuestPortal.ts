import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { guestGet, guestPost } from "@/features/guest-portal/api/guest-api";
import { queryKeys } from "@/lib/api/query-keys";
import { useGuestCartStore } from "@/stores/guest-cart.store";
import { useGuestSessionStore } from "@/stores/guest-session.store";
import type {
  GuestPortalProfile,
  GuestPortalSession,
  GuestChatConversation,
  GuestChatMessage,
  GuestChatSendResponse,
  MenuCategory,
  MenuItem,
  RestaurantOrder,
  RestaurantOrderDetail,
  Ticket,
  TicketCategory,
} from "@/types/domain";

export function useGuestProfile() {
  const token = useGuestSessionStore((state) => state.token);
  const setProfile = useGuestSessionStore((state) => state.setProfile);
  return useQuery({
    queryKey: queryKeys.guestPortal.profile(),
    queryFn: async () => {
      const profile = await guestGet<GuestPortalProfile>("/guest-portal/profile");
      setProfile(profile);
      return profile;
    },
    enabled: Boolean(token),
  });
}

export function useGuestLogin() {
  const setSession = useGuestSessionStore((state) => state.setSession);
  return useMutation({
    mutationFn: (payload: { hotel_id: string; phone: string; room_number: string }) =>
      guestPost<GuestPortalSession>("/guest-portal/auth/login", payload),
    onSuccess: (session) => setSession(session.access_token, session.profile),
  });
}

export function useGuestTokenLogin() {
  const setSession = useGuestSessionStore((state) => state.setSession);
  return useMutation({
    mutationFn: (token: string) => guestPost<GuestPortalSession>("/guest-portal/auth/token", { token }),
    onSuccess: (session) => setSession(session.access_token, session.profile),
  });
}

export function useGuestMenuCategories() {
  const token = useGuestSessionStore((state) => state.token);
  return useQuery({
    queryKey: queryKeys.guestPortal.categories(),
    queryFn: () => guestGet<MenuCategory[]>("/guest-portal/menu/categories"),
    enabled: Boolean(token),
  });
}

export function useGuestMenuItems(categoryId?: string) {
  const token = useGuestSessionStore((state) => state.token);
  return useQuery({
    queryKey: queryKeys.guestPortal.items(categoryId),
    queryFn: () =>
      guestGet<MenuItem[]>("/guest-portal/menu/items", {
        params: categoryId ? { category_id: categoryId } : undefined,
      }),
    enabled: Boolean(token),
  });
}

export function useGuestOrders() {
  const token = useGuestSessionStore((state) => state.token);
  return useQuery({
    queryKey: queryKeys.guestPortal.orders(),
    queryFn: () => guestGet<RestaurantOrder[]>("/guest-portal/orders"),
    enabled: Boolean(token),
    refetchInterval: 10000,
  });
}

export function useGuestOrder(orderId: string | null) {
  const token = useGuestSessionStore((state) => state.token);
  return useQuery({
    queryKey: ["guest-portal", "orders", orderId ?? "none"] as const,
    queryFn: () => guestGet<RestaurantOrderDetail>(`/guest-portal/orders/${orderId}`),
    enabled: Boolean(token && orderId),
  });
}

export function usePlaceGuestOrder() {
  const queryClient = useQueryClient();
  const clearCart = useGuestCartStore((state) => state.clear);
  return useMutation({
    mutationFn: (payload: {
      items: { menu_item_id: string; quantity: number; notes?: string | null }[];
      special_instructions?: string | null;
    }) => guestPost<RestaurantOrder>("/guest-portal/orders", payload),
    onSuccess: () => {
      clearCart();
      queryClient.invalidateQueries({ queryKey: queryKeys.guestPortal.orders() });
    },
  });
}

export function useGuestRequests() {
  const token = useGuestSessionStore((state) => state.token);
  return useQuery({
    queryKey: queryKeys.guestPortal.requests(),
    queryFn: () => guestGet<Ticket[]>("/guest-portal/requests"),
    enabled: Boolean(token),
    refetchInterval: 15000,
  });
}

export function useGuestRequestCategories() {
  const token = useGuestSessionStore((state) => state.token);
  return useQuery({
    queryKey: queryKeys.guestPortal.requestCategories(),
    queryFn: () => guestGet<TicketCategory[]>("/guest-portal/request-categories"),
    enabled: Boolean(token),
  });
}

export function useCreateGuestRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      item_description: string;
      task_category_id?: string | null;
      department_key?: string | null;
      task_category?: string | null;
      priority?: number;
    }) => guestPost<Ticket>("/guest-portal/requests", payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.guestPortal.requests() }),
  });
}

export function useGuestChatConversation(enabled = true) {
  const token = useGuestSessionStore((state) => state.token);
  return useQuery({
    queryKey: queryKeys.guestPortal.chatConversation(),
    queryFn: () => guestGet<GuestChatConversation>("/guest-portal/chat/conversation"),
    enabled: Boolean(token && enabled),
  });
}

export function useGuestChatMessages(enabled = true) {
  const token = useGuestSessionStore((state) => state.token);
  return useQuery({
    queryKey: queryKeys.guestPortal.chatMessages(),
    queryFn: () => guestGet<GuestChatMessage[]>("/guest-portal/chat/messages"),
    enabled: Boolean(token && enabled),
    refetchInterval: enabled ? 3000 : false,
  });
}

export function useSendGuestChatMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (message: string) =>
      guestPost<GuestChatSendResponse>("/guest-portal/chat/send", { message }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.guestPortal.chatMessages() }),
  });
}
