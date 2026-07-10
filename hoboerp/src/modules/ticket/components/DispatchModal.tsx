import {useEffect, useMemo, useState} from 'react';
import {
  Modal,
  Pressable,
  Text,
  TextInput,
  Vibration,
  View,
} from 'react-native';

import {
  appErrorDialog,
  type AppDialogRequest,
} from '../../../components/AppDialog';
import {colors} from '../../../theme/colors';
import {styles} from '../../../theme/styles';
import {apiRequest, formatErrorDetails} from '../../../services/api';
import {
  type DispatchAlertState,
  useNotificationStore,
} from '../../../store/notificationStore';
import type {ArcadiaRecord} from '../../../types/domain';
import {updateTicketAction} from '../api/ticket.api';

type Props = {
  hotelId: string;
  onRefreshResource: (resource: 'tickets' | 'escalations' | 'notifications') => void;
  onShowDialog: (dialog: AppDialogRequest) => void;
  token: string;
};

export function DispatchModal({
  hotelId,
  onRefreshResource,
  onShowDialog,
  token,
}: Props) {
  const dispatch = useNotificationStore(state => state.activeDispatch);
  const setActiveDispatch = useNotificationStore(
    state => state.setActiveDispatch,
  );
  const markRead = useNotificationStore(state => state.markRead);
  const [loadingAction, setLoadingAction] = useState<'accept' | 'reject' | null>(
    null,
  );
  const [now, setNow] = useState(Date.now());
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');

  useEffect(() => {
    setRejecting(false);
    setReason('');
  }, [dispatch?.acceptance_id]);

  useEffect(() => {
    if (!dispatch) {
      return undefined;
    }

    Vibration.vibrate([0, 280, 140, 280]);
    const timer = setInterval(() => setNow(Date.now()), 1000);
    const vibration = setInterval(() => {
      Vibration.vibrate([0, 220, 120, 220]);
    }, 5000);

    return () => {
      clearInterval(timer);
      clearInterval(vibration);
      Vibration.cancel();
    };
  }, [dispatch]);

  const remaining = useMemo(() => {
    if (!dispatch?.expires_at) {
      return null;
    }
    return Math.max(0, Date.parse(dispatch.expires_at) - now);
  }, [dispatch?.expires_at, now]);

  if (!dispatch) {
    return null;
  }

  const activeDispatch = dispatch;
  const ticket = activeDispatch.ticket;
  const ticketLabel =
    ticket.ticket_code ?? ticket.title ?? compactId(ticket.id) ?? 'Ticket';
  const description =
    ticket.item_description ?? ticket.title ?? 'Incoming ticket dispatch';

  async function accept() {
    await completeDispatch(activeDispatch, 'accept');
  }

  async function reject() {
    if (!rejecting) {
      setRejecting(true);
      return;
    }
    await completeDispatch(activeDispatch, 'reject', reason.trim());
  }

  async function completeDispatch(
    activeDispatch: DispatchAlertState,
    action: 'accept' | 'reject',
    rejectionReason?: string,
  ) {
    setLoadingAction(action);
    try {
      await updateTicketAction(hotelId, activeDispatch.ticket.id, action, token, {
        reason:
          action === 'reject'
            ? rejectionReason || 'Rejected from mobile dispatch alert'
            : undefined,
      });
      await markNotificationRead(hotelId, token, activeDispatch.notification_id);
      if (activeDispatch.notification_id) {
        markRead(activeDispatch.notification_id);
      }
      setActiveDispatch(null);
      onRefreshResource('tickets');
      onRefreshResource('escalations');
      onRefreshResource('notifications');
      onShowDialog({
        message:
          action === 'accept'
            ? 'Ticket accepted. It is now assigned to you.'
            : 'Ticket rejected. Dispatch will continue to the next eligible staff member.',
        title: action === 'accept' ? 'Dispatch accepted' : 'Dispatch rejected',
        tone: 'success',
      });
    } catch (error) {
      onShowDialog(
        appErrorDialog(
          action === 'accept'
            ? 'Unable to accept dispatch'
            : 'Unable to reject dispatch',
          formatErrorDetails(error, 'Dispatch action failed.'),
        ),
      );
    } finally {
      setLoadingAction(null);
    }
  }

  return (
    <Modal animationType="fade" transparent visible onRequestClose={() => setActiveDispatch(null)}>
      <View style={styles.dispatchBackdrop}>
        <View style={styles.dispatchCard}>
          <View style={styles.dispatchHeader}>
            <View style={styles.dispatchPulse}>
              <Text style={styles.dispatchPulseText}>!</Text>
            </View>
            <View style={styles.dispatchHeaderText}>
              <Text style={styles.dispatchEyebrow}>New Ticket Dispatch</Text>
              <Text style={styles.dispatchTitle}>{ticketLabel}</Text>
            </View>
            <Pressable
              disabled={Boolean(loadingAction)}
              style={styles.dispatchCloseButton}
              onPress={() => setActiveDispatch(null)}>
              <Text style={styles.dispatchCloseText}>X</Text>
            </Pressable>
          </View>

          <Text style={styles.dispatchDescription}>{description}</Text>

          <View style={styles.dispatchInfoGrid}>
            <DispatchInfo
              label="Room"
              value={
                ticket.room_number
                  ? `Room ${ticket.room_number}`
                  : compactId(ticket.room_id) || 'Unassigned'
              }
            />
            <DispatchInfo
              label="Priority"
              value={ticket.priority ? `P${ticket.priority}` : 'Normal'}
            />
            <DispatchInfo label="Source" value={ticket.source ?? 'Operations'} />
          </View>

          <View style={styles.dispatchTimer}>
            <Text style={styles.dispatchTimerText}>
              {remaining == null
                ? 'Acceptance timer active'
                : remaining === 0
                  ? 'Offer may be expired'
                  : `Auto-escalates in ${formatRemaining(remaining)}`}
            </Text>
          </View>

          {rejecting ? (
            <View style={styles.dispatchRejectBox}>
              <TextInput
                multiline
                onChangeText={setReason}
                placeholder="Reason for rejection"
                placeholderTextColor={colors.disabledText}
                style={styles.dispatchReasonInput}
                value={reason}
              />
              <View style={styles.dispatchReasonChips}>
                {['Busy with another task', 'Not my area', 'Unable to attend'].map(
                  item => (
                    <Pressable
                      key={item}
                      style={styles.dispatchReasonChip}
                      onPress={() => setReason(item)}>
                      <Text style={styles.dispatchReasonChipText}>{item}</Text>
                    </Pressable>
                  ),
                )}
              </View>
            </View>
          ) : null}

          <View style={styles.dispatchActions}>
            <Pressable
              disabled={Boolean(loadingAction)}
              style={[styles.dispatchActionButton, styles.dispatchAcceptButton]}
              onPress={accept}>
              <Text style={styles.dispatchAcceptText}>
                {loadingAction === 'accept' ? 'Accepting...' : 'Accept'}
              </Text>
            </Pressable>
            <Pressable
              disabled={Boolean(loadingAction)}
              style={[styles.dispatchActionButton, styles.dispatchRejectButton]}
              onPress={reject}>
              <Text style={styles.dispatchRejectText}>
                {loadingAction === 'reject'
                  ? 'Rejecting...'
                  : rejecting
                    ? 'Confirm reject'
                    : 'Reject'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function DispatchInfo({label, value}: {label: string; value: string}) {
  return (
    <View style={styles.dispatchInfoBox}>
      <Text style={styles.dispatchInfoLabel}>{label}</Text>
      <Text style={styles.dispatchInfoValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

async function markNotificationRead(
  hotelId: string,
  token: string,
  notificationId?: string | null,
) {
  if (!notificationId) {
    return;
  }

  await apiRequest<ArcadiaRecord>(
    `/api/v1/hotels/${hotelId}/notifications/${notificationId}/read`,
    {
      method: 'POST',
      token,
    },
  ).catch(() => undefined);
}

function compactId(value?: string | null) {
  if (!value) {
    return '';
  }

  if (value.length <= 8) {
    return value;
  }

  return value.slice(0, 8);
}

function formatRemaining(ms: number) {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
