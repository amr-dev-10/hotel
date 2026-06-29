"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, formatDistanceToNowStrict } from "date-fns";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  FileText,
  History,
  LinkIcon,
  Loader2,
  MessageCircle,
  MessagesSquare,
  Paperclip,
  Pencil,
  RotateCcw,
  Send,
  ShieldCheck,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { showApiErrorToast } from "@/lib/api/error-toast";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataState } from "@/components/ui/data-state";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Can } from "@/lib/auth/can";
import { cn, compactId, titleCase } from "@/lib/utils";
import { useDepartments } from "@/features/departments/hooks/useDepartments";
import { useGuests } from "@/features/guests/hooks/useGuests";
import { useReservations } from "@/features/reservations/hooks/useReservations";
import { useRooms } from "@/features/rooms/hooks/useRooms";
import { useStaff } from "@/features/staff/hooks/useStaff";
import { useWhatsappConversations, useWhatsappMessages } from "@/features/whatsapp/hooks/useWhatsapp";
import type { Department, Guest, Reservation, Room, StaffUser, Ticket, TicketCategory, TicketTimelineItem, WhatsAppMessage } from "@/types/domain";
import {
  useAcceptTicket,
  useApproveTicket,
  useCreateTicketMessage,
  useDeleteTicket,
  useCompleteTicket,
  useRejectTicket,
  useReopenTicket,
  useSendTicketGuestMessage,
  useTicket,
  useTicketAcceptances,
  useTicketEscalations,
  useTicketGuestMessages,
  useTicketTimeline,
  useUpdateTicket,
} from "@/features/tickets/hooks/useTickets";
import { useTicketCategories } from "@/features/workflow/hooks/useWorkflowSettings";

type CommunicationTab = "internal" | "ticket-chat" | "whatsapp-history";

export function TicketFullPage({
  hotelId,
  ticketId,
}: {
  hotelId: string;
  ticketId: string;
}) {
  const router = useRouter();
  const ticketQuery = useTicket(hotelId, ticketId);
  const acceptances = useTicketAcceptances(hotelId, ticketId);
  const escalations = useTicketEscalations(hotelId, ticketId);
  const timeline = useTicketTimeline(hotelId, ticketId);
  const guestMessages = useTicketGuestMessages(hotelId, ticketId);
  const departments = useDepartments(hotelId);
  const guests = useGuests(hotelId);
  const reservations = useReservations(hotelId);
  const rooms = useRooms(hotelId);
  const staff = useStaff(hotelId);
  const categories = useTicketCategories(hotelId);
  const conversations = useWhatsappConversations(hotelId);
  const acceptTicket = useAcceptTicket(hotelId);
  const rejectTicket = useRejectTicket(hotelId);
  const completeTicket = useCompleteTicket(hotelId);
  const approveTicket = useApproveTicket(hotelId);
  const reopenTicket = useReopenTicket(hotelId);
  const updateTicket = useUpdateTicket(hotelId);
  const deleteTicket = useDeleteTicket(hotelId);
  const createTicketMessage = useCreateTicketMessage(hotelId, ticketId);
  const ticket = ticketQuery.data;
  const whatsappHistory = useWhatsappMessages(hotelId, ticket?.conversation_id ?? "");
  const sendGuestMessage = useSendTicketGuestMessage(hotelId, ticketId, ticket?.conversation_id ?? null);
  const [activeTab, setActiveTab] = useState<CommunicationTab>("internal");
  const [reopenNote, setReopenNote] = useState("");
  const [discussionMessage, setDiscussionMessage] = useState("");
  const [guestReply, setGuestReply] = useState("");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const departmentMap = useMemo(() => new Map((departments.data ?? []).map((department) => [department.id, department.name])), [departments.data]);
  const guestMap = useMemo(() => new Map((guests.data ?? []).map((guest) => [guest.id, guest.name])), [guests.data]);
  const reservationMap = useMemo(() => new Map((reservations.data ?? []).map((reservation) => [reservation.id, reservation.reservation_no])), [reservations.data]);
  const roomMap = useMemo(() => new Map((rooms.data ?? []).map((room) => [room.id, room.room_number])), [rooms.data]);
  const staffMap = useMemo(() => new Map((staff.data ?? []).map((user) => [user.id, user.name])), [staff.data]);
  const conversationMap = useMemo(
    () => new Map((conversations.data ?? []).map((conversation) => [conversation.id, conversation.phone])),
    [conversations.data],
  );

  async function runAction(action: () => Promise<unknown>, label: string) {
    try {
      await action();
      toast.success(label);
    } catch (error) {
      showApiErrorToast(error);
    }
  }

  async function handlePostMessage(event: React.FormEvent) {
    event.preventDefault();
    if (!discussionMessage.trim()) {
      return;
    }
    try {
      await createTicketMessage.mutateAsync({ content: discussionMessage.trim(), sender_type: "staff" });
      setDiscussionMessage("");
      toast.success("Message posted");
    } catch (error) {
      showApiErrorToast(error);
    }
  }

  async function handleSendGuestReply(event: React.FormEvent) {
    event.preventDefault();
    if (!guestReply.trim() || !ticket?.conversation_id) {
      return;
    }
    try {
      await sendGuestMessage.mutateAsync({
        message: guestReply.trim(),
        reservation_id: ticket.reservation_id,
      });
      setGuestReply("");
      toast.success("Guest message sent");
    } catch (error) {
      showApiErrorToast(error);
    }
  }

  async function handleDeleteTicket() {
    try {
      await deleteTicket.mutateAsync(ticketId);
      toast.success("Ticket deleted");
      setDeleteDialogOpen(false);
      router.push(`/${hotelId}/tickets`);
    } catch (error) {
      showApiErrorToast(error);
    }
  }

  if (ticketQuery.isLoading) {
    return <DataState isLoading />;
  }

  if (ticketQuery.error) {
    return <DataState error={ticketQuery.error} />;
  }

  if (!ticket) {
    return <DataState empty emptyTitle="Ticket not found." />;
  }

  const busy =
    acceptTicket.isPending ||
    rejectTicket.isPending ||
    completeTicket.isPending ||
    approveTicket.isPending ||
    reopenTicket.isPending;
  const eventTimeline = (timeline.data ?? []).filter((item) => item.item_type !== "message");

  return (
    <div className="grid gap-5">
      <header className="flex flex-col justify-between gap-3 border-b border-slate-200 pb-4 xl:flex-row xl:items-center">
        <div className="min-w-0">
          <Button asChild type="button" variant="ghost">
            <Link href={`/${hotelId}/tickets`}>
              <ArrowLeft />
              Tickets
            </Link>
          </Button>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold">{ticket.ticket_code}</h2>
            <Badge variant={ticket.priority >= 4 ? "rose" : "blue"}>P{ticket.priority}</Badge>
            <Badge variant={ticket.stage === "approved" ? "green" : "amber"}>{titleCase(ticket.stage)}</Badge>
          </div>
          <p className="mt-1 max-w-4xl text-sm text-slate-500">{ticket.item_description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Can I="accept" a="Ticket">
            <Button disabled={busy} type="button" onClick={() => runAction(() => acceptTicket.mutateAsync(ticket.id), "Ticket accepted")}>
              {acceptTicket.isPending ? <Loader2 className="animate-spin" /> : <ThumbsUp />}
              Accept
            </Button>
          </Can>
          <Can I="reject" a="Ticket">
            <Button disabled={busy} type="button" variant="secondary" onClick={() => runAction(() => rejectTicket.mutateAsync(ticket.id), "Ticket rejected")}>
              {rejectTicket.isPending ? <Loader2 className="animate-spin" /> : <ThumbsDown />}
              Reject
            </Button>
          </Can>
          <Can I="complete" a="Ticket">
            <Button disabled={busy} type="button" variant="secondary" onClick={() => runAction(() => completeTicket.mutateAsync(ticket.id), "Ticket completed")}>
              {completeTicket.isPending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
              Complete
            </Button>
          </Can>
          <Can I="assign" a="Ticket">
            <Button disabled={updateTicket.isPending} type="button" variant="secondary" onClick={() => setEditDialogOpen(true)}>
              <Pencil />
              Edit
            </Button>
          </Can>
          <Can I="delete" a="Ticket">
            <Button disabled={deleteTicket.isPending} type="button" variant="danger" onClick={() => setDeleteDialogOpen(true)}>
              {deleteTicket.isPending ? <Loader2 className="animate-spin" /> : <Trash2 />}
              Delete
            </Button>
          </Can>
          <Can I="approve" a="Ticket">
            <Button disabled={busy} type="button" onClick={() => runAction(() => approveTicket.mutateAsync(ticket.id), "Ticket approved")}>
              {approveTicket.isPending ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
              Approve
            </Button>
          </Can>
        </div>
      </header>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <main className="grid min-w-0 gap-4">
          <section className="grid gap-4 rounded-md border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap gap-2 border-b border-slate-100 pb-3">
              <TabButton active={activeTab === "internal"} label="Internal Discussion" onClick={() => setActiveTab("internal")} />
              <TabButton active={activeTab === "ticket-chat"} label="Guest Ticket Chat" onClick={() => setActiveTab("ticket-chat")} />
              <TabButton active={activeTab === "whatsapp-history"} label="Full WhatsApp History" onClick={() => setActiveTab("whatsapp-history")} />
            </div>

            {activeTab === "internal" ? (
              <InternalDiscussion
                isPosting={createTicketMessage.isPending}
                message={discussionMessage}
                timeline={timeline.data ?? []}
                timelineError={timeline.error}
                timelineLoading={timeline.isLoading}
                onChangeMessage={setDiscussionMessage}
                onSubmit={handlePostMessage}
              />
            ) : null}

            {activeTab === "ticket-chat" ? (
              <GuestTicketChat
                canSend={Boolean(ticket.conversation_id)}
                isSending={sendGuestMessage.isPending}
                messages={guestMessages.data ?? []}
                reply={guestReply}
                messagesError={guestMessages.error}
                messagesLoading={guestMessages.isLoading}
                onChangeReply={setGuestReply}
                onSubmit={handleSendGuestReply}
              />
            ) : null}

            {activeTab === "whatsapp-history" ? (
              <FullWhatsAppHistory
                hasConversation={Boolean(ticket.conversation_id)}
                messages={whatsappHistory.data ?? []}
                messagesError={whatsappHistory.error}
                messagesLoading={whatsappHistory.isLoading}
              />
            ) : null}
          </section>

          <section className="grid gap-3 rounded-md border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2">
              <Paperclip className="size-4 text-[#0F3D91]" />
              <h3 className="text-base font-semibold">Attachments</h3>
            </div>
            <p className="text-sm text-slate-500">No attachments have been added to this ticket.</p>
          </section>
        </main>

        <aside className="grid h-max gap-4">
          <SidePanel icon={<FileText />} title="Ticket Details">
            <div className="grid gap-2">
              <Detail label="SLA" value={ticket.sla_due_at ? formatDistanceToNowStrict(new Date(ticket.sla_due_at), { addSuffix: true }) : "Not set"} />
              <Detail label="Assigned to" value={ticket.assigned_to ? staffMap.get(ticket.assigned_to) ?? compactId(ticket.assigned_to) : "Unassigned"} />
              <Detail label="Department" value={ticket.department_id ? departmentMap.get(ticket.department_id) ?? compactId(ticket.department_id) : "Unassigned"} />
              <Detail label="Room" value={ticket.room_id ? `Room ${roomMap.get(ticket.room_id) ?? compactId(ticket.room_id)}` : "No room"} />
              <Detail label="Source" value={titleCase(ticket.source)} />
              <Detail label="Created" value={format(new Date(ticket.created_at), "dd MMM yyyy, HH:mm")} />
            </div>
          </SidePanel>

          <SidePanel icon={<Users />} title="Ticket Followers">
            {(ticket.followers ?? []).length ? (
              <div className="flex flex-wrap gap-2">
                {(ticket.followers ?? []).map((follower) => (
                  <Badge key={follower} variant="blue">{staffMap.get(follower) ?? compactId(follower)}</Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No followers yet.</p>
            )}
          </SidePanel>

          <SidePanel icon={<LinkIcon />} title="Related Records">
            <div className="grid gap-2">
              <Detail label="Guest" value={ticket.guest_id ? guestMap.get(ticket.guest_id) ?? compactId(ticket.guest_id) : "No guest"} />
              <Detail label="Reservation" value={ticket.reservation_id ? reservationMap.get(ticket.reservation_id) ?? compactId(ticket.reservation_id) : "No reservation"} />
              <Detail label="Conversation" value={ticket.conversation_id ? `WhatsApp ${conversationMap.get(ticket.conversation_id) ?? compactId(ticket.conversation_id)}` : "No conversation"} />
            </div>
          </SidePanel>

          <SidePanel icon={<Clock />} title="Activity Timeline & SLA">
            {timeline.isLoading ? <DataState isLoading /> : null}
            {timeline.error ? <DataState error={timeline.error} /> : null}
            {!timeline.isLoading && !eventTimeline.length ? (
              <p className="text-sm text-slate-500">No activity recorded yet.</p>
            ) : null}
            <div className="grid gap-2">
              {eventTimeline.slice(-5).map((item) => (
                <div className="rounded-md bg-slate-50 p-3 text-sm" key={item.id}>
                  <p className="font-medium">{titleCase(item.event_type ?? item.content)}</p>
                  <p className="text-xs text-slate-500">{format(new Date(item.created_at), "dd MMM, HH:mm")}</p>
                </div>
              ))}
            </div>
          </SidePanel>

          <SidePanel icon={<RotateCcw />} title="Reopen">
            <div className="grid gap-3">
              <Textarea value={reopenNote} onChange={(event) => setReopenNote(event.target.value)} />
              <Can I="approve" a="Ticket">
                <Button
                  disabled={busy}
                  type="button"
                  variant="secondary"
                  onClick={() => runAction(() => reopenTicket.mutateAsync({ ticketId: ticket.id, note: reopenNote || undefined }), "Ticket reopened")}
                >
                  {reopenTicket.isPending ? <Loader2 className="animate-spin" /> : <RotateCcw />}
                  Reopen
                </Button>
              </Can>
            </div>
          </SidePanel>

          <HistoryPanel
            count={acceptances.data?.length ?? 0}
            isLoading={acceptances.isLoading}
            title="Acceptance History"
          >
            {(acceptances.data ?? []).map((item) => (
              <div className="rounded bg-slate-50 p-3 text-sm" key={item.id}>
                <p className="font-medium">{staffMap.get(item.offered_to) ?? compactId(item.offered_to)}</p>
                <p className="text-slate-500">
                  {titleCase(item.response)} in {item.expire_after_minutes} min window
                </p>
              </div>
            ))}
          </HistoryPanel>

          <HistoryPanel
            count={escalations.data?.length ?? 0}
            isLoading={escalations.isLoading}
            title="Escalation Log"
          >
            {(escalations.data ?? []).map((item) => (
              <div className="rounded bg-slate-50 p-3 text-sm" key={item.id}>
                <p className="font-medium">Level {item.escalation_level ?? item.level}</p>
                <p className="text-slate-500">{item.reason}</p>
              </div>
            ))}
          </HistoryPanel>
        </aside>
      </section>
      <EditTicketDialog
        departments={departments.data ?? []}
        guests={guests.data ?? []}
        isPending={updateTicket.isPending}
        open={editDialogOpen}
        reservations={reservations.data ?? []}
        rooms={rooms.data ?? []}
        staff={staff.data ?? []}
        categories={categories.data ?? []}
        ticket={ticket}
        onOpenChange={setEditDialogOpen}
        onSubmit={async (payload) => {
          try {
            await updateTicket.mutateAsync({ ticketId: ticket.id, payload });
            toast.success("Ticket updated");
            setEditDialogOpen(false);
          } catch (error) {
            showApiErrorToast(error);
          }
        }}
      />
      <DeleteTicketDialog
        isPending={deleteTicket.isPending}
        open={deleteDialogOpen}
        ticketCode={ticket.ticket_code}
        onConfirm={handleDeleteTicket}
        onOpenChange={setDeleteDialogOpen}
      />
    </div>
  );
}

function DeleteTicketDialog({
  isPending,
  open,
  ticketCode,
  onConfirm,
  onOpenChange,
}: {
  isPending: boolean;
  open: boolean;
  ticketCode: string;
  onConfirm: () => Promise<void>;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Delete ticket</DialogTitle>
          <DialogDescription>
            This removes {ticketCode} from active ticket queues and reports.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={isPending} type="button" variant="danger" onClick={onConfirm}>
            {isPending ? <Loader2 className="animate-spin" /> : <Trash2 />}
            Delete
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditTicketDialog({
  departments,
  guests,
  isPending,
  open,
  reservations,
  rooms,
  staff,
  categories,
  ticket,
  onOpenChange,
  onSubmit,
}: {
  departments: Department[];
  guests: Guest[];
  isPending: boolean;
  open: boolean;
  reservations: Reservation[];
  rooms: Room[];
  staff: StaffUser[];
  categories: TicketCategory[];
  ticket: Ticket;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: {
    guest_id: string | null;
    reservation_id: string | null;
    conversation_id: string | null;
    room_id: string | null;
    department_id: string | null;
    assigned_to: string | null;
    type: string;
    task_category_id: string | null;
    task_category: string | null;
    item_description: string;
    source: string;
    followers: string[];
    priority: number;
  }) => Promise<void>;
}) {
  const [description, setDescription] = useState(ticket.item_description);
  const [type, setType] = useState(ticket.type);
  const [taskCategoryId, setTaskCategoryId] = useState(ticket.task_category_id ?? "");
  const [taskCategory, setTaskCategory] = useState(ticket.task_category ?? "");
  const [source, setSource] = useState(ticket.source);
  const [priority, setPriority] = useState(String(ticket.priority));
  const [guestId, setGuestId] = useState(ticket.guest_id ?? "");
  const [reservationId, setReservationId] = useState(ticket.reservation_id ?? "");
  const [conversationId, setConversationId] = useState(ticket.conversation_id ?? "");
  const [roomId, setRoomId] = useState(ticket.room_id ?? "");
  const [departmentId, setDepartmentId] = useState(ticket.department_id ?? "");
  const [assignedTo, setAssignedTo] = useState(ticket.assigned_to ?? "");
  const [followers, setFollowers] = useState((ticket.followers ?? []).join(", "));

  useEffect(() => {
    if (!open) {
      return;
    }
    setDescription(ticket.item_description);
    setType(ticket.type);
    setTaskCategoryId(ticket.task_category_id ?? "");
    setTaskCategory(ticket.task_category ?? "");
    setSource(ticket.source);
    setPriority(String(ticket.priority));
    setGuestId(ticket.guest_id ?? "");
    setReservationId(ticket.reservation_id ?? "");
    setConversationId(ticket.conversation_id ?? "");
    setRoomId(ticket.room_id ?? "");
    setDepartmentId(ticket.department_id ?? "");
    setAssignedTo(ticket.assigned_to ?? "");
    setFollowers((ticket.followers ?? []).join(", "));
  }, [open, ticket]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit({
      guest_id: optionalId(guestId),
      reservation_id: optionalId(reservationId),
      conversation_id: optionalId(conversationId),
      room_id: optionalId(roomId),
      department_id: optionalId(departmentId),
      assigned_to: optionalId(assignedTo),
      type,
      task_category_id: optionalId(taskCategoryId),
      task_category: taskCategory.trim() || null,
      item_description: description.trim(),
      source,
      followers: followers
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      priority: Number(priority || 2),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Edit ticket</DialogTitle>
          <DialogDescription>Update ticket details, assignment, priority, and related records.</DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={save}>
          <TicketFormField label="Description">
            <Textarea required value={description} onChange={(event) => setDescription(event.target.value)} />
          </TicketFormField>
          <div className="grid gap-4 sm:grid-cols-3">
            <TicketFormField label="Type">
              <Select value={type} onChange={(event) => setType(event.target.value)}>
                <option value="Ticket">Ticket</option>
                <option value="Complaint">Complaint</option>
                <option value="Food Order">Food Order</option>
              </Select>
            </TicketFormField>
            <TicketFormField label="Priority">
              <Select value={priority} onChange={(event) => setPriority(event.target.value)}>
                <option value="1">P1</option>
                <option value="2">P2</option>
                <option value="3">P3</option>
                <option value="4">P4</option>
                <option value="5">P5</option>
              </Select>
            </TicketFormField>
            <TicketFormField label="Source">
              <Select value={source} onChange={(event) => setSource(event.target.value)}>
                <option value="DASHBOARD">Dashboard</option>
                <option value="WHATSAPP">WhatsApp</option>
                <option value="PORTAL">Guest Portal</option>
                <option value="STAFF">Staff</option>
                <option value="PHONE">Phone</option>
                <option value="EMAIL">Email</option>
                <option value="WALK_IN">Walk-in</option>
              </Select>
            </TicketFormField>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <TicketFormField label="Department">
              <Select value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}>
                <option value="">No department</option>
                {departmentId && !departments.some((department) => department.id === departmentId) ? (
                  <option value={departmentId}>Department {compactId(departmentId)}</option>
                ) : null}
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </Select>
            </TicketFormField>
            <TicketFormField label="Assigned to">
              <Select value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)}>
                <option value="">Unassigned</option>
                {assignedTo && !staff.some((user) => user.id === assignedTo) ? (
                  <option value={assignedTo}>User {compactId(assignedTo)}</option>
                ) : null}
                {staff.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </Select>
            </TicketFormField>
            <TicketFormField label="Task category">
              <Select
                value={taskCategoryId}
                onChange={(event) => {
                  const category = categories.find((item) => item.id === event.target.value);
                  setTaskCategoryId(event.target.value);
                  setTaskCategory(category?.key ?? "");
                  if (category?.department_id) {
                    setDepartmentId(category.department_id);
                  }
                }}
              >
                <option value="">No category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
            </TicketFormField>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <TicketFormField label="Guest">
              <Select value={guestId} onChange={(event) => setGuestId(event.target.value)}>
                <option value="">No guest</option>
                {guestId && !guests.some((guest) => guest.id === guestId) ? (
                  <option value={guestId}>Guest {compactId(guestId)}</option>
                ) : null}
                {guests.map((guest) => (
                  <option key={guest.id} value={guest.id}>
                    {guest.name}
                  </option>
                ))}
              </Select>
            </TicketFormField>
            <TicketFormField label="Reservation">
              <Select value={reservationId} onChange={(event) => setReservationId(event.target.value)}>
                <option value="">No reservation</option>
                {reservationId && !reservations.some((reservation) => reservation.id === reservationId) ? (
                  <option value={reservationId}>Reservation {compactId(reservationId)}</option>
                ) : null}
                {reservations.map((reservation) => (
                  <option key={reservation.id} value={reservation.id}>
                    {reservation.reservation_no}
                  </option>
                ))}
              </Select>
            </TicketFormField>
            <TicketFormField label="Room">
              <Select value={roomId} onChange={(event) => setRoomId(event.target.value)}>
                <option value="">No room</option>
                {roomId && !rooms.some((room) => room.id === roomId) ? (
                  <option value={roomId}>Room {compactId(roomId)}</option>
                ) : null}
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.room_number} {room.room_type ? `- ${room.room_type}` : ""}
                  </option>
                ))}
              </Select>
            </TicketFormField>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <TicketFormField label="Conversation ID">
              <Input value={conversationId} onChange={(event) => setConversationId(event.target.value)} />
            </TicketFormField>
            <TicketFormField label="Followers">
              <Input placeholder="user-id-1, user-id-2" value={followers} onChange={(event) => setFollowers(event.target.value)} />
            </TicketFormField>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button disabled={isPending || description.trim().length < 2} type="submit">
              {isPending ? <Loader2 className="animate-spin" /> : <Pencil />}
              Save
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TicketFormField({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <label className="grid gap-1.5">
      <Label>{label}</Label>
      {children}
    </label>
  );
}

function optionalId(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function TabButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      className={cn(active && "border-[#0F3D91]/30 bg-[#0F3D91]/5 text-[#0F3D91]")}
      size="sm"
      type="button"
      variant="secondary"
      onClick={onClick}
    >
      {label}
    </Button>
  );
}

function InternalDiscussion({
  isPosting,
  message,
  timeline,
  timelineError,
  timelineLoading,
  onChangeMessage,
  onSubmit,
}: {
  isPosting: boolean;
  message: string;
  timeline: TicketTimelineItem[];
  timelineError: unknown;
  timelineLoading: boolean;
  onChangeMessage: (message: string) => void;
  onSubmit: (event: React.FormEvent) => void;
}) {
  return (
    <div className="grid gap-4">
      <SectionTitle count={timeline.length} icon={<MessageCircle />} title="Internal Discussion" />
      {timelineLoading ? <DataState isLoading /> : null}
      {timelineError ? <DataState error={timelineError} /> : null}
      {!timelineLoading && !timeline.length ? (
        <p className="text-sm text-slate-500">No internal discussion yet.</p>
      ) : null}
      <div className="grid max-h-[34rem] gap-3 overflow-y-auto pr-1">
        {timeline.map((item) => (
          <div
            className={item.item_type === "message" ? "rounded-md border border-blue-100 bg-blue-50/50 p-3" : "rounded-md border border-slate-200 bg-slate-50 p-3"}
            key={`${item.item_type}-${item.id}`}
          >
            <div className="mb-2 flex items-center justify-between gap-3">
              <Badge variant={item.item_type === "message" ? "blue" : "default"}>
                {item.item_type === "message" ? titleCase(item.sender_type ?? "staff") : titleCase(item.event_type ?? "event")}
              </Badge>
              <span className="text-xs text-slate-500">{format(new Date(item.created_at), "dd MMM, HH:mm")}</span>
            </div>
            <p className="whitespace-pre-wrap text-sm text-slate-800">{item.content}</p>
          </div>
        ))}
      </div>
      <form className="grid gap-3 border-t border-slate-100 pt-3" onSubmit={onSubmit}>
        <Textarea
          placeholder="Post an internal update for staff..."
          value={message}
          onChange={(event) => onChangeMessage(event.target.value)}
        />
        <div className="flex justify-end">
          <Button disabled={isPosting || !message.trim()} type="submit">
            {isPosting ? <Loader2 className="animate-spin" /> : <Send />}
            Post message
          </Button>
        </div>
      </form>
    </div>
  );
}

function GuestTicketChat({
  canSend,
  isSending,
  messages,
  messagesError,
  messagesLoading,
  reply,
  onChangeReply,
  onSubmit,
}: {
  canSend: boolean;
  isSending: boolean;
  messages: WhatsAppMessage[];
  messagesError: unknown;
  messagesLoading: boolean;
  reply: string;
  onChangeReply: (message: string) => void;
  onSubmit: (event: React.FormEvent) => void;
}) {
  return (
    <div className="grid gap-4">
      <SectionTitle count={messages.length} icon={<MessagesSquare />} title="Guest Ticket Chat" />
      {!canSend ? <p className="text-sm text-slate-500">This ticket is not linked to a WhatsApp conversation.</p> : null}
      {messagesLoading ? <DataState isLoading /> : null}
      {messagesError ? <DataState error={messagesError} /> : null}
      {!messagesLoading && canSend && !messages.length ? (
        <p className="text-sm text-slate-500">No WhatsApp messages have been linked to this ticket yet.</p>
      ) : null}
      <div className="grid max-h-[34rem] gap-3 overflow-y-auto pr-1">
        {messages.map((message) => (
          <WhatsAppBubble key={message.id} message={message} />
        ))}
      </div>
      <form className="grid gap-3 border-t border-slate-100 pt-3" onSubmit={onSubmit}>
        <Textarea
          disabled={!canSend}
          placeholder="Reply to the guest for this ticket..."
          value={reply}
          onChange={(event) => onChangeReply(event.target.value)}
        />
        <div className="flex justify-end">
          <Button disabled={!canSend || isSending || !reply.trim()} type="submit">
            {isSending ? <Loader2 className="animate-spin" /> : <Send />}
            Send to guest
          </Button>
        </div>
      </form>
    </div>
  );
}

function FullWhatsAppHistory({
  hasConversation,
  messages,
  messagesError,
  messagesLoading,
}: {
  hasConversation: boolean;
  messages: WhatsAppMessage[];
  messagesError: unknown;
  messagesLoading: boolean;
}) {
  return (
    <div className="grid gap-4">
      <SectionTitle count={messages.length} icon={<History />} title="Full WhatsApp History" />
      {!hasConversation ? <p className="text-sm text-slate-500">This ticket is not linked to a WhatsApp conversation.</p> : null}
      {messagesLoading ? <DataState isLoading /> : null}
      {messagesError ? <DataState error={messagesError} /> : null}
      {!messagesLoading && hasConversation && !messages.length ? (
        <p className="text-sm text-slate-500">No WhatsApp messages are available for this conversation.</p>
      ) : null}
      <div className="grid max-h-[40rem] gap-3 overflow-y-auto pr-1">
        {messages.map((message) => (
          <WhatsAppBubble key={message.id} message={message} />
        ))}
      </div>
    </div>
  );
}

function WhatsAppBubble({ message }: { message: WhatsAppMessage }) {
  const outbound = message.direction === "outbound";

  return (
    <div className={cn("flex", outbound ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[82%] rounded-md border p-3 text-sm",
          outbound ? "border-[#0F3D91]/15 bg-[#0F3D91]/5" : "border-slate-200 bg-slate-50",
        )}
      >
        <div className="mb-1 flex items-center justify-between gap-3 text-xs text-slate-500">
          <span>{titleCase(message.direction)}</span>
          <span>{format(new Date(message.created_at), "dd MMM, HH:mm")}</span>
        </div>
        <p className="whitespace-pre-wrap text-slate-800">{message.message_text ?? titleCase(message.message_type)}</p>
      </div>
    </div>
  );
}

function SectionTitle({
  count,
  icon,
  title,
}: {
  count: number;
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <span className="[&_svg]:size-4 [&_svg]:text-[#0F3D91]">{icon}</span>
        <h3 className="text-base font-semibold">{title}</h3>
      </div>
      <Badge>{count}</Badge>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">{label}</p>
      <p className="mt-1 truncate text-sm font-medium">{value}</p>
    </div>
  );
}

function SidePanel({
  children,
  icon,
  title,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <section className="grid gap-3 rounded-md border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <span className="[&_svg]:size-4 [&_svg]:text-[#0F3D91]">{icon}</span>
        <h3 className="text-base font-semibold">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function HistoryPanel({
  title,
  count,
  isLoading,
  children,
}: {
  title: string;
  count: number;
  isLoading: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-3 rounded-md border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">{title}</h3>
        <Badge>{count}</Badge>
      </div>
      {isLoading ? <DataState isLoading /> : null}
      {!isLoading && count === 0 ? <p className="text-sm text-slate-500">No records yet.</p> : null}
      {children}
    </section>
  );
}
