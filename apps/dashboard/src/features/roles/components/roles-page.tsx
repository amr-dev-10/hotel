"use client";

import Link from "next/link";
import { Loader2, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataState } from "@/components/ui/data-state";
import { apiErrorMessage } from "@/lib/api/client";
import { useDeleteRole, useRoles } from "@/features/roles/hooks/useRoles";

export function RolesPage({ hotelId }: { hotelId: string }) {
  const roles = useRoles(hotelId);
  const deleteRole = useDeleteRole(hotelId);

  async function handleDelete(roleId: string) {
    try {
      await deleteRole.mutateAsync(roleId);
      toast.success("Role deleted");
    } catch (error) {
      toast.error(apiErrorMessage(error));
    }
  }

  if (roles.isLoading) {
    return <DataState isLoading />;
  }

  if (roles.error) {
    return <DataState error={roles.error} />;
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-semibold">Roles & Access</h2>
          <p className="text-sm text-slate-500">Manage dashboard roles and permission bundles.</p>
        </div>
        <Button asChild type="button">
          <Link href={`/${hotelId}/settings/roles/new`}>
            <Plus />
            New role
          </Link>
        </Button>
      </div>

      {!roles.data?.length ? (
        <DataState empty emptyTitle="No roles configured yet." />
      ) : (
        <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
          <div className="grid grid-cols-[1fr_140px_120px] border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-normal text-slate-500">
            <span>Role</span>
            <span>Type</span>
            <span className="text-right">Actions</span>
          </div>
          {roles.data.map((role) => (
            <div
              className="grid grid-cols-[1fr_140px_120px] items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0"
              key={role.id}
            >
              <Link className="min-w-0 hover:text-[#0F3D91]" href={`/${hotelId}/settings/roles/${role.id}`}>
                <p className="truncate text-sm font-semibold">{role.name}</p>
                <p className="truncate text-xs text-slate-500">{role.description ?? "No description"}</p>
              </Link>
              <Badge variant={role.is_system_role ? "blue" : "default"}>
                <ShieldCheck className="mr-1 size-3" />
                {role.is_system_role ? "System" : "Custom"}
              </Badge>
              <div className="flex justify-end gap-2">
                <Button asChild size="sm" type="button" variant="secondary">
                  <Link href={`/${hotelId}/settings/roles/${role.id}`}>Edit</Link>
                </Button>
                <Button
                  disabled={role.is_system_role || deleteRole.isPending}
                  size="icon"
                  type="button"
                  variant="ghost"
                  onClick={() => handleDelete(role.id)}
                >
                  {deleteRole.isPending ? <Loader2 className="animate-spin" /> : <Trash2 />}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
