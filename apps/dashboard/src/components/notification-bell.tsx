"use client";

import { useEffect } from "react";
import { Bell, CheckCheck, ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMarkNotificationRead, useNotifications } from "@/features/notifications/hooks/useNotifications";
import { cn, titleCase } from "@/lib/utils";
import { useNotificationStore } from "@/stores/notification.store";
import type { AppNotification } from "@/types/domain";

export function NotificationBell({ hotelId, triggerClassName }: { hotelId: string; triggerClassName?: string }) {
  const router = useRouter();
  const notificationsQuery = useNotifications(hotelId);
  const markRead = useMarkNotificationRead(hotelId);
  const notifications = useNotificationStore((state) => state.notifications);
  const setNotifications = useNotificationStore((state) => state.setNotifications);
  const markReadInStore = useNotificationStore((state) => state.markRead);
  const unread = notifications.filter((item) => !item.read_at && item.status !== "read");

  useEffect(() => {
    if (notificationsQuery.data) {
      setNotifications(notificationsQuery.data);
    }
  }, [notificationsQuery.data, setNotifications]);

  async function openNotification(notification: AppNotification) {
    markReadInStore(notification.id);
    await markRead.mutateAsync(notification.id).catch(() => undefined);
    const ticketId = notification.reference_id ?? stringMeta(notification, "ticket_id");
    const conversationId = stringMeta(notification, "conversation_id");
    if (ticketId) {
      router.push(`/${hotelId}/tickets/${ticketId}`);
      return;
    }
    if (conversationId) {
      router.push(`/${hotelId}/whatsapp?c=${conversationId}`);
    }
  }

  async function markAllRead() {
    for (const notification of unread) {
      markReadInStore(notification.id);
      await markRead.mutateAsync(notification.id).catch(() => undefined);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label="Notifications"
          className={cn("relative", triggerClassName)}
          data-tooltip="Notifications"
          size="icon"
          type="button"
          variant="ghost"
        >
          <Bell />
          {unread.length ? (
            <span className="absolute -right-1 -top-1 flex min-w-5 justify-center rounded-full bg-[var(--destructive)] px-1 text-xs font-semibold leading-5 text-white shadow-[var(--shadow-control)]">
              {unread.length}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[22rem] p-2">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-2 pb-2">
          <div>
            <p className="text-sm font-semibold">Notifications</p>
            <p className="text-xs text-[var(--muted)]">{unread.length} unread</p>
          </div>
          <Button disabled={!unread.length || markRead.isPending} size="sm" type="button" variant="ghost" onClick={markAllRead}>
            <CheckCheck />
            Read all
          </Button>
        </div>
        <div className="max-h-[24rem] overflow-y-auto py-2">
          {notifications.length ? (
            notifications.slice(0, 8).map((notification) => (
              <DropdownMenuItem
                className="flex cursor-pointer items-start gap-3 rounded-md p-3"
                key={notification.id}
                onClick={() => openNotification(notification)}
              >
                <span
                  className={cn(
                    "mt-1 size-2 shrink-0 rounded-full",
                    notification.read_at || notification.status === "read" ? "bg-[var(--border-strong)]" : "bg-[var(--primary)]",
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{notification.title}</span>
                    <Badge variant={typeVariant(notification.notification_type)}>
                      {titleCase(notification.notification_type)}
                    </Badge>
                  </span>
                  <span className="mt-1 line-clamp-2 text-xs text-[var(--muted)]">{notification.message}</span>
                </span>
                <ExternalLink className="mt-0.5 size-3.5 text-[var(--muted)]" />
              </DropdownMenuItem>
            ))
          ) : (
            <p className="px-3 py-6 text-center text-sm text-[var(--muted)]">No notifications yet.</p>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function stringMeta(notification: AppNotification, key: string) {
  const value = notification.metadata?.[key];
  return typeof value === "string" ? value : null;
}

function typeVariant(type: string) {
  if (type === "dispatch") {
    return "blue";
  }
  if (type === "escalation") {
    return "rose";
  }
  if (type === "approval_required") {
    return "amber";
  }
  return "default";
}
