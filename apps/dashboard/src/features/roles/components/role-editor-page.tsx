"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { showApiErrorToast } from "@/lib/api/error-toast";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { Button } from "@/components/ui/button";
import { DataState } from "@/components/ui/data-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PermissionMatrix } from "@/features/roles/components/permission-matrix";
import {
  useCreateRole,
  usePermissions,
  useRoles,
  useUpdateRole,
} from "@/features/roles/hooks/useRoles";

export function RoleEditorPage({
  hotelId,
  roleId,
}: {
  hotelId: string;
  roleId?: string;
}) {
  const router = useRouter();
  const roles = useRoles(hotelId);
  const permissions = usePermissions(hotelId);
  const createRole = useCreateRole(hotelId);
  const updateRole = useUpdateRole(hotelId, roleId ?? "");
  const existingRole = useMemo(
    () => roles.data?.find((role) => role.id === roleId),
    [roleId, roles.data],
  );
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [permissionCodes, setPermissionCodes] = useState<string[]>([]);
  const [permissionScopes, setPermissionScopes] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!existingRole) {
      return;
    }

    setName(existingRole.name);
    setDescription(existingRole.description ?? "");
    setPermissionCodes((existingRole.permissions ?? []).map((permission) => permission.code).sort());
    setPermissionScopes(
      Object.fromEntries(
        (existingRole.permissions ?? [])
          .filter((permission) => permission.scope)
          .map((permission) => [permission.code, permission.scope ?? "hotel"]),
      ),
    );
  }, [existingRole]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = {
      name,
      description: description || null,
      permission_codes: permissionCodes,
      permission_scopes: permissionScopes,
    };

    try {
      if (roleId) {
        await updateRole.mutateAsync(payload);
        toast.success("Role updated");
      } else {
        await createRole.mutateAsync(payload);
        toast.success("Role created");
      }
      router.push(`/${hotelId}/settings/roles`);
    } catch (error) {
      showApiErrorToast(error);
    }
  }

  if (roles.isLoading || permissions.isLoading) {
    return <DataState isLoading />;
  }

  if (roles.error || permissions.error) {
    return <DataState error={roles.error ?? permissions.error} />;
  }

  if (roleId && !existingRole) {
    return <DataState empty emptyTitle="Role not found." />;
  }

  const isSaving = createRole.isPending || updateRole.isPending;

  return (
    <form className="grid gap-5" onSubmit={handleSubmit}>
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <PageBreadcrumbs
          current={roleId ? "Edit Role" : "New Role"}
          hotelId={hotelId}
          items={[
            { label: "Settings" },
            { label: "Roles & Access", href: `/${hotelId}/settings/roles` },
          ]}
        />
        <Button disabled={isSaving || name.trim().length < 2} type="submit">
          {isSaving ? <Loader2 className="animate-spin" /> : <Save />}
          Save role
        </Button>
      </div>

      <section className="grid gap-4 rounded-md border border-slate-200 bg-white p-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="role-name">Role name</Label>
            <Input id="role-name" value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="role-description">Description</Label>
            <Textarea
              id="role-description"
              className="min-h-9"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
        </div>
      </section>

      <PermissionMatrix
        permissions={permissions.data ?? []}
        selectedPermissions={permissionCodes}
        selectedScopes={permissionScopes}
        onChange={setPermissionCodes}
        onScopesChange={setPermissionScopes}
      />
    </form>
  );
}
