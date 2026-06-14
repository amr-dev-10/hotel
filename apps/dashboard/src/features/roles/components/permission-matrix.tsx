"use client";

import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import type { Permission } from "@/types/domain";

interface PermissionMatrixProps {
  permissions: Permission[];
  selectedPermissions: string[];
  onChange: (permissions: string[]) => void;
  disabled?: boolean;
}

const moduleOrder = ["ticket", "room", "reservation", "user", "role", "hotel", "workflow", "campaign", "report"];

export function PermissionMatrix({
  permissions,
  selectedPermissions,
  onChange,
  disabled,
}: PermissionMatrixProps) {
  const grouped = useMemo(() => {
    const byModule = new Map<string, Permission[]>();
    permissions.forEach((permission) => {
      const permissionModule = permission.module || permission.code.split(".")[0] || "other";
      byModule.set(permissionModule, [...(byModule.get(permissionModule) ?? []), permission]);
    });

    return [...byModule.entries()].sort(([a], [b]) => {
      const aIndex = moduleOrder.indexOf(a);
      const bIndex = moduleOrder.indexOf(b);
      if (aIndex === -1 && bIndex === -1) {
        return a.localeCompare(b);
      }
      if (aIndex === -1) {
        return 1;
      }
      if (bIndex === -1) {
        return -1;
      }
      return aIndex - bIndex;
    });
  }, [permissions]);

  function toggle(code: string) {
    if (disabled) {
      return;
    }

    if (selectedPermissions.includes(code)) {
      onChange(selectedPermissions.filter((item) => item !== code));
      return;
    }

    onChange([...selectedPermissions, code].sort());
  }

  if (!permissions.length) {
    return (
      <div className="rounded-md border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
        No permissions returned by the backend.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
      <div className="grid grid-cols-[minmax(120px,180px)_1fr] border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-normal text-slate-500">
        <span>Module</span>
        <span>Permissions</span>
      </div>

      {grouped.map(([module, items]) => (
        <div className="grid grid-cols-[minmax(120px,180px)_1fr] border-b border-slate-100 px-4 py-3 last:border-b-0" key={module}>
          <div className="flex items-center">
            <Badge variant="blue">{module}</Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            {items
              .slice()
              .sort((a, b) => a.code.localeCompare(b.code))
              .map((permission) => {
                const checked = selectedPermissions.includes(permission.code);
                return (
                  <label
                    className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700"
                    key={permission.id}
                  >
                    <input
                      checked={checked}
                      className="size-4 accent-[#0F3D91]"
                      disabled={disabled}
                      type="checkbox"
                      onChange={() => toggle(permission.code)}
                    />
                    <span className="whitespace-nowrap">{permission.name}</span>
                  </label>
                );
              })}
          </div>
        </div>
      ))}
    </div>
  );
}
