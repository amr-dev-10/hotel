import type {ReactNode} from 'react';
import {Text, View} from 'react-native';

import {styles} from '../../theme/styles';
import {useRBAC} from '../hooks/useRBAC';

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
  mode?: 'all' | 'any';
  requires: string | string[];
};

export function PermissionGate({
  children,
  fallback,
  mode = 'all',
  requires,
}: Props) {
  const rbac = useRBAC();
  const required = Array.isArray(requires) ? requires : [requires];
  const allowed =
    mode === 'any' ? rbac.canAny(required) : rbac.canEvery(required);

  if (allowed) {
    return <>{children}</>;
  }

  if (fallback !== undefined) {
    return <>{fallback}</>;
  }

  return (
    <View style={styles.permissionEmptyState}>
      <Text style={styles.permissionTitle}>Access restricted</Text>
      <Text style={styles.permissionText}>
        Your role does not include this permission.
      </Text>
    </View>
  );
}
