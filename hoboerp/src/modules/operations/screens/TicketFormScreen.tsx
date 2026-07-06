import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from 'react';

import { appErrorDialog } from '../../../components/AppDialog';

import { firstRecordValue } from '../../../utils/dataUtils';

import { Permissions } from '../../../permissions/permissionCodes';
import { hasPermission } from '../../../permissions/rbac';
import type { ReservationView } from '../../dashboard';

import { formatErrorDetails } from '../../../services/api';

import type {
  ArcadiaRecord,
  UserProfile
} from '../../../types/domain';
import {
  ActionButton,
  ActionRow,
  DetailFrame,
  DetailSection,
  EditableField,
  InlineError,
  Many2OneField,
  OptionRow
} from './detail/DetailLayout';

import type { DetailBaseProps } from './detail/detailTypes';
import {
  compactPayload
} from './detail/detailUtils';

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
      <DetailSection title="">
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

      <DetailSection title="">
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

      <DetailSection title="">
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
