import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from 'react';
import {
  Pressable,
  Text,
  View
} from 'react-native';

import {
  EmptyState,
  InfoLine,
  StatusBadge
} from '../../../components/AppComponents';
import {appErrorDialog} from '../../../components/AppDialog';
import {MessageCircle} from '../../../components/icons';
import {firstRecordValue} from '../../../utils/dataUtils';
import {blue,
  styles} from '../../../theme/styles';
import {Permissions} from '../../../permissions/permissionCodes';
import {hasPermission} from '../../../permissions/rbac';
import type {TicketView} from '../../dashboard';

import {
  compactDate,
  priorityTone,
  statusTone
} from '../utils';
import {formatErrorDetails} from '../../../services/api';

import type {ArcadiaRecord,
  UserProfile} from '../../../types/domain';
import {
  ActionButton,
  ActionRow,
  DetailFrame,
  DetailSection,
  InlineError,
  RecordFields
} from './detail/DetailLayout';
import {ActivityTimeline,
  TicketGuestWhatsAppSection} from './detail/TicketDetailSections';
import type {DetailBaseProps,
  TicketWorkflowAction} from './detail/detailTypes';
import {
  actionProcessLabel,
  buildRelationLabels,
  buildTicketActivityItems,
  compactPayload,
  stageValue,
  ticketSmartActions
} from './detail/detailUtils';

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
