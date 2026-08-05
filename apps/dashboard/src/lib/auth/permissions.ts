import { Permissions, type PermissionCode } from "@/constants/permissions";
import type { CurrentUser } from "@/types/domain";

const equivalentPermissions: Record<string, string[]> = {
  [Permissions.TICKET_UPDATE]: [
    Permissions.TICKET_ACCEPT,
    Permissions.TICKET_REJECT,
    Permissions.TICKET_COMPLETE_OWN,
    Permissions.TICKET_CLOSE,
    Permissions.TICKET_APPROVE,
    Permissions.TICKET_VERIFY,
  ],
  [Permissions.TICKET_ACCEPT]: [Permissions.TICKET_UPDATE],
  [Permissions.TICKET_REJECT]: [Permissions.TICKET_UPDATE],
  [Permissions.TICKET_COMPLETE_OWN]: [Permissions.TICKET_UPDATE],
  [Permissions.TICKET_CLOSE]: [Permissions.TICKET_UPDATE],
  [Permissions.TICKET_APPROVE]: [Permissions.TICKET_UPDATE],
  [Permissions.TICKET_VERIFY]: [Permissions.TICKET_UPDATE],
  [Permissions.TICKET_ASSIGN_SELF]: [Permissions.TICKET_ASSIGN, Permissions.TICKET_ASSIGN_OTHERS],
  [Permissions.TICKET_ASSIGN_OTHERS]: [Permissions.TICKET_ASSIGN],
  [Permissions.TICKET_ASSIGN]: [Permissions.TICKET_ASSIGN_OTHERS, Permissions.TICKET_UPDATE],
  [Permissions.USER_VIEW]: [Permissions.STAFF_VIEW],
  [Permissions.USER_CREATE]: [Permissions.STAFF_CREATE],
  [Permissions.USER_UPDATE]: [Permissions.STAFF_UPDATE],
  [Permissions.USER_DELETE]: [Permissions.STAFF_DELETE],
  [Permissions.USER_MANAGE]: [Permissions.STAFF_MANAGE],
  [Permissions.STAFF_VIEW]: [Permissions.USER_VIEW],
  [Permissions.STAFF_CREATE]: [Permissions.USER_CREATE],
  [Permissions.STAFF_UPDATE]: [Permissions.USER_UPDATE],
  [Permissions.STAFF_DELETE]: [Permissions.USER_DELETE],
  [Permissions.STAFF_MANAGE]: [Permissions.USER_MANAGE],
};

const scopeRank: Record<string, number> = {
  none: 0,
  own: 1,
  department: 2,
  hotel: 3,
};

export function hasPermission(user: CurrentUser | null, permissionCode: string): boolean {
  if (!user) {
    return false;
  }
  if (user.is_hotel_owner) {
    return true;
  }

  const permissions = new Set(user.permissions ?? []);
  const acceptedCodes = new Set<string>([
    permissionCode,
    ...(equivalentPermissions[permissionCode] ?? []),
  ]);

  const manageCode = impliedManagePermission(permissionCode);
  if (manageCode) {
    acceptedCodes.add(manageCode);
    for (const equivalent of equivalentPermissions[manageCode] ?? []) {
      acceptedCodes.add(equivalent);
    }
  }

  return [...acceptedCodes].some((code) => permissions.has(code));
}

export function hasAnyPermission(user: CurrentUser | null, permissionCodes: readonly string[]): boolean {
  return permissionCodes.some((permissionCode) => hasPermission(user, permissionCode));
}

export function hasScopeAtLeast(
  user: CurrentUser | null,
  permissionCode: PermissionCode,
  minimumScope: "own" | "department" | "hotel",
): boolean {
  if (!user) {
    return false;
  }
  if (user.is_hotel_owner) {
    return true;
  }
  if (!hasPermission(user, permissionCode)) {
    return false;
  }

  const actualScope = user.permission_scopes?.[permissionCode] ?? "hotel";
  return (scopeRank[actualScope] ?? 0) >= scopeRank[minimumScope];
}

function impliedManagePermission(permissionCode: string): string | null {
  const [resource, action] = permissionCode.split(".");
  if (!resource || !action || action === "manage") {
    return null;
  }
  return `${resource}.manage`;
}
