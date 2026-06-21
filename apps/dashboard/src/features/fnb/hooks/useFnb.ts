import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import type {
  MenuCategory,
  MenuItem,
  RestaurantOrder,
  RestaurantOrderDetail,
  TaxConfig,
} from "@/types/domain";

type CategoryPayload = {
  name: string;
  type?: string;
  display_order?: number;
  is_active?: boolean;
};

type MenuItemPayload = {
  category_id: string;
  name: string;
  price: number;
  description?: string | null;
  description_short?: string | null;
  dietary_tags?: string[];
  image_url?: string | null;
  is_available?: boolean;
  display_order?: number;
  tax_config_ids?: string[];
};

type TaxPayload = {
  name: string;
  rate_percent: number;
  applies_to?: string;
  is_active?: boolean;
};

type OrderFilters = Record<string, string | undefined>;

export function useMenuCategories(hotelId: string) {
  return useQuery({
    queryKey: queryKeys.fnb.categories(hotelId),
    queryFn: () => apiGet<MenuCategory[]>(`/hotels/${hotelId}/menu/categories`),
    enabled: Boolean(hotelId),
  });
}

export function useMenuItems(hotelId: string, categoryId?: string) {
  return useQuery({
    queryKey: queryKeys.fnb.items(hotelId, categoryId),
    queryFn: () =>
      apiGet<MenuItem[]>(`/hotels/${hotelId}/menu/items`, {
        params: categoryId ? { category_id: categoryId } : undefined,
      }),
    enabled: Boolean(hotelId),
  });
}

export function useTaxConfigs(hotelId: string) {
  return useQuery({
    queryKey: queryKeys.fnb.taxes(hotelId),
    queryFn: () => apiGet<TaxConfig[]>(`/hotels/${hotelId}/tax-configs`),
    enabled: Boolean(hotelId),
  });
}

export function useRestaurantOrders(hotelId: string, filters: OrderFilters = {}) {
  return useQuery({
    queryKey: queryKeys.fnb.orders(hotelId, filters),
    queryFn: () => apiGet<RestaurantOrder[]>(`/hotels/${hotelId}/restaurant/orders`, { params: filters }),
    enabled: Boolean(hotelId),
    refetchInterval: 15000,
  });
}

export function useRestaurantOrder(hotelId: string, orderId: string | null) {
  return useQuery({
    queryKey: queryKeys.fnb.order(hotelId, orderId ?? "none"),
    queryFn: () => apiGet<RestaurantOrderDetail>(`/hotels/${hotelId}/restaurant/orders/${orderId}`),
    enabled: Boolean(hotelId && orderId),
  });
}

export function useCreateMenuCategory(hotelId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CategoryPayload) => apiPost<MenuCategory>(`/hotels/${hotelId}/menu/categories`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.fnb.categories(hotelId) }),
  });
}

export function useUpdateMenuCategory(hotelId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ categoryId, payload }: { categoryId: string; payload: Partial<CategoryPayload> }) =>
      apiPatch<MenuCategory>(`/hotels/${hotelId}/menu/categories/${categoryId}`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.fnb.categories(hotelId) }),
  });
}

export function useDeleteMenuCategory(hotelId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (categoryId: string) => apiDelete(`/hotels/${hotelId}/menu/categories/${categoryId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.fnb.categories(hotelId) }),
  });
}

export function useCreateMenuItem(hotelId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: MenuItemPayload) => apiPost<MenuItem>(`/hotels/${hotelId}/menu/items`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fnb", hotelId, "items"] });
    },
  });
}

export function useUpdateMenuItem(hotelId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, payload }: { itemId: string; payload: Partial<MenuItemPayload> }) =>
      apiPatch<MenuItem>(`/hotels/${hotelId}/menu/items/${itemId}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fnb", hotelId, "items"] });
    },
  });
}

export function useDeleteMenuItem(hotelId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => apiDelete(`/hotels/${hotelId}/menu/items/${itemId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["fnb", hotelId, "items"] }),
  });
}

export function useCreateTaxConfig(hotelId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: TaxPayload) => apiPost<TaxConfig>(`/hotels/${hotelId}/tax-configs`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.fnb.taxes(hotelId) }),
  });
}

export function useUpdateTaxConfig(hotelId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taxId, payload }: { taxId: string; payload: Partial<TaxPayload> }) =>
      apiPatch<TaxConfig>(`/hotels/${hotelId}/tax-configs/${taxId}`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.fnb.taxes(hotelId) }),
  });
}

export function useUpdateOrderStatus(hotelId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: string }) =>
      apiPatch<RestaurantOrder>(`/hotels/${hotelId}/restaurant/orders/${orderId}/status`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["fnb", hotelId, "orders"] }),
  });
}
