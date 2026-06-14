"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { MessageCircle, Settings } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataState } from "@/components/ui/data-state";
import { compactId, titleCase } from "@/lib/utils";
import { useWhatsappConversations } from "@/features/whatsapp/hooks/useWhatsapp";

export function WhatsAppInboxPage({ hotelId }: { hotelId: string }) {
  const conversations = useWhatsappConversations(hotelId);

  if (conversations.isLoading) {
    return <DataState isLoading />;
  }

  if (conversations.error) {
    return <DataState error={conversations.error} />;
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-semibold">WhatsApp Inbox</h2>
          <p className="text-sm text-slate-500">Guest conversation history from Meta WhatsApp.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild type="button" variant="secondary">
            <Link href={`/${hotelId}/whatsapp/templates`}>Templates</Link>
          </Button>
          <Button asChild type="button">
            <Link href={`/${hotelId}/whatsapp/settings`}>
              <Settings />
              Settings
            </Link>
          </Button>
        </div>
      </div>

      {!conversations.data?.length ? (
        <DataState empty emptyTitle="No WhatsApp conversations yet." />
      ) : (
        <div className="grid gap-3">
          {conversations.data.map((conversation) => (
            <Link
              className="grid gap-2 rounded-md border border-slate-200 bg-white p-4 transition-colors hover:border-[#0F3D91]"
              href={`/${hotelId}/whatsapp/conversations/${conversation.id}`}
              key={conversation.id}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="flex items-center gap-2 truncate text-base font-semibold">
                    <MessageCircle className="size-4 text-[#0F3D91]" />
                    {conversation.phone}
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">Guest {compactId(conversation.guest_id)}</p>
                </div>
                <Badge variant={conversation.status === "open" ? "green" : "default"}>
                  {titleCase(conversation.status)}
                </Badge>
              </div>
              <p className="text-xs text-slate-500">
                {conversation.last_message_at
                  ? `Last message ${formatDistanceToNow(new Date(conversation.last_message_at), { addSuffix: true })}`
                  : "No messages recorded"}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
