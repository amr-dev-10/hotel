"use client";

import { create } from "zustand";

import type { AppNotification } from "@/types/domain";

export interface DispatchTicket {
  id: string;
  hotel_id: string;
  ticket_code: string;
  item_description: string;
  stage: string;
  priority: number;
  room_id: string | null;
  room_number?: string | null;
  department_id: string | null;
  assigned_to: string | null;
  assigned_to_name?: string | null;
  source: string;
  reservation_id: string | null;
  conversation_id: string | null;
  created_at: string | null;
}

export interface DispatchAlertState {
  acceptance_id: string;
  notification_id?: string | null;
  ticket: DispatchTicket;
  expires_at?: string | null;
}

interface NotificationState {
  notifications: AppNotification[];
  activeDispatch: DispatchAlertState | null;
  setNotifications: (notifications: AppNotification[]) => void;
  addNotification: (notification: AppNotification) => void;
  markRead: (notificationId: string) => void;
  setActiveDispatch: (dispatch: DispatchAlertState | null) => void;
  clearDispatchForTicket: (ticketId: string) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  activeDispatch: null,
  setNotifications: (notifications) => set({ notifications }),
  addNotification: (notification) =>
    set((state) => ({
      notifications: [
        notification,
        ...state.notifications.filter((item) => item.id !== notification.id),
      ].slice(0, 50),
    })),
  markRead: (notificationId) =>
    set((state) => ({
      notifications: state.notifications.map((item) =>
        item.id === notificationId
          ? { ...item, status: "read", read_at: item.read_at ?? new Date().toISOString() }
          : item,
      ),
    })),
  setActiveDispatch: (dispatch) => set({ activeDispatch: dispatch }),
  clearDispatchForTicket: (ticketId) =>
    set((state) => ({
      activeDispatch:
        state.activeDispatch?.ticket.id === ticketId ? null : state.activeDispatch,
    })),
}));
