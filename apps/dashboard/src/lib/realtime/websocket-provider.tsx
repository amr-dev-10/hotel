"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { queryKeys } from "@/lib/api/query-keys";
import { useAuthStore } from "@/stores/auth.store";

interface WebSocketProviderProps {
  children: React.ReactNode;
}

export function WebSocketProvider({ children }: WebSocketProviderProps) {
  const queryClient = useQueryClient();
  const token = useAuthStore((state) => state.token);
  const hotelId = useAuthStore((state) => state.currentHotelId);

  useEffect(() => {
    if (!token || !hotelId) {
      return undefined;
    }

    const wsBase = process.env.NEXT_PUBLIC_WS_BASE_URL ?? "ws://localhost:8000";
    const socket = new WebSocket(`${wsBase}/ws/tickets?token=${encodeURIComponent(token)}`);

    socket.onmessage = (message) => {
      try {
        const event = JSON.parse(message.data) as {
          event?: string;
          type?: string;
          ticket_id?: string;
          stage?: string;
          item?: string;
        };
        const eventName = event.type ?? event.event ?? "";

        if (eventName.startsWith("ticket.")) {
          queryClient.invalidateQueries({ queryKey: queryKeys.tickets.all(hotelId) });
        }

        if (eventName === "ticket.created") {
          toast.success("New ticket received", {
            description: event.item ?? event.ticket_id,
          });
        }

        if (eventName === "ticket.escalated") {
          toast.error("Ticket escalated", {
            description: event.ticket_id,
          });
        }
      } catch {
        queryClient.invalidateQueries({ queryKey: queryKeys.tickets.all(hotelId) });
      }
    };

    socket.onerror = () => {
      toast.warning("Live updates are reconnecting");
    };

    return () => {
      socket.close();
    };
  }, [hotelId, queryClient, token]);

  return children;
}
