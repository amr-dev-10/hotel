import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import type { Permission, PermissionGroup, Role } from "@/types/domain";

export interface RolePayload {
  name: string;
  description?: string | null;
  permission_codes?: string[];
}

export function useRoles(hotelId: string) {
  return useQuery({
    queryKey: queryKeys.roles.all(hotelId),
    queryFn: () => apiGet<Role[]>(`/hotels/${hotelId}/roles`),
    enabled: Boolean(hotelId),
  });
}

export function usePermissions(hotelId: string) {
  return useQuery({
    queryKey: queryKeys.roles.permissions(hotelId),
    queryFn: () => apiGet<Permission[]>(`/hotels/${hotelId}/roles/permissions`),
    enabled: Boolean(hotelId),
  });
}

export function usePermissionGroups(hotelId: string) {
  return useQuery({
    queryKey: queryKeys.roles.permissionGroups(hotelId),
    queryFn: () => apiGet<PermissionGroup[]>(`/hotels/${hotelId}/roles/permission-groups`),
    enabled: Boolean(hotelId),
  });
}

export function useCreateRole(hotelId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: RolePayload) => apiPost<Role>(`/hotels/${hotelId}/roles`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.roles.all(hotelId) }),
  });
}

export function useUpdateRole(hotelId: string, roleId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: RolePayload) => apiPut<Role>(`/hotels/${hotelId}/roles/${roleId}`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.roles.all(hotelId) }),
  });
}

export function useDeleteRole(hotelId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (roleId: string) => apiDelete<{ deleted: boolean; role_id: string }>(`/hotels/${hotelId}/roles/${roleId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.roles.all(hotelId) }),
  });
}

export function useAssignUserRoles(hotelId: string, userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (roleIds: string[]) =>
      apiPost<{ assigned: boolean; user_id: string; role_ids: string[] }>(
        `/hotels/${hotelId}/roles/users/${userId}`,
        { role_ids: roleIds },
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.staff(hotelId) }),
  });
}
