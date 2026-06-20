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
  useSendWhatsappMessage 
} from "@/features/whatsapp/hooks/useWhatsapp";
import { useGuest } from "@/features/guests/hooks/useGuests";
import { useTickets } from "@/features/tickets/hooks/useTickets";

export function WhatsAppInboxPage({ hotelId }: { hotelId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeConversationId = searchParams.get("c");

  const conversations = useWhatsappConversations(hotelId);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");

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
              <Button asChild size="icon" variant="ghost" className="size-8">
                <Link href={`/${hotelId}/whatsapp/templates`}><Settings className="size-4" /></Link>
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
                      {conversation.phone}
                      {isVIP && <Badge variant="destructive" className="h-4 text-[10px] px-1">VIP</Badge>}
                    </h3>
                    <span className="shrink-0 text-xs text-slate-500">
                      {conversation.last_message_at ? formatDistanceToNow(new Date(conversation.last_message_at), { addSuffix: true }).replace('about ', '') : 'New'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="truncate text-xs text-slate-500">Guest {compactId(conversation.guest_id)}</p>
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
                <Button size="sm" variant="outline" className="h-8 text-xs">Transfer</Button>
                <Button size="sm" className="h-8 text-xs bg-green-600 hover:bg-green-700">Resolve</Button>
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

      {/* RIGHT PANE: GUEST CONTEXT */}
      {activeConversationId && selectedConversation && (
        <div className="w-1/4 min-w-[280px] border-l border-slate-200 bg-white overflow-y-auto">
          {guestQuery.isLoading ? (
            <div className="flex p-8 justify-center"><Loader2 className="animate-spin text-slate-400" /></div>
          ) : (
            <div className="p-5 flex flex-col gap-6">
              
              {/* Profile Card */}
              <div className="text-center flex flex-col items-center">
                <div className="flex size-20 items-center justify-center rounded-full bg-slate-100 text-3xl text-slate-400 mb-3 border border-slate-200">
                  <User />
                </div>
                <h3 className="text-xl font-semibold">{guestQuery.data?.name || "Unknown Guest"}</h3>
                <p className="text-sm text-slate-500 mt-1 flex items-center justify-center gap-1">
                  <Phone className="size-3" /> {selectedConversation.phone}
                </p>
                <div className="flex gap-2 mt-3">
                  <Badge variant="secondary">Walking</Badge>
                  {((selectedConversation as any).priority === "high" || (selectedConversation as any).priority === "urgent") && (
                    <Badge variant="destructive">VIP</Badge>
                  )}
                </div>
                
                <div className="flex gap-2 mt-4 w-full">
                  <Button variant="outline" size="sm" className="flex-1 h-8 text-xs">Email</Button>
                  <Button variant="outline" size="sm" className="flex-1 h-8 text-xs">Call</Button>
                </div>
              </div>

              {/* Reservation Info */}
              <div>
                <h4 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2 border-b border-slate-100 pb-2">
                  <MapPin className="size-4 text-slate-500" /> Reservation Info
                </h4>
                <div className="grid gap-2 text-sm">
                  <div className="flex justify-between"><span className="text-slate-500">Room</span> <span className="font-medium">Unassigned</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Check-in</span> <span>--</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Check-out</span> <span>--</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Status</span> <span>{titleCase(guestQuery.data?.status || "none")}</span></div>
                </div>
              </div>

              {/* Open Tickets */}
              <div>
                <h4 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2 border-b border-slate-100 pb-2">
                  <Ticket className="size-4 text-slate-500" /> Active Operations
                </h4>
                {ticketsQuery.isLoading ? (
                  <Loader2 className="animate-spin size-4 text-slate-400" />
                ) : !ticketsQuery.data?.length ? (
                  <p className="text-xs text-slate-500">No active tickets for this guest.</p>
                ) : (
                  <div className="grid gap-2">
                    {ticketsQuery.data.slice(0, 3).map(ticket => (
                      <div key={ticket.id} className="text-xs border border-slate-100 rounded p-2 bg-slate-50">
                        <div className="font-medium truncate">{ticket.item_description}</div>
                        <div className="text-slate-500 flex justify-between mt-1">
                          <span>{titleCase(ticket.department_key)}</span>
                          <span className={ticket.priority === 3 ? 'text-red-500' : ''}>P{ticket.priority}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <Button variant="link" size="sm" className="p-0 h-auto text-xs mt-2 text-[#0F3D91]">Create New Ticket</Button>
              </div>

              {/* Internal Notes */}
              <div>
                <h4 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2 border-b border-slate-100 pb-2">
                  <AlertCircle className="size-4 text-slate-500" /> Internal Notes
                </h4>
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 shadow-sm">
                  <p className="font-medium mb-1">Staff Only</p>
                  <textarea 
                    className="w-full bg-transparent outline-none resize-none placeholder:text-amber-700/50" 
                    rows={3}
                    placeholder="Add private notes about this guest here..."
                  ></textarea>
                </div>
              </div>

            </div>
          )}
        </div>
      )}
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
