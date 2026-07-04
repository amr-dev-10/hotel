import {useCallback, useMemo, useState} from 'react';

import {formatErrorDetails} from '../../../services/api';
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
            error: formatErrorDetails(error, 'Unable to load data.'),
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
        const details = formatErrorDetails(error, 'Unable to update ticket.');
        showDialog?.(errorDialog('Ticket action failed', details));
      } finally {
        setActionLoading(null);
      }
    },
    [replaceResourceItem, session?.accessToken, session?.user.hotel_id, showDialog],
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
    [replaceResourceItem, session?.accessToken, session?.user.hotel_id, showDialog],
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
