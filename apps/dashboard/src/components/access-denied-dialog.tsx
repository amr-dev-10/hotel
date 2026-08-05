"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ShieldAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ACCESS_DENIED_EVENT, type AccessDeniedEventDetail } from "@/lib/api/client";

type AccessDeniedState = AccessDeniedEventDetail & {
  shownAt: number;
};

const permissionDescriptions: Record<string, string> = {
  "ticket.view": "View tickets",
  "ticket.create": "Create tickets",
  "ticket.update": "Update tickets",
  "ticket.assign_self": "Assign tickets to self",
  "ticket.assign_others": "Assign tickets to other staff",
  "ticket.assign": "Assign or edit tickets",
  "ticket.accept": "Accept dispatched tickets",
  "ticket.reject": "Reject dispatched tickets",
  "ticket.approve": "Approve ticket workflow",
  "ticket.close": "Close tickets",
  "staff.view": "View staff",
  "staff.create": "Create staff",
  "staff.update": "Update staff",
  "staff.manage": "Manage staff",
  "shift.view": "View shifts",
  "shift.update": "Update shifts",
  "shift.manage": "Manage shifts",
  "role.view": "View roles",
  "role.manage": "Manage roles and access",
  "hotel.settings.manage": "Manage hotel settings",
  "workflow.manage": "Manage workflow settings",
  "analytics.view": "View analytics",
  "analytics.export": "Export analytics",
  "guest.view": "View guests",
  "guest.create": "Create guests",
  "guest.edit": "Edit guests",
  "reservation.view": "View reservations",
  "reservation.manage": "Manage reservations",
  "room.view": "View rooms",
  "room.update": "Update rooms",
  "bot.manage": "Manage bot configuration",
  "campaign.send": "Send campaigns",
};

export function AccessDeniedDialog() {
  const [accessDenied, setAccessDenied] = useState<AccessDeniedState | null>(null);
  const lastEventRef = useRef<{ key: string; shownAt: number } | null>(null);

  useEffect(() => {
    function handleAccessDenied(event: Event) {
      const detail = (event as CustomEvent<AccessDeniedEventDetail>).detail;
      if (!detail) {
        return;
      }

      const key = `${detail.method}:${detail.url}:${detail.message}`;
      const now = Date.now();
      if (lastEventRef.current?.key === key && now - lastEventRef.current.shownAt < 1500) {
        return;
      }

      lastEventRef.current = { key, shownAt: now };
      setAccessDenied({ ...detail, shownAt: now });
    }

    window.addEventListener(ACCESS_DENIED_EVENT, handleAccessDenied);
    return () => window.removeEventListener(ACCESS_DENIED_EVENT, handleAccessDenied);
  }, []);

  const permissionHints = useMemo(() => {
    if (!accessDenied) {
      return [];
    }
    if (accessDenied.requiredPermissions.length) {
      return accessDenied.requiredPermissions.map((permission) => ({
        code: permission,
        label: permissionDescriptions[permission] ?? humanizePermission(permission),
      }));
    }
    return inferPermissionHints(accessDenied);
  }, [accessDenied]);

  return (
    <Dialog open={Boolean(accessDenied)} onOpenChange={(open) => !open && setAccessDenied(null)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="mb-2 flex size-11 items-center justify-center rounded-md bg-amber-50 text-amber-700">
            <ShieldAlert className="size-5" />
          </div>
          <DialogTitle>Access restricted</DialogTitle>
          <DialogDescription>{dialogDescription(accessDenied?.kind)}</DialogDescription>
        </DialogHeader>

        {accessDenied ? (
          <div className="grid gap-4">
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <p>{accessDenied.message}</p>
              </div>
            </div>

            {permissionHints.length ? (
              <div className="grid gap-2">
                <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">
                  {accessDenied.kind === "missing_any_permission" ? "One permission needed" : "Permission needed"}
                </p>
                <div className="grid gap-2">
                  {permissionHints.map((permission) => (
                    <div
                      className="flex flex-col gap-1 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                      key={permission.code}
                    >
                      <span className="text-sm font-medium text-slate-800">{permission.label}</span>
                      <Badge className="w-fit font-mono" variant="blue">
                        {permission.code}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
              {accessDenied.hint ??
                "Ask an owner or role admin to add the required permission to your role. If you already have the permission, ask them to check whether your scope should be Own, Department, or Hotel."}
            </div>

            {accessDenied.cause || accessDenied.requestId ? (
              <div className="grid gap-1 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                {accessDenied.cause ? <p>{accessDenied.cause}</p> : null}
                {accessDenied.requestId ? (
                  <p>
                    Request ID: <span className="font-mono text-slate-800">{accessDenied.requestId}</span>
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="flex justify-end">
              <Button type="button" onClick={() => setAccessDenied(null)}>
                OK
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function dialogDescription(kind: AccessDeniedEventDetail["kind"] | undefined) {
  if (kind === "scope") {
    return "Your role has limited scope for this record.";
  }
  if (kind === "missing_any_permission") {
    return "Your role needs one of the listed permissions for this action.";
  }
  if (kind === "missing_permission") {
    return "Your role is missing the required permission for this action.";
  }
  return "Your current role does not allow this action.";
}

function inferPermissionHints(detail: AccessDeniedEventDetail) {
  const url = detail.url.toLowerCase();
  const method = detail.method.toUpperCase();

  if (url.includes("/tickets")) {
    return [{ code: method === "POST" ? "ticket.create" : "ticket.view", label: method === "POST" ? "Create tickets" : "View tickets with a wider scope" }];
  }
  if (url.includes("/users") || url.includes("/staff")) {
    return [{ code: method === "PATCH" || method === "PUT" ? "staff.update" : "staff.view", label: method === "PATCH" || method === "PUT" ? "Update staff with a wider scope" : "View staff with a wider scope" }];
  }
  if (url.includes("/shifts")) {
    return [{ code: method === "POST" ? "shift.manage" : method === "PATCH" || method === "PUT" ? "shift.update" : "shift.view", label: method === "POST" ? "Manage shifts" : method === "PATCH" || method === "PUT" ? "Update shifts with a wider scope" : "View shifts with a wider scope" }];
  }
  if (url.includes("/roles")) {
    return [{ code: method === "GET" ? "role.view" : "role.manage", label: method === "GET" ? "View roles" : "Manage roles and access" }];
  }
  if (url.includes("/routing-rules") || url.includes("/task-slas") || url.includes("/escalation-rules")) {
    return [{ code: "workflow.manage", label: "Manage workflow settings" }];
  }
  return [];
}

function humanizePermission(permission: string) {
  return permission
    .split(".")
    .map((part) => part.replace(/_/g, " "))
    .join(" ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}
