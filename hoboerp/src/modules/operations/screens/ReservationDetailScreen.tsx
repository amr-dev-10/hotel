import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from 'react';
import {Text,
  View} from 'react-native';

import {
  EmptyState,
  InfoLine,
  StatusBadge
} from '../../../components/AppComponents';
import {appErrorDialog} from '../../../components/AppDialog';

import {firstRecordValue} from '../../../utils/dataUtils';
import {styles} from '../../../theme/styles';

import type {ReservationView} from '../../dashboard';

import {compactDate,
  statusTone} from '../utils';
import {formatErrorDetails} from '../../../services/api';

import type {ArcadiaRecord} from '../../../types/domain';
import {
  ActionButton,
  ActionRow,
  DetailFrame,
  DetailSection,
  InlineError,
  RecordFields,
  TimelineSection
} from './detail/DetailLayout';

import type {DetailBaseProps} from './detail/detailTypes';
import {
  actionProcessLabel
} from './detail/detailUtils';

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
