"use client";

import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import type { Permission } from "@/types/domain";

interface PermissionMatrixProps {
  permissions: Permission[];
  selectedPermissions: string[];
  selectedScopes: Record<string, string>;
  onChange: (permissions: string[]) => void;
  onScopesChange: (scopes: Record<string, string>) => void;
  disabled?: boolean;
}

const moduleOrder = [
  "tickets",
  "rooms",
  "guests",
  "reservations",
  "users",
  "staff",
  "roles",
  "hotels",
  "workflow",
  "campaigns",
  "analytics",
];
const scopedPermissionCodes = new Set([
  "ticket.view",
  "ticket.update",
  "ticket.delete",
  "ticket.assign_self",
  "ticket.assign_others",
  "shift.view",
  "shift.update",
  "staff.view",
  "staff.update",
]);
const scopeOptions = [
  { value: "own", label: "Own" },
  { value: "department", label: "Department" },
  { value: "hotel", label: "Hotel" },
];

export function PermissionMatrix({
  permissions,
  selectedPermissions,
  selectedScopes,
  onChange,
  onScopesChange,
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
      if (selectedScopes[code]) {
        const nextScopes = { ...selectedScopes };
        delete nextScopes[code];
        onScopesChange(nextScopes);
      }
      return;
    }

    onChange([...selectedPermissions, code].sort());
    if (isScopedPermissionCode(code) && !selectedScopes[code]) {
      onScopesChange({ ...selectedScopes, [code]: "hotel" });
    }
  }

  function updateScope(code: string, scope: string) {
    if (disabled) {
      return;
    }
    onScopesChange({ ...selectedScopes, [code]: scope });
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
                const isScoped = isScopedPermissionCode(permission.code);
                return (
                  <div
                    className="inline-flex min-h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700"
                    key={permission.id}
                  >
                    <label className="inline-flex items-center gap-2">
                      <input
                        checked={checked}
                        className="size-4 accent-[var(--primary)]"
                        disabled={disabled}
                        type="checkbox"
                        onChange={() => toggle(permission.code)}
                      />
                      <span className="whitespace-nowrap">{permission.name}</span>
                    </label>
                    {isScoped && checked ? (
                      <select
                        aria-label={`${permission.name} scope`}
                        className="h-7 rounded-md border border-slate-200 bg-slate-50 px-2 text-xs text-slate-700"
                        disabled={disabled}
                        value={selectedScopes[permission.code] ?? permission.scope ?? "hotel"}
                        onChange={(event) => updateScope(permission.code, event.target.value)}
                      >
                        {scopeOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    ) : null}
                  </div>
                );
              })}
          </div>
        </div>
      ))}
    </div>
  );
}

function isScopedPermissionCode(code: string) {
  return scopedPermissionCodes.has(code);
}
