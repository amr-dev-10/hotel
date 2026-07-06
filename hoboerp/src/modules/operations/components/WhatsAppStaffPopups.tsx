import {
  useCallback,
  useEffect,
  useState
} from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View
} from 'react-native';

import {Avatar, InfoLine} from '../../../components/AppComponents';
import {type AppDialogRequest} from '../../../components/AppDialog';
import {Send} from '../../../components/icons';
import {firstRecordValue, isRecordTruthy} from '../../../utils/dataUtils';
import {blue, styles} from '../../../theme/styles';

import type {ResourceKey} from '../types';

import {Permissions} from '../../../permissions/permissionCodes';
import {hasAnyPermission} from '../../../permissions/rbac';

import type {ArcadiaRecord, UserProfile} from '../../../types/domain';
import {
  ContextBanner,
  EmptyPopupText,
  PopupActionButton
} from './popup/PopupFields';
import {compactPayload} from './popup/popupUtils';
import type {RequestFn} from './popup/popupTypes';

export function WhatsAppChat({
  conversation,
  hotelId,
  request,
  onCreateTicket,
  onError,
  onRefreshResource,
  onClose,
  onShowDialog,
}: {
  conversation: ArcadiaRecord | null;
  hotelId: string;
  request: RequestFn;
  onCreateTicket: () => void;
  onError: (error: unknown, fallback: string) => void;
  onRefreshResource: (resource: ResourceKey) => void;
  onClose: () => void;
  onShowDialog: (dialog: AppDialogRequest) => void;
}) {
  const conversationId = firstRecordValue(conversation, ['id', 'conversation_id']);
  const [messages, setMessages] = useState<ArcadiaRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');

  const loadMessages = useCallback(async () => {
    if (!conversationId) {
      return;
    }
    setLoading(true);
    try {
      const result = await request<ArcadiaRecord[]>(
        `/api/v1/hotels/${hotelId}/whatsapp/conversations/${conversationId}/messages`,
      );
      setMessages(Array.isArray(result.data) ? result.data : []);
    } catch (error) {
      onError(error, 'WhatsApp messages failed');
    } finally {
      setLoading(false);
    }
  }, [conversationId, hotelId, onError, request]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  async function sendMessage() {
    if (!message.trim() || !conversationId) {
      return;
    }
    setSending(true);
    try {
      await request(
        `/api/v1/hotels/${hotelId}/whatsapp/conversations/${conversationId}/messages`,
        {
          method: 'POST',
          body: JSON.stringify(
            compactPayload({
              message: message.trim(),
              reservation_id: firstRecordValue(conversation, ['reservation_id']) || undefined,
            }),
          ),
        },
      );
      setMessage('');
      await loadMessages();
      onRefreshResource('whatsapp');
    } catch (error) {
      onError(error, 'WhatsApp send failed');
    } finally {
      setSending(false);
    }
  }

  async function markResolved() {
    if (!conversationId) {
      return;
    }
    setSending(true);
    try {
      await request<ArcadiaRecord>(
        `/api/v1/hotels/${hotelId}/whatsapp/conversations/${conversationId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({status: 'resolved'}),
        },
      );
      onRefreshResource('whatsapp');
      onShowDialog({
        message: 'WhatsApp conversation marked resolved.',
        title: 'Conversation resolved',
        tone: 'success',
      });
      onClose();
    } catch (error) {
      onError(error, 'WhatsApp resolve failed');
    } finally {
      setSending(false);
    }
  }

  if (!conversationId) {
    return <EmptyPopupText text="No conversation record selected from API." />;
  }

  return (
    <View>
      <ContextBanner
        label="Conversation"
        value={[
          firstRecordValue(conversation, ['guest_name', 'contact_name', 'name']),
          firstRecordValue(conversation, ['phone', 'whatsapp_phone']),
        ]
          .filter(Boolean)
          .join(' / ')}
      />
      <View style={styles.chatTranscript}>
        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={blue} />
            <Text style={styles.caption}>Loading messages...</Text>
          </View>
        ) : messages.length ? (
          messages.map(item => {
            const outbound = firstRecordValue(item, ['direction']) === 'outbound';
            return (
              <Text
                key={firstRecordValue(item, ['id', 'created_at'])}
                style={outbound ? styles.chatMessageAgent : styles.chatMessageGuest}>
                {firstRecordValue(item, ['message_text', 'message', 'content', 'body', 'message_type'])}
              </Text>
            );
          })
        ) : (
          <Text style={styles.chatMessageGuest}>No messages in this conversation yet.</Text>
        )}
      </View>
      <View style={styles.popupComposer}>
        <TextInput
          placeholder="Type a message..."
          placeholderTextColor="#94A3B8"
          style={styles.popupComposerInput}
          value={message}
          onChangeText={setMessage}
        />
        <Pressable style={styles.popupSendButton} disabled={sending} onPress={sendMessage}>
          <Send color={blue} size={18} strokeWidth={2.2} />
        </Pressable>
      </View>
      <View style={styles.popupActions}>
        <PopupActionButton label="Create Ticket" tone="secondary" onPress={onCreateTicket} />
        <PopupActionButton
          label={sending ? 'Working...' : 'Mark Resolved'}
          disabled={sending}
          onPress={markResolved}
        />
      </View>
    </View>
  );
}

export function StaffProfile({
  hotelId,
  request,
  staff,
  user,
  onClose,
  onError,
  onRefreshResource,
  onShowDialog,
}: {
  hotelId: string;
  request: RequestFn;
  staff: ArcadiaRecord | null;
  user: UserProfile;
  onClose: () => void;
  onError: (error: unknown, fallback: string) => void;
  onRefreshResource: (resource: ResourceKey) => void;
  onShowDialog: (dialog: AppDialogRequest) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const staffId = firstRecordValue(staff, ['id', 'user_id']);
  const name = firstRecordValue(staff, ['name', 'full_name', 'email']) || 'Staff Member';
  const onDuty = isRecordTruthy(staff ?? {}, ['is_on_duty']);
  const active = isRecordTruthy(staff ?? {}, ['is_active']);
  const canUpdateDuty =
    user.id === staffId ||
    Boolean(user.is_hotel_owner) ||
    user.user_type === 'HOTEL_ADMIN' ||
    user.staff_level === 'admin' ||
    hasAnyPermission(user.permissions, [
      Permissions.USER_MANAGE,
      Permissions.STAFF_MANAGE,
    ]);

  async function updateStaff(payload: Record<string, unknown>, successLabel: string) {
    if (!staffId) {
      onError(new Error('Staff ID is missing from the selected record.'), 'Staff update failed');
      return;
    }
    setSubmitting(true);
    try {
      await request<ArcadiaRecord>(
        `/api/v1/hotels/${hotelId}/users/${staffId}`,
        {
          method: 'PATCH',
          body: JSON.stringify(payload),
        },
      );
      onRefreshResource('staff');
      onShowDialog({
        message: successLabel,
        title: 'Staff updated',
        tone: 'success',
      });
      onClose();
    } catch (error) {
      onError(error, 'Staff update failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View>
      <View style={styles.staffPopupHeader}>
        <Avatar label={name.charAt(0)} size={52} />
        <View>
          <Text style={styles.popupBodyTitle}>{name}</Text>
          <Text style={styles.caption}>{firstRecordValue(staff, ['job_role', 'role']) || 'Staff'}</Text>
        </View>
      </View>
      <InfoLine label="Email" value={firstRecordValue(staff, ['email']) || 'No email'} />
      <InfoLine label="Level" value={firstRecordValue(staff, ['staff_level', 'user_type']) || 'Staff'} />
      <InfoLine label="Duty" value={onDuty ? 'On duty' : 'Off duty'} />
      <InfoLine label="Account" value={active ? 'Active' : 'Inactive'} />
      {canUpdateDuty ? (
        <View style={styles.popupActions}>
          <PopupActionButton
            label={submitting ? 'Working...' : 'Set On Duty'}
            tone="secondary"
            disabled={submitting}
            onPress={() => updateStaff({is_on_duty: true}, 'Staff marked on duty.')}
          />
          <PopupActionButton
            label={submitting ? 'Working...' : 'Set Off Duty'}
            disabled={submitting}
            onPress={() => updateStaff({is_on_duty: false}, 'Staff marked off duty.')}
          />
        </View>
      ) : (
        <Text style={styles.popupBodyText}>
          Duty status can be changed by an owner, admin, or this staff member.
        </Text>
      )}
    </View>
  );
}
