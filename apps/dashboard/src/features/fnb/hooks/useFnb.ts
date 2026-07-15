import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { absolutizeBackendUrl, apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import type {
  MenuCategory,
  MenuItem,
  RestaurantOrder,
  RestaurantOrderDetail,
  TaxConfig,
} from "@/types/domain";

export type CategoryPayload = {
  name: string;
  type?: string;
  display_order?: number;
  is_active?: boolean;
};

export type MenuItemPayload = {
  category_id: string;
  name: string;
  price: number;
  description?: string | null;
  description_short?: string | null;
  dietary_tags?: string[];
  preparation_time_minutes?: number;
  image_url?: string | null;
  is_available?: boolean;
  display_order?: number;
  tax_config_ids?: string[];
};

type MediaUploadResponse = {
  file_url: string;
};

export type TaxPayload = {
  name: string;
  description?: string | null;
  tax_type?: string;
  rate_percent: number;
  fixed_amount?: number;
  applies_to?: string;
  is_active?: boolean;
};

export type RestaurantOrderItemPayload = {
  menu_item_id: string;
  quantity: number;
  unit_price?: number | null;
  notes?: string | null;
};

export type RestaurantOrderPayload = {
  source?: string;
  table_id?: string | null;
  guest_id?: string | null;
  room_id?: string | null;
  ticket_id?: string | null;
  folio_id?: string | null;
  special_instructions?: string | null;
  tax?: number | null;
  ordered_by_guest?: boolean;
  status?: string;
  items: RestaurantOrderItemPayload[];
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

export function useCreateRestaurantOrder(hotelId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: RestaurantOrderPayload) => apiPost<RestaurantOrder>(`/hotels/${hotelId}/restaurant/orders`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["fnb", hotelId, "orders"] }),
  });
}

export function useUpdateRestaurantOrder(hotelId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, payload }: { orderId: string; payload: RestaurantOrderPayload }) =>
      apiPatch<RestaurantOrder>(`/hotels/${hotelId}/restaurant/orders/${orderId}`, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["fnb", hotelId, "orders"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.fnb.order(hotelId, variables.orderId) });
    },
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

export function useUploadMedia(hotelId: string) {
  return useMutation({
    mutationFn: async (file: File) => {
      const media = await apiPost<MediaUploadResponse>(`/hotels/${hotelId}/media/upload`, {
        file_type: file.type || mediaTypeFromName(file.name),
        file_name: file.name,
        file_size_bytes: file.size,
        storage_provider: "database",
        file_data_base64: await fileToBase64(file),
      });
      return absolutizeBackendUrl(media.file_url);
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

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("Could not read image"));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve(result.includes(",") ? result.split(",", 2)[1] : result);
    };
    reader.readAsDataURL(file);
  });
}

function mediaTypeFromName(name: string) {
  const extension = name.split(".").pop()?.toLowerCase();
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  if (extension === "gif") return "image/gif";
  return "image/jpeg";
}
