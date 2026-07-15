import {useState} from 'react';
import {
  Pressable,
  Text,
  View
} from 'react-native';

import {
  Avatar,
  InfoLine,
  StatusBadge
} from '../../../components/AppComponents';
import {type AppDialogRequest} from '../../../components/AppDialog';
import {Ticket} from '../../../components/icons';
import {firstRecordValue, isRecordTruthy} from '../../../utils/dataUtils';
import {blue, styles} from '../../../theme/styles';

import type {ReservationView} from '../../dashboard';
import type {ResourceKey} from '../types';
import {statusTone} from '../utils';

import type {ArcadiaRecord, UserProfile} from '../../../types/domain';
import {PopupActionButton} from './popup/PopupFields';

import type {RequestFn} from './popup/popupTypes';

export function ReservationDetail({
  reservation,
  onCheckIn,
  onCheckOut,
  onCreateTicket,
}: {
  reservation: ReservationView;
  onCheckIn: () => void;
  onCheckOut: () => void;
  onCreateTicket: () => void;
}) {
  return (
    <View>
      <View style={styles.popupBadgeRow}>
        <StatusBadge label={reservation.status} tone={statusTone(reservation.status)} />
      </View>
      <Text style={styles.popupBodyTitle}>{reservation.guestName}</Text>
      <InfoLine label="Booking ID" value={reservation.bookingId} />
      <InfoLine label="Room" value={reservation.roomNumber || 'Unassigned'} />
      <InfoLine label="Stay" value={reservation.stayDates} />
      <InfoLine label="Guests" value={`${reservation.adults} Adults / ${reservation.children} Children`} />
      <InfoLine label="Stage" value={reservation.status} />
      <View style={styles.popupActions}>
        <PopupActionButton label="Check In" tone="secondary" onPress={onCheckIn} />
        <PopupActionButton label="Check Out" onPress={onCheckOut} />
      </View>
      <Pressable style={styles.inlineLinkButton} onPress={onCreateTicket}>
        <Ticket color={blue} size={16} strokeWidth={2.2} />
        <Text style={styles.inlineLinkText}>Create guest ticket</Text>
      </Pressable>
    </View>
  );
}

export function ReservationLifecycle({
  hotelId,
  mode,
  request,
  reservation,
  user,
  onClose,
  onError,
  onRefreshResource,
  onReservationBack,
  onShowDialog,
}: {
  hotelId: string;
  mode: 'checkIn' | 'checkOut';
  request: RequestFn;
  reservation: ReservationView;
  user: UserProfile;
  onClose: () => void;
  onError: (error: unknown, fallback: string) => void;
  onRefreshResource: (resource: ResourceKey) => void;
  onReservationBack: () => void;
  onShowDialog: (dialog: AppDialogRequest) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const isCheckIn = mode === 'checkIn';

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await request<ArcadiaRecord>(
        `/api/v1/hotels/${hotelId}/reservations/${reservation.id}/${isCheckIn ? 'check-in' : 'check-out'}`,
        {
          method: 'POST',
          body: isCheckIn
            ? JSON.stringify({auto_assign: true, room_assignments: []})
            : undefined,
        },
      );
      onRefreshResource('reservations');
      onRefreshResource('rooms');
      onShowDialog({
        message: reservation.guestName,
        title: isCheckIn ? 'Check-in complete' : 'Check-out complete',
        tone: 'success',
      });
      onClose();
    } catch (error) {
      onError(error, isCheckIn ? 'Check-in failed' : 'Check-out failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View>
      <Text style={styles.popupBodyText}>
        {isCheckIn
          ? 'Confirm guest arrival, collect ID proof, and mark the room occupied.'
          : 'Confirm settlement, minibar review, and housekeeping handoff.'}
      </Text>
      <InfoLine label="Guest" value={reservation.guestName} />
      <InfoLine label="Room" value={reservation.roomNumber || 'Auto assign'} />
      <InfoLine label="Handled by" value={user.name ?? user.email} />
      <View style={styles.popupActions}>
        <PopupActionButton label="Back" tone="secondary" onPress={onReservationBack} />
        <PopupActionButton
          label={submitting ? 'Working...' : isCheckIn ? 'Complete Check In' : 'Complete Check Out'}
          disabled={submitting}
          onPress={handleSubmit}
        />
      </View>
    </View>
  );
}

export function GuestDetail({
  guest,
  hotelId,
  request,
  onCreateTicket,
  onError,
  onOpenWhatsAppConversation,
}: {
  guest: ArcadiaRecord;
  hotelId: string;
  request: RequestFn;
  onCreateTicket: () => void;
  onError: (error: unknown, fallback: string) => void;
  onOpenWhatsAppConversation: (conversation: ArcadiaRecord) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const guestId = firstRecordValue(guest, ['id', 'guest_id']);
  const name = firstRecordValue(guest, ['name', 'guest_name', 'email']);

  async function openWhatsApp() {
    if (!guestId) {
      onError(new Error('Guest ID is missing.'), 'WhatsApp conversation failed');
      return;
    }
    setSubmitting(true);
    try {
      const result = await request<{
        conversation_id: string;
        reservation_id: string | null;
      }>(`/api/v1/hotels/${hotelId}/guests/${guestId}/conversation`);
      const conversationId = result.data?.conversation_id;
      if (!conversationId) {
        throw new Error('Conversation was not returned by the API.');
      }
      onOpenWhatsAppConversation({
        id: conversationId,
        conversation_id: conversationId,
        guest_id: guestId,
        guest_name: name,
        phone: firstRecordValue(guest, ['whatsapp_phone', 'phone']),
        reservation_id: result.data?.reservation_id,
        status: 'open',
      });
    } catch (error) {
      onError(error, 'WhatsApp conversation failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View>
      <View style={styles.staffPopupHeader}>
        <Avatar label={(name || 'G').charAt(0)} size={52} />
        <View>
          <Text style={styles.popupBodyTitle}>{name || 'Guest'}</Text>
          <Text style={styles.caption}>
            {firstRecordValue(guest, ['whatsapp_phone', 'phone', 'email']) || 'No contact saved'}
          </Text>
        </View>
      </View>
      <InfoLine label="Status" value={firstRecordValue(guest, ['status']) || 'Guest'} />
      <InfoLine label="Reservations" value={firstRecordValue(guest, ['reservation_count']) || '0'} />
      <InfoLine
        label="WhatsApp"
        value={isRecordTruthy(guest, ['has_whatsapp_conversation']) ? 'Linked' : 'Create or link'}
      />
      <View style={styles.popupActions}>
        <PopupActionButton
          label={submitting ? 'Opening...' : 'Open WhatsApp'}
          tone="secondary"
          disabled={submitting}
          onPress={openWhatsApp}
        />
        <PopupActionButton label="Create Ticket" onPress={onCreateTicket} />
      </View>
    </View>
  );
}
