"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/api/query-keys";
import { useAuthStore } from "@/stores/auth.store";
import {
  type DispatchTicket,
  useNotificationStore,
} from "@/stores/notification.store";
import type { AppNotification } from "@/types/domain";

export function useWebSocket(hotelId: string) {
  const queryClient = useQueryClient();
  const token = useAuthStore((state) => state.token);
  const addNotification = useNotificationStore((state) => state.addNotification);
  const setActiveDispatch = useNotificationStore((state) => state.setActiveDispatch);
  const clearDispatchForTicket = useNotificationStore((state) => state.clearDispatchForTicket);

  useEffect(() => {
    if (!token || !hotelId) {
      return undefined;
    }

    const wsBase = process.env.NEXT_PUBLIC_WS_BASE_URL ?? "ws://localhost:8000";
    const socket = new WebSocket(`${wsBase}/ws/notifications?token=${encodeURIComponent(token)}`);

    socket.onmessage = (message) => {
      try {
        const event = JSON.parse(message.data) as Record<string, unknown>;

        if (event.event === "notification" && isAppNotification(event.notification)) {
          addNotification(event.notification);
          const dispatch = dispatchFromNotification(event.notification);
          if (dispatch) {
            setActiveDispatch(dispatch);
          }
          queryClient.invalidateQueries({ queryKey: queryKeys.notifications(hotelId) });
          return;
        }

        if (
          event.event === "ticket_dispatch" &&
          isDispatchTicket(event.ticket) &&
          typeof event.acceptance_id === "string"
        ) {
          setActiveDispatch({
            acceptance_id: event.acceptance_id,
            notification_id: typeof event.notification_id === "string" ? event.notification_id : undefined,
            ticket: event.ticket,
            expires_at: typeof event.expires_at === "string" ? event.expires_at : undefined,
          });
          queryClient.invalidateQueries({ queryKey: queryKeys.tickets.all(hotelId) });
          return;
        }

        if (
          (event.event === "ticket_assigned" || event.event === "ticket_escalated") &&
          typeof event.ticket_id === "string"
        ) {
          clearDispatchForTicket(event.ticket_id);
          queryClient.invalidateQueries({ queryKey: queryKeys.tickets.all(hotelId) });
          queryClient.invalidateQueries({ queryKey: queryKeys.notifications(hotelId) });
        }
      } catch {
        queryClient.invalidateQueries({ queryKey: queryKeys.notifications(hotelId) });
      }
    };

    return () => {
      socket.close();
    };
  }, [addNotification, clearDispatchForTicket, hotelId, queryClient, setActiveDispatch, token]);
}

function isAppNotification(value: unknown): value is AppNotification {
  return Boolean(
    value &&
      typeof value === "object" &&
      "id" in value &&
      "hotel_id" in value &&
      "title" in value &&
      "message" in value,
  );
}

function isDispatchTicket(value: unknown): value is DispatchTicket {
  return Boolean(
    value &&
      typeof value === "object" &&
      "id" in value &&
      "ticket_code" in value &&
      "item_description" in value,
  );
}

function dispatchFromNotification(notification: AppNotification) {
  if (notification.metadata?.event !== "ticket_dispatch") {
    return null;
  }
  const ticket = notification.metadata.ticket as DispatchTicket | undefined;
  const acceptanceId = notification.metadata.acceptance_id;
  if (!ticket || typeof acceptanceId !== "string") {
    return null;
  }
  return {
    acceptance_id: acceptanceId,
    notification_id: notification.id,
    ticket,
    expires_at: typeof notification.metadata.expires_at === "string" ? notification.metadata.expires_at : null,
  };
}
