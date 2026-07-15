import {useMemo} from 'react';

import {useAuthStore} from '../../store/authStore';
import {hasAnyPermission, hasEveryPermission, hasPermission} from '../rbac';

export function useRBAC(overridePermissions?: string[]) {
  const storePermissions = useAuthStore(
    state => state.currentUser?.permissions,
  );
  const permissions = overridePermissions ?? storePermissions;

  return useMemo(
    () => ({
      can: (permission: string) => hasPermission(permissions, permission),
      canAny: (required: string[]) => hasAnyPermission(permissions, required),
      canEvery: (required: string[]) =>
        hasEveryPermission(permissions, required),
      permissions: permissions ?? [],
    }),
    [permissions],
  );
}
