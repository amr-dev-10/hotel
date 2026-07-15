import {create} from 'zustand';

import type {ArcadiaRecord} from '../types/domain';

export type AppNotification = {
  body?: string | null;
  created_at?: string | null;
  hotel_id?: string | null;
  id: string;
  message?: string | null;
  metadata?: ArcadiaRecord | null;
  notification_type?: string | null;
  read_at?: string | null;
  status?: string | null;
  title?: string | null;
  type?: string | null;
};

export type DispatchTicket = {
  assigned_to?: string | null;
  assigned_to_name?: string | null;
  conversation_id?: string | null;
  created_at?: string | null;
  department_id?: string | null;
  hotel_id?: string;
  id: string;
  item_description?: string | null;
  priority?: number | string | null;
  reservation_id?: string | null;
  room_id?: string | null;
  room_number?: string | null;
  source?: string | null;
  stage?: string | null;
  ticket_code?: string | null;
  title?: string | null;
};

export type DispatchAlertState = {
  acceptance_id: string;
  expires_at?: string | null;
  notification_id?: string | null;
  ticket: DispatchTicket;
};

export type EscalationAlertState = {
  created_at?: string | null;
  id: string;
  message: string;
  priority?: string | null;
  room_number?: string | null;
  ticket_id?: string | null;
  title: string;
};

type ConnectionState = 'connected' | 'connecting' | 'disconnected' | 'error';

type NotificationState = {
  activeDispatch: DispatchAlertState | null;
  activeEscalationAlert: EscalationAlertState | null;
  connectionState: ConnectionState;
  lastToast: AppNotification | null;
  notifications: AppNotification[];
  unreadCount: number;
  addNotification: (notification: AppNotification) => void;
  clear: () => void;
  clearEscalationAlert: () => void;
  clearDispatchForTicket: (ticketId: string) => void;
  markRead: (notificationId: string) => void;
  setActiveDispatch: (dispatch: DispatchAlertState | null) => void;
  setActiveEscalationAlert: (alert: EscalationAlertState | null) => void;
  setConnectionState: (connectionState: ConnectionState) => void;
  setNotifications: (notifications: AppNotification[]) => void;
};

export const useNotificationStore = create<NotificationState>(set => ({
  activeDispatch: null,
  activeEscalationAlert: null,
  connectionState: 'disconnected',
  lastToast: null,
  notifications: [],
  unreadCount: 0,
  addNotification: notification =>
    set(state => {
      const notifications = [
        notification,
        ...state.notifications.filter(item => item.id !== notification.id),
      ].slice(0, 75);

      return {
        lastToast: notification,
        notifications,
        unreadCount: unreadCount(notifications),
      };
    }),
  clear: () =>
    set({
      activeDispatch: null,
      activeEscalationAlert: null,
      lastToast: null,
      notifications: [],
      unreadCount: 0,
    }),
  clearEscalationAlert: () => set({activeEscalationAlert: null}),
  clearDispatchForTicket: ticketId =>
    set(state => ({
      activeDispatch:
        state.activeDispatch?.ticket.id === ticketId
          ? null
          : state.activeDispatch,
    })),
  markRead: notificationId =>
    set(state => {
      const notifications = state.notifications.map(item =>
        item.id === notificationId
          ? {...item, read_at: item.read_at ?? new Date().toISOString(), status: 'read'}
          : item,
      );

      return {
        notifications,
        unreadCount: unreadCount(notifications),
      };
    }),
  setActiveDispatch: activeDispatch => set({activeDispatch}),
  setActiveEscalationAlert: activeEscalationAlert =>
    set(state => ({
      activeEscalationAlert:
        state.activeEscalationAlert?.id === activeEscalationAlert?.id
          ? state.activeEscalationAlert
          : activeEscalationAlert,
    })),
  setConnectionState: connectionState => set({connectionState}),
  setNotifications: notifications =>
    set({
      notifications,
      unreadCount: unreadCount(notifications),
    }),
}));

function unreadCount(notifications: AppNotification[]) {
  return notifications.filter(
    item => item.status !== 'read' && !item.read_at,
  ).length;
}
