import {useCallback, useMemo, useState} from 'react';
import {Alert} from 'react-native';

import type {ApiEnvelope} from '../../../types/api';
import type {ArcadiaRecord, Session} from '../../../types/domain';
import {moveOrderToStatus} from '../../food/services/order.service';
import {runTicketWorkflowAction} from '../../ticket/services/ticket.service';
import {
  initialResources,
  resourceLabels,
  resourcePaths,
} from '../constants';
import type {ActionHandler, ResourceKey} from '../types';
import {filterRecords} from '../utils';

type RequestFn = <T>(
  path: string,
  options?: RequestInit,
  token?: string,
) => Promise<ApiEnvelope<T>>;

export function useOperationsWorkspace(
  request: RequestFn,
  session: Session | null,
) {
  const [activeResource, setActiveResource] = useState<ResourceKey>('tickets');
  const [resources, setResources] = useState(initialResources);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);

  const loadResource = useCallback(
    async (
      resource: ResourceKey,
      token = session?.accessToken,
      hotelId = session?.user.hotel_id,
    ) => {
      if (!token || !hotelId) {
        return;
      }

      setResources(current => ({
        ...current,
        [resource]: {...current[resource], loading: true, error: null},
      }));

      try {
        const payload = await request<ArcadiaRecord[]>(
          resourcePaths[resource](hotelId),
          {},
          token,
        );
        const items = Array.isArray(payload.data) ? payload.data : [];
        setResources(current => ({
          ...current,
          [resource]: {
            loading: false,
            error: null,
            items,
            total: payload.meta?.total ?? items.length,
          },
        }));
      } catch (error) {
        setResources(current => ({
          ...current,
          [resource]: {
            ...current[resource],
            loading: false,
            error:
              error instanceof Error ? error.message : 'Unable to load data.',
          },
        }));
      }
    },
    [request, session?.accessToken, session?.user.hotel_id],
  );

  const loadAllResources = useCallback(
    async (token: string, hotelId: string) => {
      await Promise.all(
        (Object.keys(resourceLabels) as ResourceKey[]).map(resource =>
          loadResource(resource, token, hotelId),
        ),
      );
    },
    [loadResource],
  );

  const replaceResourceItem = useCallback(
    (resource: ResourceKey, item: ArcadiaRecord) => {
      setResources(current => ({
        ...current,
        [resource]: {
          ...current[resource],
          items: current[resource].items.map(existing =>
            existing.id === item.id ? item : existing,
          ),
        },
      }));
    },
    [],
  );

  const runTicketAction = useCallback(
    async (item: ArcadiaRecord, action: string) => {
      if (!session?.user.hotel_id || !item.id) {
        return;
      }

      const actionKey = `tickets:${item.id}:${action}`;
      setActionLoading(actionKey);

      try {
        const payload = await runTicketWorkflowAction(
          session.user.hotel_id,
          item.id,
          action,
          session.accessToken,
        );
        if (payload.data) {
          replaceResourceItem('tickets', payload.data);
        }
      } catch (error) {
        Alert.alert(
          'Ticket action failed',
          error instanceof Error ? error.message : 'Unable to update ticket.',
        );
      } finally {
        setActionLoading(null);
      }
    },
    [replaceResourceItem, session?.accessToken, session?.user.hotel_id],
  );

  const runOrderAction = useCallback(
    async (item: ArcadiaRecord, status: string) => {
      if (!session?.user.hotel_id || !item.id) {
        return;
      }

      const actionKey = `orders:${item.id}:${status}`;
      setActionLoading(actionKey);

      try {
        const payload = await moveOrderToStatus(
          session.user.hotel_id,
          item.id,
          status,
          session.accessToken,
        );
        if (payload.data) {
          replaceResourceItem('orders', payload.data);
        }
      } catch (error) {
        Alert.alert(
          'Order update failed',
          error instanceof Error ? error.message : 'Unable to update order.',
        );
      } finally {
        setActionLoading(null);
      }
    },
    [replaceResourceItem, session?.accessToken, session?.user.hotel_id],
  );

  const handleAction = useCallback<ActionHandler>(
    (resource, item, action) => {
      if (resource === 'tickets') {
        const label = action.replaceAll('_', ' ');
        Alert.alert('Update ticket', `Confirm ${label}?`, [
          {text: 'Cancel', style: 'cancel'},
          {text: 'Confirm', onPress: () => runTicketAction(item, action)},
        ]);
        return;
      }

      if (resource === 'orders') {
        Alert.alert('Update order', `Move this order to ${action}?`, [
          {text: 'Cancel', style: 'cancel'},
          {text: 'Confirm', onPress: () => runOrderAction(item, action)},
        ]);
      }
    },
    [runOrderAction, runTicketAction],
  );

  const resetWorkspace = useCallback(() => {
    setResources(initialResources);
    setActiveResource('tickets');
    setSearchQuery('');
    setExpandedRecordId(null);
  }, []);

  const activeState = resources[activeResource];
  const filteredItems = useMemo(
    () => filterRecords(activeState.items, searchQuery),
    [activeState.items, searchQuery],
  );

  return {
    actionLoading,
    activeResource,
    activeState,
    expandedRecordId,
    filteredItems,
    handleAction,
    loadAllResources,
    loadResource,
    resetWorkspace,
    resources,
    searchQuery,
    setActiveResource,
    setExpandedRecordId,
    setSearchQuery,
  };
}
