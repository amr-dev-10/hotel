import {useCallback, useEffect, useMemo, useState} from 'react';
import type {ReactNode} from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  ActionMenu,
  type ActionMenuItem,
  Avatar,
  EmptyState,
  ErrorNotice,
  InfoLine,
  LoadingProcessCard,
  StatusBadge,
  TopAppBar,
} from '../AppComponents';
import {appErrorDialog, type AppDialogRequest} from '../AppDialog';
import {Bell, ChevronLeft, ChevronRight, Menu, MessageCircle, Send} from '../icons';
import {firstRecordValue, isRecordTruthy} from '../dataUtils';
import {blue, styles} from '../styles';
import {Permissions} from '../../permissions/permissionCodes';
import {hasPermission} from '../../permissions/rbac';
import type {AppData, ReservationView, TicketView} from '../../modules/dashboard';
import type {ResourceKey} from '../../modules/operations/types';
import {compactDate, priorityTone, statusTone, text} from '../../modules/operations/utils';
import {formatErrorDetails} from '../../services/api';
import type {ApiEnvelope} from '../../types/api';
import type {ArcadiaRecord, UserProfile} from '../../types/domain';

type RequestFn = <T>(
  path: string,
  options?: RequestInit,
) => Promise<ApiEnvelope<T>>;

type DetailBaseProps = {
  data: AppData;
  error: string | null;
  hotelId: string;
  loading: boolean;
  request: RequestFn;
  onBack: () => void;
  onMenu: () => void;
  onOpenNotifications?: () => void;
  onRefresh: () => void;
  onRefreshResource: (resource: ResourceKey) => void;
  onShowDialog: (dialog: AppDialogRequest) => void;
};

export function TicketDetailScreen({
  data,
  error,
  hotelId,
  loading,
  request,
  ticket,
  user,
  onBack,
  onMenu,
  onOpenNotifications,
  onOpenWhatsAppConversation,
  onRefresh,
  onRefreshResource,
  onShowDialog,
}: DetailBaseProps & {
  ticket: TicketView | null;
  user: UserProfile;
  onOpenWhatsAppConversation: (conversation: ArcadiaRecord) => void;
}) {
  const ticketId = ticket?.id ?? '';
  const seedRecord = useMemo(
    () =>
      ticket
        ? {
            ...ticket.raw,
            id: ticket.id,
            ticket_code: ticket.code,
            item_description: ticket.title,
            room_number: ticket.roomNumber,
            guest_name: ticket.guestName,
            task_category_name: ticket.department,
            created_at: ticket.createdAt,
            priority: ticket.priority,
            stage: ticket.status,
          }
        : {},
    [ticket],
  );
  const [detail, setDetail] = useState<ArcadiaRecord | null>(null);
  const [timeline, setTimeline] = useState<ArcadiaRecord[]>([]);
  const [messages, setMessages] = useState<ArcadiaRecord[]>([]);
  const [guestMessages, setGuestMessages] = useState<ArcadiaRecord[]>([]);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [stage, setStage] = useState(stageValue(ticket?.status ?? 'accepted'));
  const [note, setNote] = useState('');
  const [guestMessage, setGuestMessage] = useState('');
  const [submitting, setSubmitting] = useState<string | null>(null);

  const record = useMemo(() => ({...seedRecord, ...(detail ?? {})}), [detail, seedRecord]);
  const conversationId = firstRecordValue(record, ['conversation_id']);
  const guestId = firstRecordValue(record, ['guest_id']);
  const activityItems = useMemo(
    () => buildTicketActivityItems(timeline, messages),
    [messages, timeline],
  );
  const relationLabels = useMemo(() => buildRelationLabels(data, record), [data, record]);

  const loadDetail = useCallback(async () => {
    if (!ticketId) {
      return;
    }

    setDetailLoading(true);
    setInlineError(null);
    const [ticketResult, timelineResult, messageResult, guestMessageResult] =
      await Promise.allSettled([
        request<ArcadiaRecord>(`/api/v1/hotels/${hotelId}/tickets/${ticketId}`),
        request<ArcadiaRecord[]>(`/api/v1/hotels/${hotelId}/tickets/${ticketId}/timeline`),
        request<ArcadiaRecord[]>(`/api/v1/hotels/${hotelId}/tickets/${ticketId}/messages`),
        request<ArcadiaRecord[]>(`/api/v1/hotels/${hotelId}/tickets/${ticketId}/guest-messages`),
      ]);

    if (ticketResult.status === 'fulfilled' && ticketResult.value.data) {
      setDetail(ticketResult.value.data);
      setStage(stageValue(firstRecordValue(ticketResult.value.data, ['stage', 'status'])));
    } else if (ticketResult.status === 'rejected') {
      setInlineError(formatErrorDetails(ticketResult.reason, 'Ticket detail failed'));
    }
    if (timelineResult.status === 'fulfilled') {
      setTimeline(Array.isArray(timelineResult.value.data) ? timelineResult.value.data : []);
    }
    if (messageResult.status === 'fulfilled') {
      setMessages(Array.isArray(messageResult.value.data) ? messageResult.value.data : []);
    }
    if (guestMessageResult.status === 'fulfilled') {
      setGuestMessages(Array.isArray(guestMessageResult.value.data) ? guestMessageResult.value.data : []);
    }
    setDetailLoading(false);
  }, [hotelId, request, ticketId]);

  useEffect(() => {
    setDetail(null);
    setTimeline([]);
    setMessages([]);
    setGuestMessages([]);
    setGuestMessage('');
    setStage(stageValue(ticket?.status ?? 'accepted'));
    loadDetail();
  }, [loadDetail, ticket?.status]);

  const handleError = useCallback((nextError: unknown, fallback: string) => {
    const details = formatErrorDetails(nextError, fallback);
    setInlineError(details);
    onShowDialog(appErrorDialog(fallback, details));
  }, [onShowDialog]);

  async function runTicketWorkflowAction(action: TicketWorkflowAction) {
    if (!ticketId) {
      return;
    }
    setSubmitting(action.key);
    try {
      if (action.stage) {
        await request<ArcadiaRecord>(
          `/api/v1/hotels/${hotelId}/tickets/${ticketId}/stage`,
          {
            method: 'PATCH',
            body: JSON.stringify(
              compactPayload({
                note: action.note,
                stage: action.stage,
              }),
            ),
          },
        );
      } else {
        await request<ArcadiaRecord>(
          `/api/v1/hotels/${hotelId}/tickets/${ticketId}/${action.action}`,
          {
            method: 'POST',
            body: action.body ? JSON.stringify(action.body) : undefined,
          },
        );
      }
      onRefreshResource('tickets');
      await loadDetail();
      onShowDialog({
        message: `${action.label} completed.`,
        title: 'Ticket updated',
        tone: 'success',
      });
    } catch (nextError) {
      handleError(nextError, 'Ticket action failed');
    } finally {
      setSubmitting(null);
    }
  }

  async function ensureGuestConversationId() {
    const linkedConversationId = firstRecordValue(record, ['conversation_id']);
    if (linkedConversationId) {
      return linkedConversationId;
    }

    if (!guestId) {
      throw new Error('Ticket has no guest profile linked for WhatsApp.');
    }

    const result = await request<{conversation_id: string; reservation_id: string | null}>(
      `/api/v1/hotels/${hotelId}/guests/${guestId}/conversation`,
    );
    const nextConversationId = result.data?.conversation_id;
    if (!nextConversationId) {
      throw new Error('Guest WhatsApp conversation was not returned by the API.');
    }

    setDetail(current => ({
      ...(current ?? {}),
      conversation_id: nextConversationId,
      reservation_id:
        result.data?.reservation_id ||
        firstRecordValue(record, ['reservation_id']) ||
        undefined,
    }));
    return nextConversationId;
  }

  async function sendGuestWhatsAppMessage() {
    const outgoing = guestMessage.trim();
    if (!ticketId || !outgoing) {
      return;
    }

    setSubmitting('guest-whatsapp');
    try {
      const nextConversationId = await ensureGuestConversationId();
      await request<ArcadiaRecord>(
        `/api/v1/hotels/${hotelId}/whatsapp/conversations/${nextConversationId}/messages`,
        {
          method: 'POST',
          body: JSON.stringify(
            compactPayload({
              message: outgoing,
              reservation_id: firstRecordValue(record, ['reservation_id']) || undefined,
              ticket_id: ticketId,
            }),
          ),
        },
      );
      setGuestMessage('');
      onRefreshResource('whatsapp');
      await loadDetail();
      onShowDialog({
        message: 'WhatsApp message sent to the guest.',
        title: 'Message sent',
        tone: 'success',
      });
    } catch (nextError) {
      handleError(nextError, 'WhatsApp send failed');
    } finally {
      setSubmitting(null);
    }
  }

  async function addNote() {
    if (!ticketId || !note.trim()) {
      return;
    }
    setSubmitting('note');
    try {
      await request<ArcadiaRecord>(
        `/api/v1/hotels/${hotelId}/tickets/${ticketId}/messages`,
        {
          method: 'POST',
          body: JSON.stringify({content: note.trim(), sender_type: 'staff'}),
        },
      );
      setNote('');
      await loadDetail();
      onShowDialog({
        message: 'Ticket note saved.',
        title: 'Note added',
        tone: 'success',
      });
    } catch (nextError) {
      handleError(nextError, 'Ticket note failed');
    } finally {
      setSubmitting(null);
    }
  }

  function openWhatsApp() {
    if (!conversationId) {
      return;
    }
    onOpenWhatsAppConversation({
      id: conversationId,
      conversation_id: conversationId,
      guest_id: firstRecordValue(record, ['guest_id']),
      guest_name: firstRecordValue(record, ['guest_name']),
      reservation_id: firstRecordValue(record, ['reservation_id']),
      phone: firstRecordValue(record, ['phone', 'guest_phone', 'whatsapp_phone']),
      status: 'open',
    });
  }

  if (!ticket) {
    return (
      <DetailFrame error={error} loading={loading} title="Ticket Detail" onBack={onBack} onMenu={onMenu} onOpenNotifications={onOpenNotifications} onRefresh={onRefresh}>
        <EmptyState label="No ticket selected." />
      </DetailFrame>
    );
  }

  const ticketDescription =
    firstRecordValue(record, ['item_description', 'description', 'title']) ||
    'No description';
  const latestActivityNote = [...activityItems].reverse().find(item => item.type === 'note');
  const ticketNote =
    firstRecordValue(record, ['note', 'notes', 'internal_notes', 'last_note']) ||
    latestActivityNote?.content ||
    'No note';
  const assignedTo = firstRecordValue(record, [
    'assigned_to',
    'assigned_to_id',
    'assigned_staff_id',
  ]);
  const assignedToCurrentUser = Boolean(assignedTo && assignedTo === user.id);
  const smartActions = ticketSmartActions(stage, {
    assignedToCurrentUser,
    canAccept:
      assignedToCurrentUser &&
      (hasPermission(user.permissions, Permissions.TICKET_ACCEPT) ||
        hasPermission(user.permissions, Permissions.TICKET_VIEW)),
    canApprove: hasPermission(user.permissions, Permissions.TICKET_APPROVE),
    canClose: hasPermission(user.permissions, Permissions.TICKET_CLOSE),
    canReject:
      assignedToCurrentUser &&
      (hasPermission(user.permissions, Permissions.TICKET_REJECT) ||
        hasPermission(user.permissions, Permissions.TICKET_VIEW)),
    canWorkTicket:
      (!assignedTo || assignedToCurrentUser) &&
      (hasPermission(user.permissions, Permissions.TICKET_COMPLETE_OWN) ||
        hasPermission(user.permissions, Permissions.TICKET_VIEW)),
  });
  const canSendGuestWhatsApp = hasPermission(user.permissions, Permissions.TICKET_ASSIGN);

  return (
    <DetailFrame
      actions={[
        ...smartActions.map(action => ({
          label: action.menuLabel,
          onPress: () => runTicketWorkflowAction(action),
          tone: action.tone === 'danger' ? 'danger' as const : 'default' as const,
        })),
        ...(conversationId
          ? [{label: 'Open WhatsApp', onPress: openWhatsApp}]
          : []),
      ]}
      error={error}
      loading={loading || detailLoading || Boolean(submitting)}
      loadingLabel={actionProcessLabel('ticket', submitting, 'Loading ticket detail')}
      title="Ticket Detail"
      onBack={onBack}
      onMenu={onMenu}
      onOpenNotifications={onOpenNotifications}
      onRefresh={loadDetail}>
      <InlineError message={inlineError} />
      <View style={styles.popupBadgeRow}>
        <StatusBadge label={firstRecordValue(record, ['priority']) || 'Priority'} tone={priorityTone(firstRecordValue(record, ['priority']))} />
        <StatusBadge label={firstRecordValue(record, ['stage', 'status']) || 'Open'} tone={statusTone(firstRecordValue(record, ['stage', 'status']))} />
      </View>
      <Text style={styles.popupBodyTitle}>
        {firstRecordValue(record, ['item_description', 'description', 'title']) || 'Ticket'}
      </Text>

      <DetailSection title="Ticket Summary">
        <InfoLine label="Ticket" value={firstRecordValue(record, ['ticket_code', 'code', 'id'])} />
        <InfoLine label="Type" value={firstRecordValue(record, ['type']) || 'Ticket'} />
        <InfoLine label="Description" value={ticketDescription} />
        <InfoLine label="Note" value={ticketNote} />
        <InfoLine label="Guest" value={firstRecordValue(record, ['guest_name', 'guest_full_name']) || 'Unassigned'} />
        <InfoLine label="Room" value={firstRecordValue(record, ['room_number', 'room_name']) || 'Unassigned'} />
        <InfoLine label="Reservation" value={firstRecordValue(record, ['reservation_no', 'booking_id']) || 'None'} />
        <InfoLine label="Assignee" value={firstRecordValue(record, ['assigned_to_name', 'assignee_name']) || 'Unassigned'} />
        <InfoLine label="SLA Due" value={compactDate(firstRecordValue(record, ['sla_due_at'])) || 'Not set'} />
        <InfoLine label="Created" value={compactDate(firstRecordValue(record, ['created_at']))} />
      </DetailSection>

      <DetailSection title="Smart Actions">
        {smartActions.length ? (
          <ActionRow>
            {smartActions.map(action => (
              <ActionButton
                key={action.key}
                disabled={Boolean(submitting)}
                label={submitting === action.key ? action.loadingLabel : action.label}
                tone={action.tone}
                onPress={() => runTicketWorkflowAction(action)}
              />
            ))}
          </ActionRow>
        ) : (
          <Text style={styles.caption}>No workflow action is available for this ticket state.</Text>
        )}
        {conversationId ? (
          <Pressable style={styles.inlineLinkButton} onPress={openWhatsApp}>
            <MessageCircle color={blue} size={16} strokeWidth={2.2} />
            <Text style={styles.inlineLinkText}>Open WhatsApp conversation</Text>
          </Pressable>
        ) : null}
      </DetailSection>

      <ActivityTimeline
        items={activityItems}
        note={note}
        noteSubmitting={submitting === 'note'}
        onAddNote={addNote}
        onNoteChange={setNote}
      />
      <TicketGuestWhatsAppSection
        canSend={canSendGuestWhatsApp}
        hasGuestContext={Boolean(conversationId || guestId)}
        items={guestMessages}
        message={guestMessage}
        messageSubmitting={submitting === 'guest-whatsapp'}
        onMessageChange={setGuestMessage}
        onSendMessage={sendGuestWhatsAppMessage}
      />
      <RecordFields defaultExpanded={false} record={record} relationLabels={relationLabels} title="Backend API Fields" />
    </DetailFrame>
  );
}

export function TicketFormScreen({
  data,
  error,
  hotelId,
  loading,
  request,
  selectedConversation,
  selectedGuest,
  selectedReservation,
  user,
  onBack,
  onMenu,
  onOpenNotifications,
  onRefresh,
  onRefreshResource,
  onShowDialog,
}: DetailBaseProps & {
  selectedConversation: ArcadiaRecord | null;
  selectedGuest: ArcadiaRecord | null;
  selectedReservation: ReservationView | null;
  user: UserProfile;
}) {
  const reservationRecords = useMemo(
    () =>
      data.reservations.map(reservation => ({
        ...reservation.raw,
        id: reservation.id,
        reservation_no: reservation.bookingId,
        guest_name: reservation.guestName,
        room_number: reservation.roomNumber,
      })),
    [data.reservations],
  );
  const contextReservation = useMemo(
    () =>
      selectedReservation
        ? {
            ...selectedReservation.raw,
            id: selectedReservation.id,
            reservation_no: selectedReservation.bookingId,
            guest_name: selectedReservation.guestName,
            room_number: selectedReservation.roomNumber,
          }
        : null,
    [selectedReservation],
  );
  const [description, setDescription] = useState('');
  const [departmentKey, setDepartmentKey] = useState('housekeeping');
  const [ticketType, setTicketType] = useState('Ticket');
  const [priority, setPriority] = useState('2');
  const [taskCategory, setTaskCategory] = useState('');
  const [selectedRoom, setSelectedRoom] = useState<ArcadiaRecord | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<ArcadiaRecord | null>(null);
  const [guestRecord, setGuestRecord] = useState<ArcadiaRecord | null>(selectedGuest);
  const [reservationRecord, setReservationRecord] = useState<ArcadiaRecord | null>(contextReservation);
  const [conversationRecord, setConversationRecord] = useState<ArcadiaRecord | null>(selectedConversation);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setGuestRecord(selectedGuest);
  }, [selectedGuest]);

  useEffect(() => {
    setReservationRecord(contextReservation);
  }, [contextReservation]);

  useEffect(() => {
    setConversationRecord(selectedConversation);
  }, [selectedConversation]);

  useEffect(() => {
    const roomNumber = firstRecordValue(reservationRecord, ['room_number']);
    if (!roomNumber || selectedRoom) {
      return;
    }
    const match = data.rooms.find(
      room => firstRecordValue(room, ['room_number', 'name', 'number']) === roomNumber,
    );
    if (match) {
      setSelectedRoom(match);
    }
  }, [data.rooms, reservationRecord, selectedRoom]);

  const handleError = useCallback((nextError: unknown, fallback: string) => {
    const details = formatErrorDetails(nextError, fallback);
    setInlineError(details);
    onShowDialog(appErrorDialog(fallback, details));
  }, [onShowDialog]);

  async function submitTicket() {
    if (description.trim().length < 2) {
      handleError(new Error('Issue description must be at least 2 characters.'), 'Ticket validation failed');
      return;
    }

    setSubmitting(true);
    try {
      const selectedRoomId = firstRecordValue(selectedRoom, ['id', 'room_id']);
      const selectedStaffId = firstRecordValue(selectedStaff, ['id', 'user_id']);
      const guestId =
        firstRecordValue(guestRecord, ['id', 'guest_id']) ||
        firstRecordValue(reservationRecord, ['guest_id']) ||
        firstRecordValue(conversationRecord, ['guest_id']);
      const reservationId =
        firstRecordValue(reservationRecord, ['id', 'reservation_id']) ||
        firstRecordValue(conversationRecord, ['reservation_id']);
      const conversationId = firstRecordValue(conversationRecord, ['id', 'conversation_id']);

      const result = await request<ArcadiaRecord>(
        `/api/v1/hotels/${hotelId}/tickets`,
        {
          method: 'POST',
          body: JSON.stringify(
            compactPayload({
              assigned_to: selectedStaffId || undefined,
              conversation_id: conversationId || undefined,
              department_key: departmentKey,
              guest_id: guestId || undefined,
              item_description: description.trim(),
              priority: Number(priority),
              reservation_id: reservationId || undefined,
              room_id: selectedRoomId || undefined,
              source: 'MOBILE',
              task_category: taskCategory.trim() || undefined,
              type: ticketType,
            }),
          ),
        },
      );
      onRefreshResource('tickets');
      if (conversationId) {
        onRefreshResource('whatsapp');
      }
      onShowDialog({
        message: firstRecordValue(result.data, ['ticket_code', 'code', 'id']) || 'Ticket created successfully.',
        title: 'Ticket created',
        tone: 'success',
      });
      onBack();
    } catch (nextError) {
      handleError(nextError, 'Ticket create failed');
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setDescription('');
    setDepartmentKey('housekeeping');
    setTicketType('Ticket');
    setPriority('2');
    setTaskCategory('');
    setSelectedRoom(null);
    setSelectedStaff(null);
    setGuestRecord(selectedGuest);
    setReservationRecord(contextReservation);
    setConversationRecord(selectedConversation);
    setInlineError(null);
  }

  const canCreateGuest = hasPermission(user.permissions, Permissions.GUEST_CREATE);

  async function createGuestFromSearch(searchValue: string) {
    const name = searchValue.trim();
    if (name.length < 2) {
      throw new Error('Enter at least 2 characters for the guest name.');
    }

    const result = await request<ArcadiaRecord>(
      `/api/v1/hotels/${hotelId}/guests`,
      {
        method: 'POST',
        body: JSON.stringify({name, status: 'checked_in'}),
      },
    );
    if (!result.data) {
      throw new Error('Guest was not returned by the API.');
    }
    onRefreshResource('guests');
    onShowDialog({
      message: firstRecordValue(result.data, ['name', 'guest_name', 'id']) || 'Guest created.',
      title: 'Guest created',
      tone: 'success',
    });
    return result.data;
  }

  return (
    <DetailFrame
      actions={[
        {label: submitting ? 'Creating...' : 'Create Ticket', onPress: submitTicket},
        {label: 'Clear Form', onPress: resetForm},
        {label: 'Cancel', onPress: onBack},
      ]}
      error={error}
      loading={loading || submitting}
      loadingLabel={submitting ? 'Creating ticket' : 'Loading ticket form data'}
      title="Create Ticket"
      onBack={onBack}
      onMenu={onMenu}
      onOpenNotifications={onOpenNotifications}
      onRefresh={onRefresh}>
      <InlineError message={inlineError} />
      <DetailSection title="Issue">
        <EditableField
          label="Issue"
          multiline
          placeholder="Describe the guest or operations issue"
          value={description}
          onChangeText={setDescription}
        />
        <OptionRow
          label="Department"
          options={[
            ['front_office', 'Front office'],
            ['housekeeping', 'Housekeeping'],
            ['engineering', 'Engineering'],
            ['food_beverage', 'F&B'],
          ]}
          value={departmentKey}
          onChange={setDepartmentKey}
        />
        <OptionRow
          label="Type"
          options={[
            ['Ticket', 'Ticket'],
            ['Complaint', 'Complaint'],
            ['Food Order', 'Food order'],
          ]}
          value={ticketType}
          onChange={setTicketType}
        />
        <OptionRow
          label="Priority"
          options={[
            ['1', 'Low'],
            ['2', 'Normal'],
            ['3', 'Elevated'],
            ['4', 'Urgent'],
            ['5', 'Critical'],
          ]}
          value={priority}
          onChange={setPriority}
        />
      </DetailSection>

      <DetailSection title="Related Records">
        <Many2OneField
          displayKeys={['name', 'guest_name', 'phone', 'whatsapp_phone', 'email']}
          label="Guest"
          placeholder="Search guest"
          records={data.guests}
          selectedRecord={guestRecord}
          createActionLabel={canCreateGuest ? 'Create guest' : undefined}
          onCreateRecord={canCreateGuest ? createGuestFromSearch : undefined}
          onSelect={setGuestRecord}
        />
        <Many2OneField
          displayKeys={['guest_name', 'reservation_no', 'booking_id', 'room_number']}
          label="Reservation"
          placeholder="Search reservation"
          records={reservationRecords}
          selectedRecord={reservationRecord}
          onSelect={setReservationRecord}
        />
        <Many2OneField
          displayKeys={['guest_name', 'contact_name', 'phone', 'whatsapp_phone']}
          label="WhatsApp Conversation"
          placeholder="Search WhatsApp conversation"
          records={data.whatsapp}
          selectedRecord={conversationRecord}
          onSelect={setConversationRecord}
        />
        <Many2OneField
          displayKeys={['room_number', 'name', 'number']}
          label="Room"
          placeholder="Search room"
          records={data.rooms}
          selectedRecord={selectedRoom}
          onSelect={setSelectedRoom}
        />
        <Many2OneField
          displayKeys={['name', 'full_name', 'email']}
          label="Assign Staff"
          placeholder="Search staff member"
          records={data.staff}
          selectedRecord={selectedStaff}
          onSelect={setSelectedStaff}
        />
      </DetailSection>

      <DetailSection title="Category">
        <EditableField
          label="Category"
          placeholder="housekeeping, maintenance, request..."
          value={taskCategory}
          onChangeText={setTaskCategory}
        />
      </DetailSection>

      <ActionRow>
        <ActionButton label="Cancel" tone="secondary" onPress={onBack} />
        <ActionButton
          disabled={submitting}
          label={submitting ? 'Creating...' : 'Create Ticket'}
          onPress={submitTicket}
        />
      </ActionRow>
    </DetailFrame>
  );
}

export function ReservationDetailScreen({
  error,
  hotelId,
  loading,
  request,
  reservation,
  onBack,
  onCreateTicket,
  onMenu,
  onOpenNotifications,
  onOpenWhatsAppConversation,
  onRefresh,
  onRefreshResource,
  onShowDialog,
}: DetailBaseProps & {
  onCreateTicket: () => void;
  reservation: ReservationView | null;
  onOpenWhatsAppConversation: (conversation: ArcadiaRecord) => void;
}) {
  const reservationId = reservation?.id ?? '';
  const seedRecord = useMemo(
    () =>
      reservation
        ? {
            ...reservation.raw,
            id: reservation.id,
            reservation_no: reservation.bookingId,
            guest_name: reservation.guestName,
            room_number: reservation.roomNumber,
            stay_dates: reservation.stayDates,
            adults: reservation.adults,
            children: reservation.children,
            status: reservation.status,
          }
        : {},
    [reservation],
  );
  const [detail, setDetail] = useState<ArcadiaRecord | null>(null);
  const [guests, setGuests] = useState<ArcadiaRecord[]>([]);
  const [stays, setStays] = useState<ArcadiaRecord[]>([]);
  const [roomTypes, setRoomTypes] = useState<ArcadiaRecord[]>([]);
  const [messages, setMessages] = useState<ArcadiaRecord[]>([]);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const record = useMemo(() => ({...seedRecord, ...(detail ?? {})}), [detail, seedRecord]);

  const loadDetail = useCallback(async () => {
    if (!reservationId) {
      return;
    }
    setDetailLoading(true);
    setInlineError(null);
    const [detailResult, guestResult, stayResult, roomTypeResult, messageResult] =
      await Promise.allSettled([
        request<ArcadiaRecord>(`/api/v1/hotels/${hotelId}/reservations/${reservationId}`),
        request<ArcadiaRecord[]>(`/api/v1/hotels/${hotelId}/reservations/${reservationId}/guests`),
        request<ArcadiaRecord[]>(`/api/v1/hotels/${hotelId}/reservations/${reservationId}/stays`),
        request<ArcadiaRecord[]>(`/api/v1/hotels/${hotelId}/reservations/${reservationId}/room-types`),
        request<ArcadiaRecord[]>(`/api/v1/hotels/${hotelId}/reservations/${reservationId}/messages`),
      ]);

    if (detailResult.status === 'fulfilled' && detailResult.value.data) {
      setDetail(detailResult.value.data);
    } else if (detailResult.status === 'rejected') {
      setInlineError(formatErrorDetails(detailResult.reason, 'Reservation detail failed'));
    }
    if (guestResult.status === 'fulfilled') {
      setGuests(Array.isArray(guestResult.value.data) ? guestResult.value.data : []);
    }
    if (stayResult.status === 'fulfilled') {
      setStays(Array.isArray(stayResult.value.data) ? stayResult.value.data : []);
    }
    if (roomTypeResult.status === 'fulfilled') {
      setRoomTypes(Array.isArray(roomTypeResult.value.data) ? roomTypeResult.value.data : []);
    }
    if (messageResult.status === 'fulfilled') {
      setMessages(Array.isArray(messageResult.value.data) ? messageResult.value.data : []);
    }
    setDetailLoading(false);
  }, [hotelId, request, reservationId]);

  useEffect(() => {
    setDetail(null);
    setGuests([]);
    setStays([]);
    setRoomTypes([]);
    setMessages([]);
    loadDetail();
  }, [loadDetail]);

  const handleError = useCallback((nextError: unknown, fallback: string) => {
    const details = formatErrorDetails(nextError, fallback);
    setInlineError(details);
    onShowDialog(appErrorDialog(fallback, details));
  }, [onShowDialog]);

  async function runLifecycle(action: 'check-in' | 'check-out') {
    if (!reservationId) {
      return;
    }
    setSubmitting(action);
    try {
      await request<ArcadiaRecord>(
        `/api/v1/hotels/${hotelId}/reservations/${reservationId}/${action}`,
        {
          method: 'POST',
          body: action === 'check-in' ? JSON.stringify({auto_assign: true, room_assignments: []}) : undefined,
        },
      );
      onRefreshResource('reservations');
      onRefreshResource('rooms');
      await loadDetail();
      onShowDialog({
        message: action === 'check-in' ? 'Check-in complete.' : 'Check-out complete.',
        title: 'Reservation updated',
        tone: 'success',
      });
    } catch (nextError) {
      handleError(nextError, action === 'check-in' ? 'Check-in failed' : 'Check-out failed');
    } finally {
      setSubmitting(null);
    }
  }

  async function openWhatsApp() {
    const guestId = firstRecordValue(record, ['guest_id']);
    if (!guestId) {
      handleError(new Error('This reservation does not include a guest id.'), 'WhatsApp conversation failed');
      return;
    }
    setSubmitting('whatsapp');
    try {
      const result = await request<{conversation_id: string; reservation_id: string | null}>(
        `/api/v1/hotels/${hotelId}/guests/${guestId}/conversation`,
      );
      if (!result.data?.conversation_id) {
        throw new Error('Conversation was not returned by the API.');
      }
      onOpenWhatsAppConversation({
        id: result.data.conversation_id,
        conversation_id: result.data.conversation_id,
        guest_id: guestId,
        guest_name: firstRecordValue(record, ['guest_name']),
        phone: firstRecordValue(record, ['guest_phone', 'phone', 'whatsapp_phone']),
        reservation_id: result.data.reservation_id ?? reservationId,
        status: 'open',
      });
    } catch (nextError) {
      handleError(nextError, 'WhatsApp conversation failed');
    } finally {
      setSubmitting(null);
    }
  }

  if (!reservation) {
    return (
      <DetailFrame error={error} loading={loading} title="Reservation Detail" onBack={onBack} onMenu={onMenu} onOpenNotifications={onOpenNotifications} onRefresh={onRefresh}>
        <EmptyState label="No reservation selected." />
      </DetailFrame>
    );
  }

  return (
    <DetailFrame
      error={error}
      loading={loading || detailLoading || Boolean(submitting)}
      loadingLabel={actionProcessLabel('reservation', submitting, 'Loading reservation detail')}
      title="Reservation Detail"
      onBack={onBack}
      onMenu={onMenu}
      onOpenNotifications={onOpenNotifications}
      onRefresh={loadDetail}>
      <InlineError message={inlineError} />
      <View style={styles.popupBadgeRow}>
        <StatusBadge label={firstRecordValue(record, ['status']) || 'Status'} tone={statusTone(firstRecordValue(record, ['status']))} />
      </View>
      <Text style={styles.popupBodyTitle}>{firstRecordValue(record, ['guest_name']) || reservation.guestName}</Text>

      <DetailSection title="Stay Summary">
        <InfoLine label="Reservation" value={firstRecordValue(record, ['reservation_no', 'booking_id', 'id'])} />
        <InfoLine label="Guest" value={firstRecordValue(record, ['guest_name', 'guest_id'])} />
        <InfoLine label="Phone" value={firstRecordValue(record, ['guest_phone', 'phone', 'whatsapp_phone']) || 'No phone'} />
        <InfoLine label="Room" value={firstRecordValue(record, ['room_number', 'room_id']) || 'Unassigned'} />
        <InfoLine label="Room Type" value={firstRecordValue(record, ['room_type']) || 'Not set'} />
        <InfoLine label="Check-in" value={compactDate(firstRecordValue(record, ['checkin_date', 'check_in_date']))} />
        <InfoLine label="Check-out" value={compactDate(firstRecordValue(record, ['checkout_date', 'check_out_date']))} />
        <InfoLine label="Source" value={firstRecordValue(record, ['source']) || 'Unknown'} />
      </DetailSection>

      <DetailSection title="Smart Actions">
        <ActionRow>
          <ActionButton disabled={Boolean(submitting)} label={submitting === 'check-in' ? 'Checking in...' : 'Check In'} tone="secondary" onPress={() => runLifecycle('check-in')} />
          <ActionButton disabled={Boolean(submitting)} label={submitting === 'check-out' ? 'Checking out...' : 'Check Out'} onPress={() => runLifecycle('check-out')} />
        </ActionRow>
        <ActionRow>
          <ActionButton disabled={Boolean(submitting)} label="Create Ticket" tone="secondary" onPress={onCreateTicket} />
          <ActionButton disabled={Boolean(submitting)} label={submitting === 'whatsapp' ? 'Opening...' : 'Open WhatsApp'} onPress={openWhatsApp} />
        </ActionRow>
      </DetailSection>

      <TimelineSection items={guests} title="Reservation Guests" />
      <TimelineSection items={stays} title="Stay Records" />
      <TimelineSection items={roomTypes} title="Room Type Assignments" />
      <TimelineSection items={messages} title="Reservation WhatsApp Messages" />
      <RecordFields record={record} title="Backend API Fields" />
    </DetailFrame>
  );
}

export function GuestDetailScreen({
  error,
  hotelId,
  loading,
  request,
  guest,
  onBack,
  onCreateTicket,
  onMenu,
  onOpenNotifications,
  onOpenWhatsAppConversation,
  onRefresh,
  onRefreshResource,
  onShowDialog,
}: DetailBaseProps & {
  guest: ArcadiaRecord | null;
  onCreateTicket: () => void;
  onOpenWhatsAppConversation: (conversation: ArcadiaRecord) => void;
}) {
  const guestId = firstRecordValue(guest, ['id', 'guest_id']);
  const [detail, setDetail] = useState<ArcadiaRecord | null>(null);
  const [consent, setConsent] = useState<ArcadiaRecord | null>(null);
  const [timeline, setTimeline] = useState<ArcadiaRecord[]>([]);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const record = useMemo(() => ({...(guest ?? {}), ...(detail ?? {})}), [detail, guest]);
  const name = firstRecordValue(record, ['name', 'guest_name', 'email']) || 'Guest';

  const loadDetail = useCallback(async () => {
    if (!guestId) {
      return;
    }
    setDetailLoading(true);
    setInlineError(null);
    const [detailResult, consentResult, timelineResult] = await Promise.allSettled([
      request<ArcadiaRecord>(`/api/v1/hotels/${hotelId}/guests/${guestId}`),
      request<ArcadiaRecord | null>(`/api/v1/hotels/${hotelId}/guests/${guestId}/consent`),
      request<ArcadiaRecord[]>(`/api/v1/hotels/${hotelId}/guests/${guestId}/timeline`),
    ]);

    if (detailResult.status === 'fulfilled' && detailResult.value.data) {
      setDetail(detailResult.value.data);
    } else if (detailResult.status === 'rejected') {
      setInlineError(formatErrorDetails(detailResult.reason, 'Guest detail failed'));
    }
    if (consentResult.status === 'fulfilled') {
      setConsent(consentResult.value.data ?? null);
    }
    if (timelineResult.status === 'fulfilled') {
      setTimeline(Array.isArray(timelineResult.value.data) ? timelineResult.value.data : []);
    }
    setDetailLoading(false);
  }, [guestId, hotelId, request]);

  useEffect(() => {
    setDetail(null);
    setConsent(null);
    setTimeline([]);
    loadDetail();
  }, [loadDetail]);

  const handleError = useCallback((nextError: unknown, fallback: string) => {
    const details = formatErrorDetails(nextError, fallback);
    setInlineError(details);
    onShowDialog(appErrorDialog(fallback, details));
  }, [onShowDialog]);

  async function openWhatsApp() {
    if (!guestId) {
      handleError(new Error('Guest ID is missing.'), 'WhatsApp conversation failed');
      return;
    }
    setSubmitting('whatsapp');
    try {
      const result = await request<{conversation_id: string; reservation_id: string | null}>(
        `/api/v1/hotels/${hotelId}/guests/${guestId}/conversation`,
      );
      if (!result.data?.conversation_id) {
        throw new Error('Conversation was not returned by the API.');
      }
      onOpenWhatsAppConversation({
        id: result.data.conversation_id,
        conversation_id: result.data.conversation_id,
        guest_id: guestId,
        guest_name: name,
        phone: firstRecordValue(record, ['whatsapp_phone', 'phone']),
        reservation_id: result.data.reservation_id,
        status: 'open',
      });
    } catch (nextError) {
      handleError(nextError, 'WhatsApp conversation failed');
    } finally {
      setSubmitting(null);
    }
  }

  async function updateGuestStatus(status: string) {
    if (!guestId) {
      return;
    }
    setSubmitting(status);
    try {
      await request<ArcadiaRecord>(
        `/api/v1/hotels/${hotelId}/guests/${guestId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({status}),
        },
      );
      onRefreshResource('guests');
      await loadDetail();
      onShowDialog({
        message: `Status changed to ${titleCase(status)}.`,
        title: 'Guest updated',
        tone: 'success',
      });
    } catch (nextError) {
      handleError(nextError, 'Guest update failed');
    } finally {
      setSubmitting(null);
    }
  }

  if (!guest) {
    return (
      <DetailFrame error={error} loading={loading} title="Guest Detail" onBack={onBack} onMenu={onMenu} onOpenNotifications={onOpenNotifications} onRefresh={onRefresh}>
        <EmptyState label="No guest selected." />
      </DetailFrame>
    );
  }

  return (
    <DetailFrame
      error={error}
      loading={loading || detailLoading || Boolean(submitting)}
      loadingLabel={actionProcessLabel('guest', submitting, 'Loading guest detail')}
      title="Guest Detail"
      onBack={onBack}
      onMenu={onMenu}
      onOpenNotifications={onOpenNotifications}
      onRefresh={loadDetail}>
      <InlineError message={inlineError} />
      <View style={styles.staffPopupHeader}>
        <Avatar label={name.charAt(0)} size={52} />
        <View>
          <Text style={styles.popupBodyTitle}>{name}</Text>
          <Text style={styles.caption}>
            {firstRecordValue(record, ['whatsapp_phone', 'phone', 'email']) || 'No contact saved'}
          </Text>
        </View>
      </View>

      <DetailSection title="Guest Summary">
        <InfoLine label="Status" value={firstRecordValue(record, ['status']) || 'Guest'} />
        <InfoLine label="Phone" value={firstRecordValue(record, ['phone']) || 'No phone'} />
        <InfoLine label="WhatsApp" value={firstRecordValue(record, ['whatsapp_phone']) || 'No WhatsApp'} />
        <InfoLine label="Email" value={firstRecordValue(record, ['email']) || 'No email'} />
        <InfoLine label="Check-in" value={compactDate(firstRecordValue(record, ['check_in_date'])) || 'Not set'} />
        <InfoLine label="Check-out" value={compactDate(firstRecordValue(record, ['check_out_date'])) || 'Not set'} />
        <InfoLine label="Reservations" value={firstRecordValue(record, ['reservation_count']) || '0'} />
        <InfoLine label="Conversation" value={isRecordTruthy(record, ['has_whatsapp_conversation']) ? 'Linked' : 'Create or link'} />
      </DetailSection>

      <DetailSection title="Smart Actions">
        <ActionRow>
          <ActionButton disabled={Boolean(submitting)} label={submitting === 'whatsapp' ? 'Opening...' : 'Open WhatsApp'} tone="secondary" onPress={openWhatsApp} />
          <ActionButton disabled={Boolean(submitting)} label="Create Ticket" onPress={onCreateTicket} />
        </ActionRow>
        <OptionRow
          label="Guest Status"
          options={[
            ['pre_arrival', 'Pre arrival'],
            ['checked_in', 'Checked in'],
            ['checked_out', 'Checked out'],
          ]}
          value={firstRecordValue(record, ['status'])}
          onChange={updateGuestStatus}
        />
      </DetailSection>

      {consent ? <RecordFields record={consent} title="Consent" /> : null}
      <TimelineSection items={timeline} title="Guest Timeline" />
      <RecordFields record={record} title="Backend API Fields" />
    </DetailFrame>
  );
}

export function WhatsAppConversationScreen({
  error,
  hotelId,
  loading,
  request,
  conversation,
  onBack,
  onCreateTicket,
  onMenu,
  onOpenNotifications,
  onRefresh,
  onRefreshResource,
  onShowDialog,
}: DetailBaseProps & {
  conversation: ArcadiaRecord | null;
  onCreateTicket: () => void;
}) {
  const conversationId = firstRecordValue(conversation, ['id', 'conversation_id']);
  const [conversationState, setConversationState] = useState<ArcadiaRecord | null>(conversation);
  const [messages, setMessages] = useState<ArcadiaRecord[]>([]);
  const [message, setMessage] = useState('');
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const record = useMemo(() => ({...(conversation ?? {}), ...(conversationState ?? {})}), [conversation, conversationState]);
  const status = firstRecordValue(record, ['status']) || 'open';
  const priority = firstRecordValue(record, ['priority']) || 'normal';

  const loadMessages = useCallback(async () => {
    if (!conversationId) {
      return;
    }
    setDetailLoading(true);
    setInlineError(null);
    try {
      const result = await request<ArcadiaRecord[]>(
        `/api/v1/hotels/${hotelId}/whatsapp/conversations/${conversationId}/messages`,
      );
      setMessages(Array.isArray(result.data) ? result.data : []);
    } catch (nextError) {
      setInlineError(formatErrorDetails(nextError, 'WhatsApp messages failed'));
    } finally {
      setDetailLoading(false);
    }
  }, [conversationId, hotelId, request]);

  useEffect(() => {
    setConversationState(conversation);
    setMessages([]);
    loadMessages();
  }, [conversation, loadMessages]);

  const handleError = useCallback((nextError: unknown, fallback: string) => {
    const details = formatErrorDetails(nextError, fallback);
    setInlineError(details);
    onShowDialog(appErrorDialog(fallback, details));
  }, [onShowDialog]);

  async function sendMessage(nextMessage = message) {
    const outgoing = nextMessage.trim();
    if (!outgoing || !conversationId) {
      return;
    }
    setSubmitting('send');
    try {
      await request<ArcadiaRecord>(
        `/api/v1/hotels/${hotelId}/whatsapp/conversations/${conversationId}/messages`,
        {
          method: 'POST',
          body: JSON.stringify(
            compactPayload({
              message: outgoing,
              reservation_id: firstRecordValue(record, ['reservation_id']) || undefined,
            }),
          ),
        },
      );
      setMessage('');
      onRefreshResource('whatsapp');
      await loadMessages();
    } catch (nextError) {
      handleError(nextError, 'WhatsApp send failed');
    } finally {
      setSubmitting(null);
    }
  }

  async function updateConversation(payload: ArcadiaRecord, successMessage: string) {
    if (!conversationId) {
      return;
    }
    setSubmitting(firstRecordValue(payload, ['status', 'priority', 'assigned_staff_id']) || 'conversation');
    try {
      const result = await request<ArcadiaRecord>(
        `/api/v1/hotels/${hotelId}/whatsapp/conversations/${conversationId}`,
        {
          method: 'PATCH',
          body: JSON.stringify(payload),
        },
      );
      setConversationState(result.data ?? {...record, ...payload});
      onRefreshResource('whatsapp');
      onShowDialog({
        message: successMessage,
        title: 'Conversation updated',
        tone: 'success',
      });
    } catch (nextError) {
      handleError(nextError, 'WhatsApp update failed');
    } finally {
      setSubmitting(null);
    }
  }

  if (!conversationId) {
    return (
      <DetailFrame error={error} loading={loading} title="WhatsApp Chat" onBack={onBack} onMenu={onMenu} onOpenNotifications={onOpenNotifications} onRefresh={onRefresh}>
        <EmptyState label="No WhatsApp conversation selected." />
      </DetailFrame>
    );
  }

  const quickReplies = [
    'Thanks for messaging us. We are checking this now.',
    'Can you share your room number so we can help faster?',
    'Your request has been logged with our team.',
    'This is resolved from our side. Please tell us if you need anything else.',
  ];

  return (
    <DetailFrame
      error={error}
      loading={loading || detailLoading || Boolean(submitting)}
      loadingLabel={actionProcessLabel('conversation', submitting, 'Loading WhatsApp chat')}
      title="WhatsApp Chat"
      onBack={onBack}
      onMenu={onMenu}
      onOpenNotifications={onOpenNotifications}
      onRefresh={loadMessages}>
      <InlineError message={inlineError} />
      <View style={styles.popupBadgeRow}>
        <StatusBadge label={status} tone={statusTone(status)} />
        <StatusBadge label={priority} tone={priorityTone(priority)} />
      </View>
      <Text style={styles.popupBodyTitle}>
        {firstRecordValue(record, ['guest_name', 'contact_name', 'name', 'phone']) || 'WhatsApp Conversation'}
      </Text>

      <DetailSection title="Conversation">
        <InfoLine label="Phone" value={firstRecordValue(record, ['phone', 'whatsapp_phone']) || 'No phone'} />
        <InfoLine label="Guest" value={firstRecordValue(record, ['guest_name', 'contact_name', 'name']) || 'Unlinked'} />
        <InfoLine label="Reservation" value={firstRecordValue(record, ['reservation_no', 'booking_id']) || 'None'} />
        <InfoLine label="Unread" value={firstRecordValue(record, ['unread_count', 'unread']) || '0'} />
        <InfoLine label="Last Message" value={compactDate(firstRecordValue(record, ['last_message_at', 'updated_at'])) || 'No messages'} />
      </DetailSection>

      <DetailSection title="Messages">
        <ScrollView
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          persistentScrollbar
          showsVerticalScrollIndicator
          style={styles.chatTranscriptScroll}
          contentContainerStyle={styles.chatTranscript}>
          {detailLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={blue} />
              <Text style={styles.caption}>Loading messages...</Text>
            </View>
          ) : messages.length ? (
            messages.map(item => {
              const outbound = firstRecordValue(item, ['direction']) === 'outbound';
              return (
                <Text
                  key={firstRecordValue(item, ['id', 'created_at', 'meta_message_id'])}
                  style={outbound ? styles.chatMessageAgent : styles.chatMessageGuest}>
                  {firstRecordValue(item, ['message_text', 'message', 'content', 'body', 'message_type'])}
                </Text>
              );
            })
          ) : (
            <Text style={styles.chatMessageGuest}>No messages in this conversation yet.</Text>
          )}
        </ScrollView>
        <View style={styles.popupComposer}>
          <TextInput
            multiline
            placeholder="Type a WhatsApp message..."
            placeholderTextColor="#94A3B8"
            style={[styles.popupComposerInput, styles.formInputMultiline]}
            value={message}
            onChangeText={setMessage}
          />
          <Pressable style={styles.popupSendButton} disabled={submitting === 'send'} onPress={() => sendMessage()}>
            <Send color={blue} size={18} strokeWidth={2.2} />
          </Pressable>
        </View>
      </DetailSection>

      <DetailSection title="Smart Actions">
        <ActionRow>
          <ActionButton label="Create Ticket" tone="secondary" onPress={onCreateTicket} />
          <ActionButton
            disabled={Boolean(submitting)}
            label={status === 'resolved' ? 'Reopen' : 'Mark Resolved'}
            onPress={() =>
              updateConversation(
                {status: status === 'resolved' ? 'open' : 'resolved'},
                status === 'resolved' ? 'Conversation reopened.' : 'Conversation marked resolved.',
              )
            }
          />
        </ActionRow>
        <OptionRow
          label="Priority"
          options={[
            ['normal', 'Normal'],
            ['high', 'High'],
            ['urgent', 'Urgent'],
          ]}
          value={priority}
          onChange={nextPriority => updateConversation({priority: nextPriority}, `Priority set to ${titleCase(nextPriority)}.`)}
        />
        <View style={styles.optionWrap}>
          {quickReplies.map(reply => (
            <Pressable key={reply} style={styles.optionPill} onPress={() => setMessage(reply)}>
              <Text style={styles.optionPillText}>{reply}</Text>
            </Pressable>
          ))}
        </View>
      </DetailSection>

      <RecordFields record={record} title="Backend API Fields" />
    </DetailFrame>
  );
}

function DetailFrame({
  actions,
  children,
  error,
  loading,
  loadingLabel,
  title,
  onBack,
  onMenu,
  onOpenNotifications,
  onRefresh,
}: {
  actions?: ActionMenuItem[];
  children: ReactNode;
  error: string | null;
  loading: boolean;
  loadingLabel?: string;
  title: string;
  onBack: () => void;
  onMenu: () => void;
  onOpenNotifications?: () => void;
  onRefresh: () => void;
}) {
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.screenContent}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} />}>
      <TopAppBar
        title={title}
        leftIcon={ChevronLeft}
        onLeftPress={onBack}
        rightIcon={Menu}
        notificationIcon={Bell}
        onRightPress={onMenu}
        onNotificationPress={onOpenNotifications}
        rightAccessory={actions ? <ActionMenu items={actions} /> : undefined}
      />
      <LoadingProcessCard
        active={loading}
        label={loadingLabel ?? `Loading ${title.toLowerCase()}`}
      />
      <ErrorNotice message={error} onRetry={onRefresh} />
      {children}
    </ScrollView>
  );
}

function DetailSection({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <View style={styles.contextBanner}>
      <Text style={styles.formLabel}>{title}</Text>
      {children}
    </View>
  );
}

function CollapsibleDetailSection({
  children,
  defaultExpanded = true,
  title,
}: {
  children: ReactNode;
  defaultExpanded?: boolean;
  title: string;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <View style={styles.contextBanner}>
      <Pressable
        style={styles.collapsibleSectionHeader}
        onPress={() => setExpanded(current => !current)}>
        <Text style={[styles.formLabel, styles.collapsibleSectionTitle]}>{title}</Text>
        <View
          style={[
            styles.collapsibleSectionIcon,
            expanded && styles.collapsibleSectionIconOpen,
          ]}>
          <ChevronRight color="#64748B" size={17} strokeWidth={2.2} />
        </View>
      </Pressable>
      {expanded ? <View style={styles.collapsibleSectionBody}>{children}</View> : null}
    </View>
  );
}

function ActionRow({children}: {children: ReactNode}) {
  return <View style={styles.popupActions}>{children}</View>;
}

type ActionButtonTone = 'primary' | 'secondary' | 'success' | 'warning' | 'danger';

function ActionButton({
  disabled,
  label,
  onPress,
  tone = 'primary',
}: {
  disabled?: boolean;
  label: string;
  onPress: () => void;
  tone?: ActionButtonTone;
}) {
  return (
    <Pressable
      disabled={disabled}
      style={[
        styles.popupActionButton,
        tone === 'secondary' && styles.secondaryActionButton,
        tone === 'success' && styles.successActionButton,
        tone === 'warning' && styles.warningActionButton,
        tone === 'danger' && styles.dangerActionButton,
        disabled && styles.disabledActionButton,
      ]}
      onPress={onPress}>
      <Text
        style={[
          styles.popupActionText,
          tone === 'secondary' && styles.secondaryActionText,
          tone === 'warning' && styles.warningActionText,
        ]}>
        {label}
      </Text>
    </Pressable>
  );
}

function EditableField({
  label,
  placeholder,
  value,
  multiline,
  onChangeText,
}: {
  label: string;
  placeholder?: string;
  value: string;
  multiline?: boolean;
  onChangeText: (value: string) => void;
}) {
  return (
    <View style={styles.formField}>
      <Text style={styles.formLabel}>{label}</Text>
      <TextInput
        multiline={multiline}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        style={[styles.formInput, multiline && styles.formInputMultiline]}
        value={value}
        onChangeText={onChangeText}
      />
    </View>
  );
}

function Many2OneField({
  createActionLabel,
  displayKeys,
  label,
  onCreateRecord,
  placeholder,
  records,
  selectedRecord,
  onSelect,
}: {
  createActionLabel?: string;
  displayKeys: string[];
  label: string;
  onCreateRecord?: (query: string) => Promise<ArcadiaRecord | null>;
  placeholder: string;
  records: ArcadiaRecord[];
  selectedRecord: ArcadiaRecord | null;
  onSelect: (record: ArcadiaRecord | null) => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(10);
  const [creating, setCreating] = useState(false);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const selectedTitle = firstRecordValue(selectedRecord, displayKeys);
  const filteredOptions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return records
      .filter(record => {
        if (!needle) {
          return true;
        }
        return displayKeys.some(key =>
          String(record[key] ?? '').toLowerCase().includes(needle),
        );
      });
  }, [displayKeys, query, records]);
  const options = useMemo(
    () => filteredOptions.slice(0, visibleCount),
    [filteredOptions, visibleCount],
  );
  const hasMoreOptions = visibleCount < filteredOptions.length;

  useEffect(() => {
    setVisibleCount(10);
    setPickerError(null);
  }, [query, open]);

  function loadMoreOptions() {
    if (hasMoreOptions) {
      setVisibleCount(current => Math.min(current + 10, filteredOptions.length));
    }
  }

  async function handleCreateRecord() {
    if (!onCreateRecord || creating) {
      return;
    }

    setCreating(true);
    setPickerError(null);
    try {
      const record = await onCreateRecord(query);
      if (record) {
        onSelect(record);
        setQuery('');
        setOpen(false);
      }
    } catch (nextError) {
      setPickerError(formatErrorDetails(nextError, 'Create record failed'));
    } finally {
      setCreating(false);
    }
  }

  return (
    <View style={styles.formField}>
      <Text style={styles.formLabel}>{label}</Text>
      {selectedTitle ? (
        <View style={styles.selectedLookupRow}>
          <Text style={styles.lookupTitle}>{selectedTitle}</Text>
          <Pressable
            onPress={() => {
              onSelect(null);
              setQuery('');
              setOpen(false);
            }}>
            <Text style={styles.inlineLinkText}>Clear</Text>
          </Pressable>
        </View>
      ) : null}
      <Pressable style={styles.lookupInputButton} onPress={() => setOpen(true)}>
        <Text
          numberOfLines={1}
          style={[
            styles.lookupInputText,
            !selectedTitle && styles.lookupPlaceholderText,
          ]}>
          {selectedTitle || placeholder}
        </Text>
        <ChevronRight color="#94A3B8" size={18} strokeWidth={2.2} />
      </Pressable>
      <Modal
        animationType="slide"
        transparent
        visible={open}
        onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.relationPickerBackdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.relationPickerSheet}>
            <View style={styles.quickDrawerHandle} />
            <View style={styles.relationPickerHeader}>
              <Text style={styles.relationPickerTitle}>{label}</Text>
              <Pressable style={styles.popupCloseButton} onPress={() => setOpen(false)}>
                <Text style={styles.popupCloseText}>x</Text>
              </Pressable>
            </View>
            <TextInput
              autoFocus
              placeholder={placeholder}
              placeholderTextColor="#94A3B8"
              style={styles.formInput}
              value={query}
              onChangeText={setQuery}
            />
            {onCreateRecord && createActionLabel ? (
              <Pressable
                disabled={creating}
                style={[
                  styles.lookupSmartAction,
                  creating && styles.disabledActionButton,
                ]}
                onPress={handleCreateRecord}>
                <Text style={styles.lookupSmartActionText}>
                  {creating
                    ? 'Creating...'
                    : query.trim()
                      ? `${createActionLabel}: ${query.trim()}`
                      : createActionLabel}
                </Text>
              </Pressable>
            ) : null}
            {pickerError ? (
              <View style={styles.formErrorBox}>
                <Text style={styles.formErrorTitle}>Action failed</Text>
                <Text style={styles.formErrorText}>{pickerError}</Text>
              </View>
            ) : null}
            <ScrollView
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              showsVerticalScrollIndicator
              style={styles.relationPickerList}
              onScroll={({nativeEvent}) => {
                const distanceFromBottom =
                  nativeEvent.contentSize.height -
                  (nativeEvent.contentOffset.y + nativeEvent.layoutMeasurement.height);
                if (distanceFromBottom < 72) {
                  loadMoreOptions();
                }
              }}
              scrollEventThrottle={16}>
              {options.length > 0 ? (
                options.map((record, index) => {
                  const title = firstRecordValue(record, displayKeys) || `Record ${index + 1}`;
                  const subtitle = firstRecordValue(record, [
                    'room_number',
                    'guest_name',
                    'phone',
                    'email',
                    'status',
                    'job_role',
                  ]);
                  return (
                    <Pressable
                      key={`${firstRecordValue(record, ['id', 'user_id', 'email', 'phone']) || title}-${index}`}
                      style={styles.lookupOption}
                      onPress={() => {
                        onSelect(record);
                        setQuery('');
                        setOpen(false);
                      }}>
                      <Text style={styles.lookupTitle}>{title}</Text>
                      {subtitle ? <Text style={styles.captionTiny}>{subtitle}</Text> : null}
                    </Pressable>
                  );
                })
              ) : (
                <Text style={styles.lookupEmpty}>No matching records</Text>
              )}
              <Text style={styles.lookupEmpty}>
                {hasMoreOptions ? 'Scroll for more records' : 'All matching records loaded'}
              </Text>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function OptionRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: [string, string][];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.formField}>
      <Text style={styles.formLabel}>{label}</Text>
      <View style={styles.optionWrap}>
        {options.map(([optionValue, optionLabel]) => {
          const active = normalize(value) === normalize(optionValue);
          return (
            <Pressable
              key={optionValue}
              style={[styles.optionPill, active && styles.activeOptionPill]}
              onPress={() => onChange(optionValue)}>
              <Text style={[styles.optionPillText, active && styles.activeOptionPillText]}>
                {optionLabel}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function InlineError({message}: {message: string | null}) {
  if (!message) {
    return null;
  }

  return (
    <View style={styles.formErrorBox}>
      <Text style={styles.formErrorTitle}>Action failed</Text>
      <Text style={styles.formErrorText}>{message}</Text>
    </View>
  );
}

type TicketActivityItem = {
  content: string;
  createdAt: string;
  id: string;
  raw: ArcadiaRecord;
  title: string;
  type: 'event' | 'note';
};

type RelationLabels = Record<string, string>;

type TicketWorkflowAction = {
  action?: string;
  body?: Record<string, unknown>;
  key: string;
  label: string;
  loadingLabel: string;
  menuLabel: string;
  note?: string;
  stage?: string;
  tone: ActionButtonTone;
};

function ActivityTimeline({
  items,
  note,
  noteSubmitting,
  onAddNote,
  onNoteChange,
}: {
  items: TicketActivityItem[];
  note: string;
  noteSubmitting: boolean;
  onAddNote: () => void;
  onNoteChange: (value: string) => void;
}) {
  return (
    <CollapsibleDetailSection defaultExpanded={false} title="Activity">
      <ScrollView
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        persistentScrollbar
        showsVerticalScrollIndicator
        style={styles.activityTimelineScroll}
        contentContainerStyle={styles.activityTimelineList}>
        {items.length ? (
          items.map(item => (
            <View key={`${item.type}-${item.id}`} style={styles.activityTimelineItem}>
              <View
                style={[
                  styles.activityTimelineDot,
                  item.type === 'note'
                    ? styles.activityTimelineDotNote
                    : styles.activityTimelineDotEvent,
                ]}
              />
              <View style={styles.activityTimelineText}>
                <Text style={styles.lookupTitle}>{item.title}</Text>
                <Text style={styles.caption}>{item.content}</Text>
                <Text style={styles.captionTiny}>{compactDate(item.createdAt)}</Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.caption}>No activity returned from this API.</Text>
        )}
      </ScrollView>
      <View style={styles.popupComposer}>
        <TextInput
          multiline
          placeholder="Add an internal update..."
          placeholderTextColor="#94A3B8"
          style={[styles.popupComposerInput, styles.formInputMultiline]}
          value={note}
          onChangeText={onNoteChange}
        />
        <Pressable style={styles.popupSendButton} disabled={noteSubmitting || !note.trim()} onPress={onAddNote}>
          <Send color={blue} size={18} strokeWidth={2.2} />
        </Pressable>
      </View>
    </CollapsibleDetailSection>
  );
}

function TicketGuestWhatsAppSection({
  canSend,
  hasGuestContext,
  items,
  message,
  messageSubmitting,
  onMessageChange,
  onSendMessage,
}: {
  canSend: boolean;
  hasGuestContext: boolean;
  items: ArcadiaRecord[];
  message: string;
  messageSubmitting: boolean;
  onMessageChange: (value: string) => void;
  onSendMessage: () => void;
}) {
  const [visibleCount, setVisibleCount] = useState(20);

  useEffect(() => {
    setVisibleCount(20);
  }, [items.length]);

  const visibleItems = useMemo(
    () => items.slice(Math.max(0, items.length - visibleCount)),
    [items, visibleCount],
  );
  const canLoadEarlier = visibleCount < items.length;

  return (
    <CollapsibleDetailSection defaultExpanded={false} title="Guest WhatsApp Messages">
      <ScrollView
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        persistentScrollbar
        scrollEventThrottle={16}
        showsVerticalScrollIndicator
        style={styles.chatTranscriptScroll}
        contentContainerStyle={styles.chatTranscript}
        onScroll={({nativeEvent}) => {
          if (nativeEvent.contentOffset.y <= 16 && canLoadEarlier) {
            setVisibleCount(current => Math.min(items.length, current + 20));
          }
        }}>
        {canLoadEarlier ? (
          <Text style={styles.captionTiny}>Scroll up to load earlier messages.</Text>
        ) : null}
        {visibleItems.length ? (
          visibleItems.map((item, index) => {
            const outbound =
              firstRecordValue(item, ['direction']) === 'outbound' ||
              firstRecordValue(item, ['sender_type']) === 'staff';
            return (
              <View
                key={`${firstRecordValue(item, ['id', 'created_at', 'meta_message_id'])}-${index}`}
                style={outbound ? styles.chatBubbleAgent : styles.chatBubbleGuest}>
                <Text style={outbound ? styles.chatBubbleAgentText : styles.chatBubbleGuestText}>
                  {firstRecordValue(item, ['message_text', 'message', 'content', 'body', 'message_type'])}
                </Text>
                <Text style={[styles.captionTiny, outbound && styles.chatBubbleAgentMeta]}>
                  {compactDate(firstRecordValue(item, ['created_at', 'timestamp', 'updated_at']))}
                </Text>
              </View>
            );
          })
        ) : (
          <Text style={styles.chatMessageGuest}>No guest WhatsApp messages linked to this ticket yet.</Text>
        )}
      </ScrollView>
      {canSend && hasGuestContext ? (
        <View style={styles.popupComposer}>
          <TextInput
            multiline
            placeholder="Type a WhatsApp message..."
            placeholderTextColor="#94A3B8"
            style={[styles.popupComposerInput, styles.formInputMultiline]}
            value={message}
            onChangeText={onMessageChange}
          />
          <Pressable
            style={styles.popupSendButton}
            disabled={messageSubmitting || !message.trim()}
            onPress={onSendMessage}>
            <Send color={blue} size={18} strokeWidth={2.2} />
          </Pressable>
        </View>
      ) : (
        <Text style={styles.caption}>
          {hasGuestContext
            ? 'WhatsApp send is available to staff with ticket assignment permission.'
            : 'Link a guest or WhatsApp conversation before sending a message.'}
        </Text>
      )}
    </CollapsibleDetailSection>
  );
}

function TimelineSection({
  defaultExpanded = true,
  items,
  title,
}: {
  defaultExpanded?: boolean;
  items: ArcadiaRecord[];
  title: string;
}) {
  return (
    <CollapsibleDetailSection defaultExpanded={defaultExpanded} title={title}>
      {items.length ? (
        items.map((item, index) => (
          <View key={`${firstRecordValue(item, ['id', 'created_at', 'timestamp'])}-${index}`} style={styles.lookupOption}>
            <Text style={styles.lookupTitle}>
              {firstRecordValue(item, ['title', 'event_type', 'sender_type', 'message_type', 'id']) || `Item ${index + 1}`}
            </Text>
            <Text style={styles.caption}>
              {firstRecordValue(item, ['description', 'content', 'message_text', 'message', 'status']) || compactRecord(item)}
            </Text>
            <Text style={styles.captionTiny}>
              {compactDate(firstRecordValue(item, ['created_at', 'timestamp', 'updated_at']))}
            </Text>
          </View>
        ))
      ) : (
        <Text style={styles.caption}>No records returned from this API.</Text>
      )}
    </CollapsibleDetailSection>
  );
}

function RecordFields({
  defaultExpanded = true,
  relationLabels = {},
  record,
  title,
}: {
  defaultExpanded?: boolean;
  relationLabels?: RelationLabels;
  record: ArcadiaRecord;
  title: string;
}) {
  const entries = Object.entries(record)
    .filter(([key, value]) => {
      if (key === 'id' || key.endsWith('_id')) {
        return false;
      }
      return value !== undefined && value !== null && text(value).trim() !== '';
    })
    .sort(([left], [right]) => left.localeCompare(right));

  if (!entries.length) {
    return null;
  }

  return (
    <CollapsibleDetailSection defaultExpanded={defaultExpanded} title={title}>
      {entries.map(([key, value]) => (
        <InfoLine key={key} label={formatKey(key)} value={formatValue(value, relationLabels)} />
      ))}
    </CollapsibleDetailSection>
  );
}

export function buildTicketActivityItems(
  timeline: ArcadiaRecord[],
  messages: ArcadiaRecord[],
): TicketActivityItem[] {
  const items: TicketActivityItem[] = [];
  const seen = new Set<string>();

  timeline.forEach((item, index) => {
    const itemType = firstRecordValue(item, ['item_type']);
    const id = firstRecordValue(item, ['id']) || `timeline-${index}`;
    const content = firstRecordValue(item, [
      'content',
      'description',
      'message_text',
      'message',
      'status',
    ]) || compactRecord(item);
    const isNote = itemType === 'message' || Boolean(firstRecordValue(item, ['sender_type']));
    const key = isNote ? `note:${id}` : `event:${id}`;

    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    items.push({
      content,
      createdAt: firstRecordValue(item, ['created_at', 'timestamp', 'updated_at']),
      id,
      raw: item,
      title: isNote
        ? `${titleCase(firstRecordValue(item, ['sender_type']) || 'Staff')} note`
        : titleCase(firstRecordValue(item, ['event_type', 'title']) || 'System event'),
      type: isNote ? 'note' : 'event',
    });
  });

  messages.forEach((message, index) => {
    const id = firstRecordValue(message, ['id']) || `message-${index}`;
    const key = `note:${id}`;
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    items.push({
      content: firstRecordValue(message, ['content', 'message_text', 'message']) || compactRecord(message),
      createdAt: firstRecordValue(message, ['created_at', 'timestamp', 'updated_at']),
      id,
      raw: message,
      title: `${titleCase(firstRecordValue(message, ['sender_type']) || 'Staff')} note`,
      type: 'note',
    });
  });

  return items.sort((left, right) => {
    const leftTime = Date.parse(left.createdAt);
    const rightTime = Date.parse(right.createdAt);
    if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) {
      return 0;
    }
    return leftTime - rightTime;
  });
}

export function ticketSmartActions(stage: string, options: {
  assignedToCurrentUser: boolean;
  canAccept: boolean;
  canApprove: boolean;
  canClose: boolean;
  canReject: boolean;
  canWorkTicket: boolean;
}): TicketWorkflowAction[] {
  const normalizedStage = normalize(stage);
  const actions: TicketWorkflowAction[] = [];

  if (
    normalizedStage === 'pending_accept' ||
    (['created', 'open'].includes(normalizedStage) && options.assignedToCurrentUser)
  ) {
    if (options.canAccept) {
      actions.push({
        action: 'accept',
        key: 'accept',
        label: 'Accept',
        loadingLabel: 'Accepting...',
        menuLabel: 'Accept Ticket',
        tone: 'primary',
      });
    }
    if (options.canReject) {
      actions.push({
        action: 'reject',
        body: {reason: 'Rejected from mobile app'},
        key: 'reject',
        label: 'Reject',
        loadingLabel: 'Rejecting...',
        menuLabel: 'Reject Ticket',
        tone: 'danger',
      });
    }
  }

  if (['accepted', 'reopened'].includes(normalizedStage) && options.canClose) {
    actions.push({
      key: 'stage:in_progress',
      label: 'Start Progress',
      loadingLabel: 'Starting...',
      menuLabel: 'Move to In Progress',
      stage: 'in_progress',
      tone: 'primary',
    });
  }

  if (['accepted', 'in_progress', 'reopened'].includes(normalizedStage) && options.canWorkTicket) {
    actions.push({
        action: 'complete',
        key: 'complete',
        label: 'Complete',
        loadingLabel: 'Completing...',
        menuLabel: 'Complete Ticket',
        tone: 'success',
    });
  }

  if (['pending_approval', 'completed'].includes(normalizedStage) && options.canApprove) {
    actions.push(
      {
        action: 'approve',
        key: 'approve',
        label: 'Approve',
        loadingLabel: 'Approving...',
        menuLabel: 'Approve Ticket',
        tone: 'success',
      },
      {
        action: 'reopen',
        key: 'reopen',
        label: 'Reopen',
        loadingLabel: 'Reopening...',
        menuLabel: 'Reopen Ticket',
        tone: 'warning',
      },
    );
  }

  if (['approved', 'closed'].includes(normalizedStage) && options.canApprove) {
    actions.push({
      action: 'reopen',
      key: 'reopen',
      label: 'Reopen',
      loadingLabel: 'Reopening...',
      menuLabel: 'Reopen Ticket',
      tone: 'warning',
    });
  }

  if (['created', 'open', 'pending_accept'].includes(normalizedStage) && options.canClose) {
    actions.push({
      key: 'stage:cancelled',
      label: 'Cancel',
      loadingLabel: 'Cancelling...',
      menuLabel: 'Cancel Ticket',
      stage: 'cancelled',
      tone: 'danger',
    });
  }

  return actions;
}

function compactPayload(payload: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => {
      if (value === undefined || value === null) {
        return false;
      }
      if (typeof value === 'string') {
        return value.trim() !== '';
      }
      return true;
    }),
  );
}

function compactRecord(record: ArcadiaRecord) {
  return Object.entries(record)
    .slice(0, 4)
    .map(([key, value]) => `${formatKey(key)}: ${formatValue(value)}`)
    .join(' / ');
}

function formatKey(key: string) {
  return key
    .replaceAll('_', ' ')
    .replace(/\b\w/g, match => match.toUpperCase());
}

export function buildRelationLabels(data: AppData, record: ArcadiaRecord = {}) {
  const labels: RelationLabels = {};

  const addRecord = (item: ArcadiaRecord, displayKeys: string[]) => {
    const label = firstRecordValue(item, displayKeys);
    if (!label) {
      return;
    }

    [
      'id',
      'user_id',
      'staff_id',
      'guest_id',
      'room_id',
      'reservation_id',
      'conversation_id',
      'assigned_to',
    ].forEach(key => {
      const id = firstRecordValue(item, [key]);
      if (id) {
        labels[id] = label;
      }
    });
  };

  data.staff.forEach(item => addRecord(item, ['name', 'full_name', 'email', 'id']));
  data.guests.forEach(item => addRecord(item, ['name', 'guest_name', 'full_name', 'phone', 'id']));
  data.rooms.forEach(item => addRecord(item, ['room_number', 'name', 'number', 'id']));
  data.reservations.forEach(item => addRecord(item.raw, ['reservation_no', 'booking_id', 'guest_name', 'id']));
  data.whatsapp.forEach(item => addRecord(item, ['guest_name', 'contact_name', 'phone', 'id']));

  const assignedTo = firstRecordValue(record, ['assigned_to', 'assigned_to_id', 'assigned_staff_id']);
  const assignedToName = firstRecordValue(record, ['assigned_to_name', 'assignee_name', 'staff_name']);
  if (assignedTo && assignedToName) {
    labels[assignedTo] = assignedToName;
  }

  const followerIds = record.followers;
  const followerNames = firstArrayValue(record, ['follower_names', 'followers_names']);
  if (Array.isArray(followerIds) && followerNames.length) {
    followerIds.forEach((id, index) => {
      const label = text(followerNames[index]);
      if (label) {
        labels[text(id)] = label;
      }
    });
  }

  return labels;
}

function firstArrayValue(record: ArcadiaRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value;
    }
  }
  return [];
}

export function formatValue(value: unknown, relationLabels: RelationLabels = {}): string {
  if (Array.isArray(value)) {
    const formatted: string[] = value
      .map(item => formatValue(item, relationLabels))
      .filter(Boolean);
    return formatted.length ? formatted.join(', ') : 'None';
  }
  if (value && typeof value === 'object') {
    const record = value as ArcadiaRecord;
    const displayName =
      firstRecordValue(record, ['name', 'full_name', 'guest_name', 'contact_name', 'room_number', 'reservation_no']) ||
      relationLabels[firstRecordValue(record, ['id', 'user_id', 'guest_id', 'room_id', 'reservation_id', 'conversation_id'])];
    if (displayName) {
      return displayName;
    }
    return Object.entries(record)
      .slice(0, 4)
      .map(([key, nestedValue]) => `${formatKey(key)}: ${formatValue(nestedValue, relationLabels)}`)
      .join(' / ');
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  const raw = text(value);
  return relationLabels[raw] ?? raw;
}

function actionProcessLabel(subject: string, action: string | null, fallback: string) {
  if (!action) {
    return fallback;
  }

  const labels: Record<string, string> = {
    'check-in': 'Completing check in',
    'check-out': 'Completing check out',
    'guest-whatsapp': 'Sending WhatsApp message',
    note: `Saving ${subject} note`,
    send: 'Sending WhatsApp message',
    stage: `Updating ${subject} stage`,
    whatsapp: 'Opening WhatsApp conversation',
  };

  if (action.startsWith('stage:')) {
    return `Updating ${subject} stage`;
  }

  return labels[action] ?? `${titleCase(action)} ${subject}`;
}

function titleCase(value: string) {
  return value
    .replaceAll('_', ' ')
    .replace(/\b\w/g, match => match.toUpperCase());
}

function stageValue(value: string) {
  const normalized = normalize(value);
  if (normalized.includes('progress')) {
    return 'in_progress';
  }
  if (normalized.includes('complete')) {
    return 'completed';
  }
  if (normalized.includes('approved') || normalized.includes('closed')) {
    return 'approved';
  }
  return normalized || 'accepted';
}

function normalize(value: string) {
  return value.toLowerCase().replaceAll(' ', '_');
}
