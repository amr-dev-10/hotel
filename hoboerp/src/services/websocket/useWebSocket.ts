import {useEffect} from 'react';

import type {AppDialogRequest} from '../../components/AppDialog';
import {featureFlags} from '../../config/featureFlags';
import type {ResourceKey} from '../../modules/operations/types';
import {
  type AppNotification,
  type DispatchAlertState,
  type DispatchTicket,
  useNotificationStore,
} from '../../store/notificationStore';
import {WebSocketEvents} from './channels';
import {mobileWebSocketClient} from './WebSocketClient';

type Options = {
  hotelId?: string | null;
  onRefreshResource?: (resource: ResourceKey) => void;
  onShowDialog?: (dialog: AppDialogRequest) => void;
  token?: string | null;
};

export function useMobileWebSocket({
  hotelId,
  onRefreshResource,
  onShowDialog,
  token,
}: Options) {
  useEffect(() => {
    if (!token || !hotelId || !featureFlags.enableRealtimeSockets) {
      mobileWebSocketClient.disconnect();
      useNotificationStore.getState().setConnectionState('disconnected');
      return undefined;
    }

    useNotificationStore.getState().setConnectionState('connecting');
    mobileWebSocketClient.connect(token);

    const unsubscribers = [
      mobileWebSocketClient.onEvent(WebSocketEvents.CONNECTION_ACK, () => {
        useNotificationStore.getState().setConnectionState('connected');
      }),
      mobileWebSocketClient.onEvent('*', payload => {
        if (payload.event === 'socket_error') {
          useNotificationStore.getState().setConnectionState('error');
        }
      }),
      mobileWebSocketClient.onEvent(WebSocketEvents.NOTIFICATION, payload => {
        const notification = notificationFromPayload(payload);
        if (!notification) {
          return;
        }

        useNotificationStore.getState().addNotification(notification);
        const dispatch = dispatchFromNotification(notification);
        if (dispatch) {
          useNotificationStore.getState().setActiveDispatch(dispatch);
        }
        onRefreshResource?.('notifications');
      }),
      mobileWebSocketClient.onEvent(WebSocketEvents.TICKET_DISPATCH, payload => {
        const dispatch = dispatchFromPayload(payload);
        if (!dispatch) {
          return;
        }

        useNotificationStore.getState().setActiveDispatch(dispatch);
        onRefreshResource?.('tickets');
        onRefreshResource?.('escalations');
      }),
      mobileWebSocketClient.onEvent(WebSocketEvents.TICKET_ASSIGNED, payload => {
        clearDispatchFromPayload(payload);
        onRefreshResource?.('tickets');
        onRefreshResource?.('notifications');
      }),
      mobileWebSocketClient.onEvent(WebSocketEvents.TICKET_ESCALATED, payload => {
        clearDispatchFromPayload(payload);
        onRefreshResource?.('tickets');
        onRefreshResource?.('escalations');
        onRefreshResource?.('notifications');
      }),
    ];

    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
      mobileWebSocketClient.disconnect();
      useNotificationStore.getState().setConnectionState('disconnected');
    };
  }, [hotelId, onRefreshResource, onShowDialog, token]);
}

function clearDispatchFromPayload(payload: Record<string, unknown>) {
  if (typeof payload.ticket_id === 'string') {
    useNotificationStore.getState().clearDispatchForTicket(payload.ticket_id);
  }
}

function dispatchFromNotification(
  notification: AppNotification,
): DispatchAlertState | null {
  if (notification.metadata?.event !== WebSocketEvents.TICKET_DISPATCH) {
    return null;
  }

  const ticket = notification.metadata.ticket;
  const acceptanceId = notification.metadata.acceptance_id;
  if (!isDispatchTicket(ticket) || typeof acceptanceId !== 'string') {
    return null;
  }

  return {
    acceptance_id: acceptanceId,
    expires_at:
      typeof notification.metadata.expires_at === 'string'
        ? notification.metadata.expires_at
        : null,
    notification_id: notification.id,
    ticket,
  };
}

function dispatchFromPayload(
  payload: Record<string, unknown>,
): DispatchAlertState | null {
  if (
    typeof payload.acceptance_id !== 'string' ||
    !isDispatchTicket(payload.ticket)
  ) {
    return null;
  }

  return {
    acceptance_id: payload.acceptance_id,
    expires_at:
      typeof payload.expires_at === 'string' ? payload.expires_at : null,
    notification_id:
      typeof payload.notification_id === 'string'
        ? payload.notification_id
        : null,
    ticket: payload.ticket,
  };
}

function isDispatchTicket(value: unknown): value is DispatchTicket {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'id' in value &&
      ('ticket_code' in value || 'title' in value || 'item_description' in value),
  );
}

function notificationFromPayload(
  payload: Record<string, unknown>,
): AppNotification | null {
  const notification = payload.notification;
  if (
    notification &&
    typeof notification === 'object' &&
    'id' in notification
  ) {
    return notification as AppNotification;
  }

  if (typeof payload.id === 'string') {
    return payload as AppNotification;
  }

  return null;
}
