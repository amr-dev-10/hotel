import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View
} from 'react-native';

import {
  EmptyState,
  InfoLine,
  StatusBadge
} from '../../../components/AppComponents';
import {appErrorDialog} from '../../../components/AppDialog';
import {Send} from '../../../components/icons';
import {firstRecordValue} from '../../../utils/dataUtils';
import {colors} from '../../../theme/colors';
import {blue,
  styles} from '../../../theme/styles';

import {
  compactDate,
  priorityTone,
  statusTone
} from '../utils';
import {formatErrorDetails} from '../../../services/api';

import type {ArcadiaRecord} from '../../../types/domain';
import {
  ActionButton,
  ActionRow,
  DetailFrame,
  DetailSection,
  InlineError,
  OptionRow,
  RecordFields
} from './detail/DetailLayout';

import type {DetailBaseProps} from './detail/detailTypes';
import {
  actionProcessLabel,
  buildRelationLabels,
  compactPayload,
  titleCase
} from './detail/detailUtils';

export function WhatsAppConversationScreen({
  data,
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
  const relationLabels = useMemo(() => buildRelationLabels(data, record), [data, record]);
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
            placeholderTextColor={colors.disabledText}
            style={styles.popupComposerInput}
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

      <RecordFields record={record} relationLabels={relationLabels} title="Backend API Fields" />
    </DetailFrame>
  );
}
