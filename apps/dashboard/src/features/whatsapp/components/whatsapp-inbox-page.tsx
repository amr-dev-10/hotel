"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import { 
  MessageCircle, Settings, Search, Phone, User, 
  Loader2, Send, CheckCircle, Clock, MapPin, 
  Ticket, Paperclip, Mic, Image as ImageIcon, FileText,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataState } from "@/components/ui/data-state";
import { cn, titleCase, compactId } from "@/lib/utils";
import { 
  useWhatsappConversations, 
  useWhatsappMessages, 
  useSendWhatsappMessage,
  useUpdateWhatsappConversation
} from "@/features/whatsapp/hooks/useWhatsapp";
import { useGuest, useGuests, useGuestConversation } from "@/features/guests/hooks/useGuests";
import { useTickets } from "@/features/tickets/hooks/useTickets";
import { useReservation } from "@/features/reservations/hooks/useReservations";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function WhatsAppInboxPage({ hotelId }: { hotelId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeConversationId = searchParams.get("c");
  const guestQueryParam = searchParams.get("guest");
  const reservationQueryParam = searchParams.get("reservation");

  const conversations = useWhatsappConversations(hotelId);
  const allGuests = useGuests(hotelId);
  const autoConversation = useGuestConversation(hotelId, (guestQueryParam && !activeConversationId) ? guestQueryParam : "");
  const activeReservationId = reservationQueryParam || autoConversation.data?.reservation_id || "";
  const reservationQuery = useReservation(hotelId, activeReservationId);

  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");

  useEffect(() => {
    if (autoConversation.data?.conversation_id && !activeConversationId) {
      router.replace(`/${hotelId}/whatsapp?c=${autoConversation.data.conversation_id}${activeReservationId ? `&reservation=${activeReservationId}` : ""}`);
    }
  }, [autoConversation.data, activeConversationId, router, hotelId, activeReservationId]);

  const filteredConversations = useMemo(() => {
    if (!conversations.data) return [];
    let filtered = conversations.data;

    // Apply Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (c) => c.phone.includes(q) || (c.guest_id && c.guest_id.toLowerCase().includes(q))
      );
    }

    // Apply Filter
    if (activeFilter === "unread") {
      filtered = filtered.filter((c) => (c as any).unread_count > 0);
    } else if (activeFilter === "open") {
      filtered = filtered.filter((c) => c.status === "open");
    } else if (activeFilter === "vip") {
      // Mock VIP filter until guest VIP status is pulled into conversation
      filtered = filtered.filter((c) => false); 
    } else if (activeFilter === "mine") {
      filtered = filtered.filter((c) => false); // Mock until assigned_staff_id is populated
    }

    return filtered;
  }, [conversations.data, searchQuery, activeFilter]);

  const selectedConversation = conversations.data?.find((c) => c.id === activeConversationId);

  // If a conversation is selected, fetch messages and guest info
  const messagesQuery = useWhatsappMessages(hotelId, activeConversationId || "");
  const guestQuery = useGuest(hotelId, selectedConversation?.guest_id || "");
  const ticketsQuery = useTickets(hotelId, selectedConversation?.guest_id ? { guest_id: selectedConversation.guest_id } : {});

  const sendMessage = useSendWhatsappMessage(hotelId, activeConversationId || "");
  const updateConversation = useUpdateWhatsappConversation(hotelId, activeConversationId || "");
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messagesQuery.data?.length) {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messagesQuery.data]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || !activeConversationId) return;

    try {
      await sendMessage.mutateAsync({ message: text });
      setText("");
    } catch (error) {
      toast.error("Failed to send message");
    }
  }

  if (conversations.isLoading) return <DataState isLoading />;
  if (conversations.error) return <DataState error={conversations.error} />;

  // Mocks for UI Demo
  const unreadCount = conversations.data?.filter(c => (c as any).unread_count > 0).length || 0;
  const openCount = conversations.data?.filter(c => c.status === "open").length || 0;

  return (
    <div className="flex h-[85vh] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      
      {/* LEFT PANE: CONVERSATION LIST */}
      <div className="flex w-1/4 min-w-[300px] flex-col border-r border-slate-200 bg-slate-50/50">
        <div className="border-b border-slate-200 p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800">Inbox</h2>
            <div className="flex gap-1">
              <Button asChild title="Templates" size="icon" variant="ghost" className="size-8">
                <Link href={`/${hotelId}/whatsapp/templates`}><FileText className="size-4" /></Link>
              </Button>
              <Button asChild title="Settings" size="icon" variant="ghost" className="size-8">
                <Link href={`/${hotelId}/whatsapp/settings`}><Settings className="size-4" /></Link>
              </Button>
            </div>
          </div>
          
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input 
              placeholder="Search guests, phones..." 
              className="pl-9 h-9" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-1">
            <FilterButton active={activeFilter === "all"} onClick={() => setActiveFilter("all")}>
              All <span className="text-xs text-slate-400">({conversations.data?.length})</span>
            </FilterButton>
            <FilterButton active={activeFilter === "unread"} onClick={() => setActiveFilter("unread")}>
              Unread <span className="text-xs text-slate-400">({unreadCount})</span>
            </FilterButton>
            <FilterButton active={activeFilter === "open"} onClick={() => setActiveFilter("open")}>
              Open <span className="text-xs text-slate-400">({openCount})</span>
            </FilterButton>
            <FilterButton active={activeFilter === "vip"} onClick={() => setActiveFilter("vip")}>
              VIP <span className="text-xs text-slate-400">(0)</span>
            </FilterButton>
            <FilterButton active={activeFilter === "mine"} onClick={() => setActiveFilter("mine")}>
              Mine <span className="text-xs text-slate-400">(0)</span>
            </FilterButton>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {!filteredConversations?.length ? (
            <div className="p-4 text-center text-sm text-slate-500">No conversations found.</div>
          ) : (
            filteredConversations.map((conversation) => {
              const isActive = conversation.id === activeConversationId;
              const unread = (conversation as any).unread_count || 0;
              const isVIP = (conversation as any).priority === "high" || (conversation as any).priority === "urgent";
              return (
                <button
                  key={conversation.id}
                  onClick={() => router.push(`/${hotelId}/whatsapp?c=${conversation.id}`)}
                  className={cn(
                    "mb-1 flex w-full flex-col gap-1 rounded-md p-3 text-left transition-colors",
                    isActive ? "bg-slate-200/60 ring-1 ring-slate-300" : "hover:bg-slate-100"
                  )}
                >
                  <div className="flex items-start justify-between">
                    <h3 className="flex items-center gap-2 truncate text-sm font-semibold">
                      {conversation.guest_id ? (allGuests.data?.find((g) => g.id === conversation.guest_id)?.name || "Unknown Guest") : conversation.phone}
                      {isVIP && <Badge variant="destructive" className="h-4 text-[10px] px-1">VIP</Badge>}
                    </h3>
                    <span className="shrink-0 text-xs text-slate-500">
                      {conversation.last_message_at ? formatDistanceToNow(new Date(conversation.last_message_at), { addSuffix: true }).replace('about ', '') : 'New'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="truncate text-xs text-slate-500">{conversation.guest_id ? conversation.phone : "Unlinked"}</p>
                    {unread > 0 ? (
                      <span className="flex size-5 items-center justify-center rounded-full bg-[#0F3D91] text-[10px] font-bold text-white">
                        {unread}
                      </span>
                    ) : (
                      <Badge variant={conversation.status === "open" ? "green" : "default"} className="text-[10px] h-4">
                        {titleCase(conversation.status)}
                      </Badge>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* MIDDLE PANE: CHAT HISTORY */}
      <div className="flex flex-1 flex-col bg-[#E5E5E5]/20 relative">
        {!activeConversationId || !selectedConversation ? (
          <div className="flex h-full flex-col items-center justify-center text-slate-400">
            <MessageCircle className="mb-4 size-12 opacity-20" />
            <p>Select a conversation to start chatting</p>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">
              <div>
                <h3 className="font-semibold text-slate-800">
                  {guestQuery.data?.name || selectedConversation.phone}
                  {(selectedConversation as any).priority === "urgent" && <Badge variant="destructive" className="ml-2">Urgent</Badge>}
                </h3>
                <p className="text-xs text-slate-500">
                  Assigned to: {(selectedConversation as any).assigned_staff_id ? "Staff" : "Unassigned"} • 
                  Status: {titleCase(selectedConversation.status)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline" className="h-8 text-xs">Priority</Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => updateConversation.mutate({ priority: "low" })}>Low</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => updateConversation.mutate({ priority: "normal" })}>Normal</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => updateConversation.mutate({ priority: "high" })}>High</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => updateConversation.mutate({ priority: "urgent" })}>Urgent</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline" className="h-8 text-xs">Transfer</Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => updateConversation.mutate({ assigned_staff_id: "staff_1" })}>Assign to me</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => updateConversation.mutate({ assigned_staff_id: null })}>Unassign</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {selectedConversation.status === "open" ? (
                  <Button 
                    size="sm" 
                    className="h-8 text-xs bg-green-600 hover:bg-green-700"
                    onClick={() => updateConversation.mutate({ status: "resolved" })}
                  >
                    Resolve
                  </Button>
                ) : (
                  <Button 
                    size="sm" 
                    variant="outline"
                    className="h-8 text-xs"
                    onClick={() => updateConversation.mutate({ status: "open" })}
                  >
                    Re-open
                  </Button>
                )}
              </div>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-6" style={{ backgroundImage: "url('/whatsapp-bg.png')", opacity: 0.95 }}>
              {messagesQuery.isLoading ? (
                <div className="flex justify-center p-4"><Loader2 className="animate-spin text-slate-400" /></div>
              ) : !messagesQuery.data?.length ? (
                <div className="text-center text-sm text-slate-500 bg-white/80 p-2 rounded max-w-xs mx-auto">No messages yet.</div>
              ) : (
                <div className="grid gap-3">
                  {messagesQuery.data.map((message) => {
                    const outbound = message.direction === "outbound";
                    return (
                      <div className={cn("flex", outbound ? "justify-end" : "justify-start")} key={message.id}>
                        <div className={cn(
                          "max-w-[70%] rounded-lg px-4 py-2 text-sm shadow-sm",
                          outbound ? "bg-[#D9FDD3] text-slate-900 rounded-tr-none" : "bg-white text-slate-900 rounded-tl-none border border-slate-100"
                        )}>
                          <p>{message.message_text ?? titleCase(message.message_type)}</p>
                          <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-slate-500">
                            {format(new Date(message.created_at), "HH:mm")}
                            {outbound && <CheckCircle className="size-3" />}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={endRef} />
                </div>
              )}
            </div>

            {/* Chat Input */}
            <form onSubmit={handleSend} className="shrink-0 bg-slate-100 px-4 py-3 border-t border-slate-200">
              <div className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 shadow-sm border border-slate-200">
                <button type="button" className="p-2 text-slate-400 hover:text-slate-600"><Paperclip className="size-5" /></button>
                <button type="button" className="p-2 text-slate-400 hover:text-slate-600"><ImageIcon className="size-5" /></button>
                <button type="button" className="p-2 text-slate-400 hover:text-slate-600"><FileText className="size-5" /></button>
                
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 bg-transparent px-2 text-sm outline-none"
                  disabled={sendMessage.isPending}
                />
                
                {text.trim() ? (
                  <button type="submit" disabled={sendMessage.isPending} className="p-2 text-[#0F3D91] hover:text-[#0a2a66]">
                    {sendMessage.isPending ? <Loader2 className="animate-spin size-5" /> : <Send className="size-5" />}
                  </button>
                ) : (
                  <button type="button" className="p-2 text-slate-400 hover:text-slate-600"><Mic className="size-5" /></button>
                )}
              </div>
            </form>
          </>
        )}
      </div>

      {/* RIGHT PANE: CONTEXT */}
      <div className="flex w-[320px] flex-col border-l border-slate-200 bg-white">
        {!activeConversationId || !selectedConversation ? (
          <div className="flex h-full items-center justify-center p-4 text-center text-sm text-slate-400">
            Select a conversation to view context
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            
            {/* 1. GUEST CARD */}
            <div className="rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="bg-[#0F3D91] p-4 text-white">
                <div className="flex items-center gap-3">
                  <div className="flex size-12 items-center justify-center rounded-full bg-white/20 text-xl font-semibold">
                    {guestQuery.data?.name?.[0]?.toUpperCase() || <User className="size-6" />}
                  </div>
                  <div>
                    <h3 className="font-semibold">{guestQuery.data?.name || selectedConversation.phone}</h3>
                    {guestQuery.data?.phone && <p className="text-sm text-white/80">{guestQuery.data.phone}</p>}
                  </div>
                </div>
              </div>
              <div className="p-4 bg-white grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Status</p>
                  <Badge variant={guestQuery.data?.status === 'checked_in' ? 'green' : 'secondary'} className="text-[10px]">
                    {guestQuery.data ? titleCase(guestQuery.data.status) : "Unknown"}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Lifetime</p>
                  <p className="text-sm font-semibold text-slate-800">4 Stays</p>
                </div>
                <div className="col-span-2">
                  <Button asChild variant="outline" className="w-full text-xs h-8">
                    <Link href={`/${hotelId}/guests/${selectedConversation.guest_id || ""}`}>
                      View Full Profile
                    </Link>
                  </Button>
                </div>
              </div>
            </div>

            {/* 2. RESERVATION CONTEXT */}
            {reservationQuery.isLoading ? (
              <DataState isLoading />
            ) : reservationQuery.data ? (
              <div>
                <h4 className="mb-2 text-xs font-bold uppercase text-slate-500 flex items-center gap-2"><MapPin className="size-4" /> Reservation Context</h4>
                <div className="rounded-lg border border-slate-200 p-3 bg-blue-50/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-slate-800">{reservationQuery.data.reservation_no}</span>
                    <Badge variant={reservationQuery.data.status === 'checked_in' ? 'green' : 'blue'}>{titleCase(reservationQuery.data.status)}</Badge>
                  </div>
                  <div className="space-y-2 text-sm text-slate-600">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Room</span>
                      <span className="font-medium text-slate-900">{reservationQuery.data.room_id ? compactId(reservationQuery.data.room_id) : "Unassigned"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Stay</span>
                      <span className="font-medium text-slate-900">{format(new Date(reservationQuery.data.checkin_date), "MMM d")} → {format(new Date(reservationQuery.data.checkout_date), "MMM d")}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Occupants</span>
                      <span className="font-medium text-slate-900">{reservationQuery.data.adults} Adults, {reservationQuery.data.children} Children</span>
                    </div>
                    {reservationQuery.data.notes && (
                      <div className="pt-1 mt-1 border-t border-slate-200">
                        <span className="text-xs text-slate-500 block mb-1">Special Requests</span>
                        <p className="text-xs font-medium text-slate-800">{reservationQuery.data.notes}</p>
                      </div>
                    )}
                  </div>
                  <Button asChild variant="secondary" className="w-full mt-3 h-8 text-xs bg-white">
                    <Link href={`/${hotelId}/reservations/${reservationQuery.data.id}`}>
                      Open Reservation
                    </Link>
                  </Button>
                </div>
              </div>
            ) : null}

            {/* 3. INTERNAL NOTES */}
            {guestQuery.data && (
              <div>
                <h4 className="mb-2 text-xs font-bold uppercase text-slate-500 flex items-center gap-2"><AlertCircle className="size-4" /> Internal Notes</h4>
                <div className="rounded-lg border border-slate-200 p-3 bg-yellow-50/50">
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">
                    {guestQuery.data.internal_notes || "No internal notes for this guest."}
                  </p>
                </div>
              </div>
            )}
            
          </div>
        )}
      </div>
    </div>
  );
}

// Helper component for filter pills
function FilterButton({ active, onClick, children }: { active: boolean, onClick: () => void, children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1 text-xs font-medium transition-colors",
        active ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
      )}
    >
      {children}
    </button>
  );
}
