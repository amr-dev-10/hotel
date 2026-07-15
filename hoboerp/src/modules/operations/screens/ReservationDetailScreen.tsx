import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import {
  EmptyState,
  InfoLine,
  StatusBadge
} from '../../../components/AppComponents';
import {appErrorDialog} from '../../../components/AppDialog';

import {firstRecordValue} from '../../../utils/dataUtils';
import {styles} from '../../../theme/styles';

import type {ReservationView} from '../../dashboard';

import {
  compactDate,
  statusTone,
} from '../utils';
import {formatErrorDetails} from '../../../services/api';

import type {ArcadiaRecord} from '../../../types/domain';
import {
  ActionButton,
  ActionRow,
  CollapsibleDetailSection,
  DetailFrame,
  DetailSection,
  EditableField,
  InlineError,
  Many2OneField,
  OptionRow,
  RecordFields,
  TimelineSection
} from './detail/DetailLayout';

import type {DetailBaseProps} from './detail/detailTypes';
import {
  actionProcessLabel,
  titleCase
} from './detail/detailUtils';

type ReservationEditPayload = {
  checkin_date: string;
  checkout_date: string;
  guest_id: string;
  guest_name: string | null;
  guest_phone: string | null;
  guest_whatsapp_phone: string | null;
  notes: string | null;
  room_id: string | null;
  source: string;
  status: string;
};

export function ReservationDetailScreen({
  data,
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
  const [editOpen, setEditOpen] = useState(false);
  const record = useMemo(() => ({...seedRecord, ...(detail ?? {})}), [detail, seedRecord]);
  const guestTimelineItems = useMemo(() => guests.map(formatReservationGuest), [guests]);
  const stayTimelineItems = useMemo(() => stays.map(formatStayRecord), [stays]);
  const roomTypeTimelineItems = useMemo(() => roomTypes.map(formatRoomTypeAssignment), [roomTypes]);

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

  async function updateReservation(payload: ReservationEditPayload) {
    if (!reservationId) {
      return;
    }
    const {
      guest_id: guestId,
      guest_name: guestName,
      guest_phone: guestPhone,
      guest_whatsapp_phone: guestWhatsappPhone,
      ...reservationPayload
    } = payload;
    setSubmitting('edit');
    setInlineError(null);
    try {
      await request<ArcadiaRecord>(
        `/api/v1/hotels/${hotelId}/reservations/${reservationId}`,
        {
          method: 'PUT',
          body: JSON.stringify(reservationPayload),
        },
      );
      if (guestId) {
        const guestPayload: Record<string, string | null> = {
          phone: guestPhone,
          whatsapp_phone: guestWhatsappPhone,
        };
        if (guestName?.trim()) {
          guestPayload.name = guestName.trim();
        }
        await request<ArcadiaRecord>(
          `/api/v1/hotels/${hotelId}/guests/${guestId}`,
          {
            method: 'PATCH',
            body: JSON.stringify(guestPayload),
          },
        );
      }
      onRefreshResource('reservations');
      onRefreshResource('rooms');
      onRefreshResource('guests');
      await loadDetail();
      setEditOpen(false);
      onShowDialog({
        message: 'Reservation details were updated.',
        title: 'Reservation saved',
        tone: 'success',
      });
    } catch (nextError) {
      handleError(nextError, 'Reservation update failed');
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

  const reservationNotes = firstRecordValue(record, ['notes']);

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
      <View style={styles.reservationGuestNameBox}>
        <Text style={styles.formLabel}>Reservation Guest</Text>
        <Text style={styles.reservationGuestNameTitle}>
          {firstRecordValue(record, ['guest_name']) || reservation.guestName}
        </Text>
        <Text style={styles.reservationGuestNameMeta}>
          {firstRecordValue(record, ['reservation_no', 'booking_id', 'id'])}
        </Text>
      </View>
      {reservationNotes ? (
        <View style={styles.reservationNotesBox}>
          <Text style={styles.formLabel}>Reservation Note</Text>
          <Text style={styles.reservationNotesText}>{reservationNotes}</Text>
        </View>
      ) : null}

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
          <ActionButton disabled={Boolean(submitting)} label={submitting === 'check-in' ? 'Checking in...' : 'Check In'} tone="success" onPress={() => runLifecycle('check-in')} />
          <ActionButton disabled={Boolean(submitting)} label={submitting === 'check-out' ? 'Checking out...' : 'Check Out'} tone="warning" onPress={() => runLifecycle('check-out')} />
        </ActionRow>
        <ActionRow>
          <ActionButton disabled={Boolean(submitting)} label="Edit Details" tone="secondary" onPress={() => setEditOpen(true)} />
          <ActionButton disabled={Boolean(submitting)} label="Create Ticket" tone="secondary" onPress={onCreateTicket} />
        </ActionRow>
        <ActionRow>
          <ActionButton disabled={Boolean(submitting)} label={submitting === 'whatsapp' ? 'Opening...' : 'Open WhatsApp'} onPress={openWhatsApp} />
        </ActionRow>
      </DetailSection>

      <TimelineSection items={guestTimelineItems} title="Reservation Guests" />
      <TimelineSection items={stayTimelineItems} title="Stay Records" />
      <TimelineSection items={roomTypeTimelineItems} title="Room Type Assignments" />
      <ReservationMessagesSection items={messages} />
      <RecordFields record={record} title="Backend API Fields" />
      <EditReservationModal
        data={data}
        isPending={submitting === 'edit'}
        open={editOpen}
        record={record}
        onClose={() => setEditOpen(false)}
        onSubmit={updateReservation}
      />
    </DetailFrame>
  );
}

function EditReservationModal({
  data,
  isPending,
  open,
  record,
  onClose,
  onSubmit,
}: {
  data: DetailBaseProps['data'];
  isPending: boolean;
  open: boolean;
  record: ArcadiaRecord;
  onClose: () => void;
  onSubmit: (payload: ReservationEditPayload) => Promise<void>;
}) {
  const [selectedRoom, setSelectedRoom] = useState<ArcadiaRecord | null>(null);
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestWhatsappPhone, setGuestWhatsappPhone] = useState('');
  const [status, setStatus] = useState('');
  const [checkinDate, setCheckinDate] = useState('');
  const [checkoutDate, setCheckoutDate] = useState('');
  const [source, setSource] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const roomId = firstRecordValue(record, ['room_id']);
    const existingRoom =
      data.rooms.find(room => firstRecordValue(room, ['id', 'room_id']) === roomId) ??
      (roomId
        ? {
            id: roomId,
            room_number: firstRecordValue(record, ['room_number']) || 'Assigned room',
            room_type: firstRecordValue(record, ['room_type']),
          }
        : null);
    setSelectedRoom(existingRoom);
    setGuestName(firstRecordValue(record, ['guest_name']));
    setGuestPhone(firstRecordValue(record, ['guest_phone', 'phone']));
    setGuestWhatsappPhone(firstRecordValue(record, ['guest_whatsapp_phone', 'whatsapp_phone']));
    setStatus(firstRecordValue(record, ['status']) || 'confirmed');
    setCheckinDate(toDateInput(firstRecordValue(record, ['checkin_date', 'check_in_date'])));
    setCheckoutDate(toDateInput(firstRecordValue(record, ['checkout_date', 'check_out_date'])));
    setSource(firstRecordValue(record, ['source']) || 'walk_in');
    setNotes(firstRecordValue(record, ['notes']));
    setFormError(null);
  }, [data.rooms, open, record]);

  function save() {
    if (!checkinDate || !checkoutDate || checkoutDate <= checkinDate) {
      setFormError('Checkout date must be after check-in date.');
      return;
    }
    if (guestName.trim().length > 0 && guestName.trim().length < 2) {
      setFormError('Guest name must be at least 2 characters.');
      return;
    }

    onSubmit({
      checkin_date: checkinDate,
      checkout_date: checkoutDate,
      guest_id: firstRecordValue(record, ['guest_id']),
      guest_name: guestName.trim() || null,
      guest_phone: guestPhone.trim() || null,
      guest_whatsapp_phone: guestWhatsappPhone.trim() || null,
      notes: notes.trim() || null,
      room_id: selectedRoom ? firstRecordValue(selectedRoom, ['id', 'room_id']) || null : null,
      source,
      status,
    });
  }

  return (
    <Modal animationType="fade" transparent visible={open} onRequestClose={onClose}>
      <Pressable style={styles.popupBackdrop} onPress={onClose}>
        <Pressable style={styles.popupCard}>
          <View style={styles.popupHeader}>
            <Text style={styles.popupTitle}>Edit Reservation</Text>
            <Pressable style={styles.popupCloseButton} onPress={onClose}>
              <Text style={styles.popupCloseText}>x</Text>
            </Pressable>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
            contentContainerStyle={styles.chatTranscript}>
            <InlineError message={formError} />
            <DetailSection title="Guest Contact">
              <EditableField
                label="Guest Name"
                placeholder="Guest name"
                value={guestName}
                onChangeText={setGuestName}
              />
              <EditableField
                label="Phone"
                placeholder="+91..."
                value={guestPhone}
                onChangeText={setGuestPhone}
              />
              <EditableField
                label="WhatsApp Phone"
                placeholder="Optional WhatsApp number"
                value={guestWhatsappPhone}
                onChangeText={setGuestWhatsappPhone}
              />
            </DetailSection>
            <DetailSection title="Stay Details">
              <Many2OneField
                displayKeys={['room_number', 'name', 'number', 'room_type']}
                label="Room"
                placeholder="Assign a room"
                records={data.rooms}
                selectedRecord={selectedRoom}
                onSelect={setSelectedRoom}
              />
              <OptionRow
                label="Status"
                options={[
                  ['booked', 'Booked'],
                  ['confirmed', 'Confirmed'],
                  ['checked_in', 'Checked In'],
                  ['checked_out', 'Checked Out'],
                  ['cancelled', 'Cancelled'],
                ]}
                value={status}
                onChange={setStatus}
              />
              <View style={styles.dualFieldRow}>
                <EditableField
                  label="Check-in"
                  placeholder="YYYY-MM-DD"
                  value={checkinDate}
                  onChangeText={setCheckinDate}
                />
                <EditableField
                  label="Check-out"
                  placeholder="YYYY-MM-DD"
                  value={checkoutDate}
                  onChangeText={setCheckoutDate}
                />
              </View>
              <OptionRow
                label="Source"
                options={[
                  ['walk_in', 'Walk-in'],
                  ['direct', 'Direct'],
                  ['ota', 'OTA'],
                  ['corporate', 'Corporate'],
                  ['whatsapp', 'WhatsApp'],
                ]}
                value={source}
                onChange={setSource}
              />
              <EditableField
                label="Notes"
                multiline
                placeholder="Special requests or internal notes"
                value={notes}
                onChangeText={setNotes}
              />
            </DetailSection>
            <ActionRow>
              <ActionButton disabled={isPending} label="Cancel" tone="secondary" onPress={onClose} />
              <ActionButton disabled={isPending} label={isPending ? 'Saving...' : 'Save'} onPress={save} />
            </ActionRow>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ReservationMessagesSection({items}: {items: ArcadiaRecord[]}) {
  return (
    <CollapsibleDetailSection title="Reservation WhatsApp Messages">
      <ScrollView
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        persistentScrollbar
        showsVerticalScrollIndicator
        style={styles.chatTranscriptScroll}
        contentContainerStyle={styles.chatTranscript}>
        {items.length ? (
          items.map((item, index) => {
            const outbound =
              firstRecordValue(item, ['direction']) === 'outbound' ||
              firstRecordValue(item, ['sender_type']) === 'staff';
            const sender = outbound
              ? firstRecordValue(item, ['staff_name', 'sender_name', 'agent_name']) || 'Staff'
              : firstRecordValue(item, ['guest_name', 'contact_name', 'sender_name']) || 'Guest';

            return (
              <View
                key={`${firstRecordValue(item, ['id', 'created_at', 'meta_message_id'])}-${index}`}
                style={outbound ? styles.chatBubbleAgent : styles.chatBubbleGuest}>
                <Text style={[styles.captionTiny, outbound && styles.chatBubbleAgentMeta]}>
                  {sender}
                </Text>
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
          <Text style={styles.chatMessageGuest}>No reservation WhatsApp messages returned from this API.</Text>
        )}
      </ScrollView>
    </CollapsibleDetailSection>
  );
}

function formatReservationGuest(item: ArcadiaRecord): ArcadiaRecord {
  const name = firstRecordValue(item, ['guest_name', 'name', 'full_name']) || 'Reservation guest';
  const relationship = titleCase(firstRecordValue(item, ['relationship']) || 'Guest');
  const phone = firstRecordValue(item, ['guest_whatsapp_phone', 'guest_phone', 'whatsapp_phone', 'phone']);
  const primary = firstRecordValue(item, ['is_primary']) === 'true' ? 'Primary' : '';

  return {
    ...item,
    description: [primary, relationship, phone].filter(Boolean).join(' / ') || 'Reservation guest',
    timestamp: firstRecordValue(item, ['added_at', 'created_at', 'updated_at']),
    title: name,
  };
}

function formatStayRecord(item: ArcadiaRecord): ArcadiaRecord {
  const roomNumber = firstRecordValue(item, ['room_number']);
  const roomType = firstRecordValue(item, ['room_type']);
  const checkin = compactDate(firstRecordValue(item, ['actual_checkin']));
  const checkout = compactDate(firstRecordValue(item, ['actual_checkout']));
  const notes = firstRecordValue(item, ['notes']);

  return {
    ...item,
    description: [
      checkin ? `In ${checkin}` : '',
      checkout ? `Out ${checkout}` : 'Current stay',
      notes,
    ].filter(Boolean).join(' / '),
    timestamp: firstRecordValue(item, ['actual_checkin', 'created_at', 'updated_at']),
    title: roomNumber
      ? `Room ${roomNumber}${roomType ? ` - ${roomType}` : ''}`
      : 'Unassigned room',
  };
}

function formatRoomTypeAssignment(item: ArcadiaRecord): ArcadiaRecord {
  const roomType = firstRecordValue(item, ['room_type_name', 'room_type']) || 'Booked room type';
  const assignedRoom = firstRecordValue(item, ['assigned_room_number']);
  const assignedType = firstRecordValue(item, ['assigned_room_type']);
  const quantity = firstRecordValue(item, ['quantity']) || '1';

  return {
    ...item,
    description: [
      `${quantity} room${quantity === '1' ? '' : 's'}`,
      assignedRoom ? `Assigned room ${assignedRoom}${assignedType ? ` - ${assignedType}` : ''}` : 'Not assigned yet',
    ].join(' / '),
    timestamp: firstRecordValue(item, ['assigned_at', 'created_at', 'updated_at']),
    title: roomType,
  };
}

function toDateInput(value: string) {
  return value.includes('T') ? value.slice(0, 10) : value;
}
