"use client";

import Link from "next/link";
import { format } from "date-fns";
import { ArrowLeft } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataState } from "@/components/ui/data-state";
import { cn, titleCase } from "@/lib/utils";
import { useWhatsappMessages } from "@/features/whatsapp/hooks/useWhatsapp";

export function WhatsAppConversationPage({
  hotelId,
  conversationId,
}: {
  hotelId: string;
  conversationId: string;
}) {
  const messages = useWhatsappMessages(hotelId, conversationId);

  if (messages.isLoading) {
    return <DataState isLoading />;
  }

  if (messages.error) {
    return <DataState error={messages.error} />;
  }

  return (
    <div className="grid gap-5">
      <div>
        <Button asChild type="button" variant="ghost">
          <Link href={`/${hotelId}/whatsapp`}>
            <ArrowLeft />
            Inbox
          </Link>
        </Button>
        <h2 className="mt-2 text-xl font-semibold">Conversation</h2>
        <p className="text-sm text-slate-500">{conversationId}</p>
      </div>

      {!messages.data?.length ? (
        <DataState empty emptyTitle="No messages in this conversation yet." />
      ) : (
        <section className="grid gap-3 rounded-md border border-slate-200 bg-white p-4">
          {messages.data.map((message) => {
            const outbound = message.direction === "outbound";
            return (
              <div
                className={cn(
                  "flex",
                  outbound ? "justify-end" : "justify-start",
                )}
                key={message.id}
              >
                <div
                  className={cn(
                    "max-w-[720px] rounded-md border px-4 py-3 text-sm",
                    outbound
                      ? "border-[#0F3D91] bg-[#0F3D91] text-white"
                      : "border-slate-200 bg-slate-50 text-slate-900",
                  )}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <Badge variant={outbound ? "default" : "blue"}>{titleCase(message.direction)}</Badge>
                    <span className={cn("text-xs", outbound ? "text-white/80" : "text-slate-500")}>
                      {format(new Date(message.created_at), "dd MMM, HH:mm")}
                    </span>
                  </div>
                  <p>{message.message_text ?? titleCase(message.message_type)}</p>
                  <p className={cn("mt-2 text-xs", outbound ? "text-white/80" : "text-slate-500")}>
                    {titleCase(message.status)}
                  </p>
                </div>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
