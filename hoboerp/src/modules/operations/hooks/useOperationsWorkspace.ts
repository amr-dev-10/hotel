import {useQueries, useQueryClient} from '@tanstack/react-query';
import {useCallback, useMemo, useState} from 'react';

import {formatErrorDetails} from '../../../services/api';
import type {ApiEnvelope} from '../../../types/api';
import type {ArcadiaRecord, Session} from '../../../types/domain';
import {moveOrderToStatus} from '../../food/services/order.service';
import {runTicketWorkflowAction} from '../../ticket/services/ticket.service';
import {resourceKeys, resourceLabels} from '../constants';
import {
  fetchOperationsResource,
  operationsQueryKeys,
  type OperationsResourcePayload,
} from '../queries';
import type {ActionHandler, ResourceKey, ResourceState} from '../types';
import {filterRecords} from '../utils';

type RequestFn = <T>(
  path: string,
  options?: RequestInit,
  token?: string,
) => Promise<ApiEnvelope<T>>;

type DialogRequest = {
  title: string;
  message: string;
  details?: string;
  tone?: 'error' | 'success' | 'info';
  actions?: {
    label: string;
    onPress?: () => void;
    tone?: 'primary' | 'secondary';
  }[];
};

export function useOperationsWorkspace(
  request: RequestFn,
  session: Session | null,
  showDialog?: (dialog: DialogRequest) => void,
) {
  const queryClient = useQueryClient();
  const [activeResource, setActiveResource] = useState<ResourceKey>('tickets');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);
  const accessToken = session?.accessToken;
  const hotelId = session?.user.hotel_id;

  const resourceQueries = useQueries({
    queries: resourceKeys.map(resource => ({
      enabled: Boolean(accessToken && hotelId),
      queryFn: () =>
        fetchOperationsResource(
          resource,
          request,
          accessToken ?? '',
          hotelId ?? '',
        ),
      queryKey: operationsQueryKeys.resource(hotelId ?? 'pending-hotel', resource),
    })),
  });

  const resources = useMemo(
    () =>
      resourceKeys.reduce((current, resource, index) => {
        const query = resourceQueries[index];
        const data = query.data as OperationsResourcePayload | undefined;

        current[resource] = {
          error: query.error
            ? formatErrorDetails(
                query.error,
                `Unable to load ${resourceLabels[resource].toLowerCase()}.`,
              )
            : null,
          items: data?.items ?? [],
          loading: query.isLoading || query.isFetching,
          total: data?.total,
        };

        return current;
      }, {} as Record<ResourceKey, ResourceState>),
    [resourceQueries],
  );

  const loadResource = useCallback(
    async (
      resource: ResourceKey,
      token = accessToken,
      activeHotelId = hotelId,
    ) => {
      if (!token || !activeHotelId) {
        return;
      }

      try {
        await queryClient.fetchQuery({
          queryFn: () =>
            fetchOperationsResource(resource, request, token, activeHotelId),
          queryKey: operationsQueryKeys.resource(activeHotelId, resource),
          staleTime: 0,
        });
      } catch {
        // React Query stores the error state for the UI; callers keep their
        // previous fire-and-forget refresh semantics.
      }
    },
    [accessToken, hotelId, queryClient, request],
  );

  const loadAllResources = useCallback(
    async (token: string, activeHotelId: string) => {
      await Promise.all(
        resourceKeys.map(resource => loadResource(resource, token, activeHotelId)),
      );
    },
    [loadResource],
  );

  const replaceResourceItem = useCallback(
    (resource: ResourceKey, item: ArcadiaRecord) => {
      if (!hotelId) {
        return;
      }

      queryClient.setQueryData<OperationsResourcePayload>(
        operationsQueryKeys.resource(hotelId, resource),
        current => {
          if (!current) {
            return current;
          }

          return {
            ...current,
            items: current.items.map(existing =>
              existing.id === item.id ? item : existing,
            ),
          };
        },
      );
    },
    [hotelId, queryClient],
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
        if (payload.data?.id) {
          replaceResourceItem('tickets', payload.data);
        }
        await Promise.all([
          loadResource('tickets'),
          loadResource('escalations'),
        ]);
      } catch (error) {
        const details = formatErrorDetails(error, 'Unable to update ticket.');
        showDialog?.(errorDialog('Ticket action failed', details));
      } finally {
        setActionLoading(null);
      }
    },
    [
      loadResource,
      replaceResourceItem,
      session?.accessToken,
      session?.user.hotel_id,
      showDialog,
    ],
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
        const details = formatErrorDetails(error, 'Unable to update order.');
        showDialog?.(errorDialog('Order update failed', details));
      } finally {
        setActionLoading(null);
      }
    },
    [
      replaceResourceItem,
      session?.accessToken,
      session?.user.hotel_id,
      showDialog,
    ],
  );

  const handleAction = useCallback<ActionHandler>(
    (resource, item, action) => {
      if (resource === 'tickets') {
        const label = action.replaceAll('_', ' ');
        showDialog?.({
          actions: [
            {label: 'Cancel', tone: 'secondary'},
            {label: 'Confirm', onPress: () => runTicketAction(item, action)},
          ],
          message: `Confirm ${label}?`,
          title: 'Update ticket',
          tone: 'info',
        });
        return;
      }

      if (resource === 'orders') {
        showDialog?.({
          actions: [
            {label: 'Cancel', tone: 'secondary'},
            {label: 'Confirm', onPress: () => runOrderAction(item, action)},
          ],
          message: `Move this order to ${action}?`,
          title: 'Update order',
          tone: 'info',
        });
        return;
      }

      showDialog?.({
        message:
          'This quick action is visible for workflow planning, but the backend endpoint for this record type is not wired yet.',
        title: 'Action not available',
        tone: 'info',
      });
    },
    [runOrderAction, runTicketAction, showDialog],
  );

  const resetWorkspace = useCallback(() => {
    queryClient.removeQueries({queryKey: operationsQueryKeys.all});
    setActiveResource('tickets');
    setSearchQuery('');
    setExpandedRecordId(null);
  }, [queryClient]);

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

function errorDialog(title: string, details: string): DialogRequest {
  const message =
    details
      .split('\n')
      .map(line => line.trim())
      .find(Boolean) || 'The action could not be completed.';

  return {
    details,
    message,
    title,
    tone: 'error',
  };
}
