export function hasPermission(
  permissions: string[] | undefined,
  permission: string,
) {
  if (!permission) {
    return true;
  }

  return Boolean(
    permissions?.includes(permission) ||
      permissions?.includes('*') ||
      permissions?.includes('admin.all'),
  );
}

export function hasAnyPermission(
  permissions: string[] | undefined,
  required: readonly string[] | undefined,
) {
  if (!required?.length) {
    return true;
  }

  return required.some(permission => hasPermission(permissions, permission));
}

export function hasEveryPermission(
  permissions: string[] | undefined,
  required: readonly string[] | undefined,
) {
  if (!required?.length) {
    return true;
  }

  return required.every(permission => hasPermission(permissions, permission));
}
