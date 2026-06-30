"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Bot, Loader2, MessageCircle, Send, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useGuestChatMessages,
  useSendGuestChatMessage,
} from "@/features/guest-portal/hooks/useGuestPortal";
import { cn } from "@/lib/utils";
import type { GuestChatMessage } from "@/types/domain";

export function GuestChatWidget() {
  const [open, setOpen] = useState(false);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-32 z-40 mx-auto w-full max-w-3xl px-4">
      <div className="ml-auto flex w-full max-w-sm justify-end">
        {open ? (
          <ChatPanel onClose={() => setOpen(false)} />
        ) : (
          <button
            aria-label="Open chat"
            className="pointer-events-auto grid size-14 place-items-center rounded-full bg-[#0F3D91] text-white shadow-lg shadow-slate-900/20 transition hover:bg-[#0b2e6e] focus:outline-none focus:ring-2 focus:ring-[#0F3D91]/25"
            type="button"
            onClick={() => setOpen(true)}
          >
            <MessageCircle className="size-6" />
          </button>
        )}
      </div>
    </div>
  );
}

function ChatPanel({ onClose }: { onClose: () => void }) {
  const messages = useGuestChatMessages(true);
  const sendMessage = useSendGuestChatMessage();
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const chatMessages = messages.data ?? [];

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ block: "end" });
  }, [chatMessages.length, sendMessage.isPending]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || sendMessage.isPending) {
      return;
    }
    setDraft("");
    await sendMessage.mutateAsync(message, {
      onError: () => {
        setDraft(message);
        toast.error("Could not send chat message");
      },
    });
  }

  return (
    <section className="pointer-events-auto flex h-[min(70vh,34rem)] w-full flex-col overflow-hidden rounded-md border border-slate-200 bg-white shadow-2xl shadow-slate-900/20">
      <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-9 place-items-center rounded-full bg-[#0F3D91] text-white">
            <Bot className="size-4" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-slate-950">Arcadia chat</h2>
            <p className="truncate text-xs text-slate-500">Hotel assistance</p>
          </div>
        </div>
        <Button aria-label="Close chat" size="icon" type="button" variant="ghost" onClick={onClose}>
          <X />
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto bg-[#f7f8f4] px-3 py-4">
        {messages.isLoading ? (
          <div className="flex h-full items-center justify-center gap-2 text-sm text-slate-500">
            <Loader2 className="size-4 animate-spin" />
            Loading chat
          </div>
        ) : null}

        {messages.error ? (
          <div className="rounded-md border border-rose-100 bg-rose-50 p-3 text-sm text-rose-800">
            Chat is unavailable right now.
          </div>
        ) : null}

        {!messages.isLoading && !messages.error && !chatMessages.length ? <WelcomeMessage /> : null}

        <div className="grid gap-3">
          {chatMessages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
          {sendMessage.isPending ? <TypingBubble /> : null}
          <div ref={scrollRef} />
        </div>
      </div>

      <form className="flex items-center gap-2 border-t border-slate-200 bg-white p-3" onSubmit={handleSubmit}>
        <Input
          aria-label="Chat message"
          autoComplete="off"
          className="h-10"
          maxLength={4000}
          placeholder="Type a message"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <Button
          aria-label="Send chat message"
          className="h-10 w-10 shrink-0 px-0"
          disabled={!draft.trim() || sendMessage.isPending}
          type="submit"
        >
          {sendMessage.isPending ? <Loader2 className="animate-spin" /> : <Send />}
        </Button>
      </form>
    </section>
  );
}

function WelcomeMessage() {
  return (
    <div className="grid gap-3">
      <div className="max-w-[82%] rounded-md border border-slate-200 bg-white px-3 py-2 text-sm leading-5 text-slate-700 shadow-sm">
        Hello. How can I help you during your stay?
        <p className="mt-1 text-[11px] text-slate-400">Arcadia chat</p>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: GuestChatMessage }) {
  const isGuest = message.direction === "inbound";
  return (
    <div className={cn("flex", isGuest ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[82%] rounded-md px-3 py-2 text-sm leading-5 shadow-sm",
          isGuest
            ? "bg-[#0F3D91] text-white"
            : "border border-slate-200 bg-white text-slate-700",
        )}
      >
        <p className="whitespace-pre-wrap break-words">{message.message_text}</p>
        <p className={cn("mt-1 text-[11px]", isGuest ? "text-white/65" : "text-slate-400")}>
          {formatMessageTime(message.created_at)}
        </p>
      </div>
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 shadow-sm">
        <Loader2 className="size-4 animate-spin" />
        Thinking
      </div>
    </div>
  );
}

function formatMessageTime(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
