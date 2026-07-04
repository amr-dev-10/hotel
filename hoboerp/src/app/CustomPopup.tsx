import {useCallback, useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import {Avatar, InfoLine, StatusBadge} from './AppComponents';
import {Eye, Send, Ticket} from './icons';
import {firstRecordValue, isRecordTruthy} from './dataUtils';
import {blue, styles} from './styles';
import type {PopupKey} from './types';
import type {AppData, ReservationView, TicketView} from '../modules/dashboard';
import type {ResourceKey} from '../modules/operations/types';
import {priorityTone, statusTone} from '../modules/operations/utils';
import {formatErrorDetails} from '../services/api';
import type {ApiEnvelope} from '../types/api';
import type {ArcadiaRecord, UserProfile} from '../types/domain';

type RequestFn = <T>(
  path: string,
  options?: RequestInit,
) => Promise<ApiEnvelope<T>>;

export function CustomPopup({
  conversation,
  data,
  guest,
  popup,
  request,
  reservation,
  room,
  selectedLabel,
  staff,
  ticket,
  user,
  onCheckIn,
  onCheckOut,
  onClose,
  onCreateTicket,
  onOpenWhatsAppConversation,
  onRefreshResource,
  onReservationBack,
}: {
  conversation: ArcadiaRecord | null;
  data: AppData;
  guest: ArcadiaRecord | null;
  popup: PopupKey;
  request: RequestFn;
  reservation: ReservationView | null;
  room: ArcadiaRecord | null;
  selectedLabel: string;
  staff: ArcadiaRecord | null;
  ticket: TicketView | null;
  user: UserProfile;
  onCheckIn: () => void;
  onCheckOut: () => void;
  onClose: () => void;
  onCreateTicket: () => void;
  onOpenWhatsAppConversation: (conversation: ArcadiaRecord) => void;
  onRefreshResource: (resource: ResourceKey) => void;
  onReservationBack: () => void;
}) {
  const visible = popup !== null;
  const title = getPopupTitle(popup, selectedLabel, conversation, guest, staff);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
  }, [popup]);

  const handleError = useCallback((nextError: unknown, fallback: string) => {
    const details = formatErrorDetails(nextError, fallback);
    setError(details);
    Alert.alert(fallback, details);
  }, []);

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.popupBackdrop} onPress={onClose}>
        <Pressable style={styles.popupCard}>
          <View style={styles.popupHeader}>
            <Text style={styles.popupTitle}>{title}</Text>
            <Pressable style={styles.popupCloseButton} onPress={onClose}>
              <Text style={styles.popupCloseText}>x</Text>
            </Pressable>
          </View>
          {error ? <InlineFormError message={error} /> : null}
          <ScrollView showsVerticalScrollIndicator={false}>
            {popup === 'ticketForm' ? (
              <TicketForm
                conversation={conversation}
                data={data}
                guest={guest}
                hotelId={user.hotel_id}
                request={request}
                reservation={reservation}
                onClose={onClose}
                onError={handleError}
                onRefreshResource={onRefreshResource}
              />
            ) : null}

            {popup === 'reservationForm' ? (
              <ReservationForm
                data={data}
                hotelId={user.hotel_id}
                request={request}
                onClose={onClose}
                onError={handleError}
                onRefreshResource={onRefreshResource}
              />
            ) : null}

            {popup === 'roomForm' ? (
              <RoomForm
                hotelId={user.hotel_id}
                request={request}
                room={room}
                onClose={onClose}
                onError={handleError}
                onRefreshResource={onRefreshResource}
              />
            ) : null}

            {popup === 'ticketDetail' && ticket ? (
              <TicketDetail
                data={data}
                hotelId={user.hotel_id}
                request={request}
                ticket={ticket}
                onClose={onClose}
                onError={handleError}
                onRefreshResource={onRefreshResource}
              />
            ) : null}

            {popup === 'reservationDetail' && reservation ? (
              <ReservationDetail
                reservation={reservation}
                onCheckIn={onCheckIn}
                onCheckOut={onCheckOut}
                onCreateTicket={onCreateTicket}
              />
            ) : null}

            {(popup === 'checkIn' || popup === 'checkOut') && reservation ? (
              <ReservationLifecycle
                hotelId={user.hotel_id}
                mode={popup}
                request={request}
                reservation={reservation}
                user={user}
                onClose={onClose}
                onError={handleError}
                onRefreshResource={onRefreshResource}
                onReservationBack={onReservationBack}
              />
            ) : null}

            {popup === 'guestDetail' && guest ? (
              <GuestDetail
                guest={guest}
                hotelId={user.hotel_id}
                request={request}
                onCreateTicket={onCreateTicket}
                onError={handleError}
                onOpenWhatsAppConversation={onOpenWhatsAppConversation}
              />
            ) : null}

            {popup === 'whatsappChat' ? (
              <WhatsAppChat
                conversation={conversation}
                hotelId={user.hotel_id}
                request={request}
                onCreateTicket={onCreateTicket}
                onError={handleError}
                onRefreshResource={onRefreshResource}
                onClose={onClose}
              />
            ) : null}

            {popup === 'profileOption' ? (
              <View>
                {selectedLabel === 'Change Password' ? (
                  <>
                    <PasswordField
                      label="New Password"
                      visible={showPassword}
                      onToggleVisible={() => setShowPassword(current => !current)}
                    />
                    <PasswordField
                      label="Confirm Password"
                      visible={showConfirmPassword}
                      onToggleVisible={() =>
                        setShowConfirmPassword(current => !current)
                      }
                    />
                    <View style={styles.popupActions}>
                      <PopupActionButton label="Cancel" tone="secondary" onPress={onClose} />
                      <PopupActionButton label="Update Password" onPress={onClose} />
                    </View>
                  </>
                ) : selectedLabel === 'App Settings' ? (
                  <>
                    <InfoLine label="Account" value={user.email} />
                    <InfoLine label="Hotel" value={user.hotel_id} />
                    <InfoLine label="Theme" value="System default" />
                    <InfoLine label="Notifications" value="Enabled" />
                    <PopupActionButton label="Done" onPress={onClose} />
                  </>
                ) : (
                  <>
                    <InfoLine label="Name" value={user.name ?? user.email} />
                    <InfoLine label="Role" value={user.job_role ?? user.user_type ?? ''} />
                    <InfoLine label="Hotel" value={user.hotel_id} />
                    <Text style={styles.popupBodyText}>
                      {selectedLabel} is connected to the authenticated profile context.
                    </Text>
                    <PopupActionButton label="Done" onPress={onClose} />
                  </>
                )}
              </View>
            ) : null}

            {popup === 'staffProfile' ? (
              <StaffProfile
                hotelId={user.hotel_id}
                request={request}
                staff={staff}
                onClose={onClose}
                onError={handleError}
                onRefreshResource={onRefreshResource}
              />
            ) : null}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function TicketForm({
  conversation,
  data,
  guest,
  hotelId,
  request,
  reservation,
  onClose,
  onError,
  onRefreshResource,
}: {
  conversation: ArcadiaRecord | null;
  data: AppData;
  guest: ArcadiaRecord | null;
  hotelId: string;
  request: RequestFn;
  reservation: ReservationView | null;
  onClose: () => void;
  onError: (error: unknown, fallback: string) => void;
  onRefreshResource: (resource: ResourceKey) => void;
}) {
  const [description, setDescription] = useState('');
  const [departmentKey, setDepartmentKey] = useState('housekeeping');
  const [ticketType, setTicketType] = useState('Ticket');
  const [priority, setPriority] = useState(2);
  const [taskCategory, setTaskCategory] = useState('');
  const [selectedRoom, setSelectedRoom] = useState<ArcadiaRecord | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<ArcadiaRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const conversationId = firstRecordValue(conversation, ['id', 'conversation_id']);
  const reservationId =
    reservation?.id || firstRecordValue(conversation, ['reservation_id']);
  const guestId = firstRecordValue(guest, ['id', 'guest_id']) || firstRecordValue(conversation, ['guest_id']);

  useEffect(() => {
    if (!reservation?.roomNumber) {
      return;
    }
    const match = data.rooms.find(
      item => firstRecordValue(item, ['room_number', 'name', 'number']) === reservation.roomNumber,
    );
    if (match) {
      setSelectedRoom(match);
    }
  }, [data.rooms, reservation?.roomNumber]);

  async function handleSubmit() {
    if (description.trim().length < 2) {
      onError(new Error('Issue description must be at least 2 characters.'), 'Ticket validation failed');
      return;
    }

    setSubmitting(true);
    try {
      const selectedRoomId = firstRecordValue(selectedRoom, ['id', 'room_id']);
      const selectedStaffId = firstRecordValue(selectedStaff, ['id', 'user_id']);
      const payload = compactPayload({
        assigned_to: selectedStaffId || undefined,
        conversation_id: conversationId || undefined,
        department_key: departmentKey,
        guest_id: guestId || undefined,
        item_description: description.trim(),
        priority,
        reservation_id: reservationId || undefined,
        room_id: selectedRoomId || undefined,
        source: 'MOBILE',
        task_category: taskCategory.trim() || undefined,
        type: ticketType,
      });

      const result = await request<ArcadiaRecord>(
        `/api/v1/hotels/${hotelId}/tickets`,
        {
          method: 'POST',
          body: JSON.stringify(payload),
        },
      );
      onRefreshResource('tickets');
      if (conversationId) {
        onRefreshResource('whatsapp');
      }
      Alert.alert(
        'Ticket created',
        firstRecordValue(result.data, ['ticket_code', 'code', 'id']) || 'Ticket created successfully.',
      );
      onClose();
    } catch (error) {
      onError(error, 'Ticket create failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View>
      {reservationId || conversationId || guestId ? (
        <ContextBanner
          label="Linked context"
          value={[
            reservationId ? `Reservation ${reservation?.bookingId ?? reservationId}` : '',
            conversationId ? `WhatsApp ${conversationId}` : '',
            guestId ? `Guest ${firstRecordValue(guest, ['name', 'guest_name']) || guestId}` : '',
          ]
            .filter(Boolean)
            .join(' / ')}
        />
      ) : null}
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
        value={String(priority)}
        onChange={value => setPriority(Number(value))}
      />
      <LookupField
        displayKeys={['room_number', 'name', 'number']}
        label="Room"
        placeholder="Search room number"
        records={data.rooms}
        selectedRecord={selectedRoom}
        onSelect={setSelectedRoom}
      />
      <LookupField
        displayKeys={['name', 'full_name', 'email']}
        label="Assign Staff"
        placeholder="Search staff member"
        records={data.staff}
        selectedRecord={selectedStaff}
        onSelect={setSelectedStaff}
      />
      <EditableField
        label="Category"
        placeholder="housekeeping, maintenance, request..."
        value={taskCategory}
        onChangeText={setTaskCategory}
      />
      <View style={styles.popupActions}>
        <PopupActionButton label="Cancel" tone="secondary" onPress={onClose} />
        <PopupActionButton
          label={submitting ? 'Creating...' : 'Create Ticket'}
          disabled={submitting}
          onPress={handleSubmit}
        />
      </View>
    </View>
  );
}

function ReservationForm({
  data,
  hotelId,
  request,
  onClose,
  onError,
  onRefreshResource,
}: {
  data: AppData;
  hotelId: string;
  request: RequestFn;
  onClose: () => void;
  onError: (error: unknown, fallback: string) => void;
  onRefreshResource: (resource: ResourceKey) => void;
}) {
  const [guestName, setGuestName] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [checkinDate, setCheckinDate] = useState(todayIso());
  const [checkoutDate, setCheckoutDate] = useState(addDaysIso(1));
  const [source, setSource] = useState('walk_in');
  const [notes, setNotes] = useState('');
  const [selectedGuest, setSelectedGuest] = useState<ArcadiaRecord | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<ArcadiaRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!selectedGuest) {
      return;
    }
    setGuestName(firstRecordValue(selectedGuest, ['name', 'guest_name']));
    setPhone(firstRecordValue(selectedGuest, ['phone']));
    setWhatsappPhone(firstRecordValue(selectedGuest, ['whatsapp_phone']));
  }, [selectedGuest]);

  async function handleSubmit() {
    if (!selectedGuest && guestName.trim().length < 2) {
      onError(new Error('Guest name is required for a new reservation.'), 'Reservation validation failed');
      return;
    }
    if (!checkinDate || !checkoutDate || checkoutDate <= checkinDate) {
      onError(new Error('Checkout date must be after check-in date.'), 'Reservation validation failed');
      return;
    }

    setSubmitting(true);
    try {
      const selectedGuestId = firstRecordValue(selectedGuest, ['id', 'guest_id']);
      const selectedRoomId = firstRecordValue(selectedRoom, ['id', 'room_id']);
      await request<ArcadiaRecord>(`/api/v1/hotels/${hotelId}/reservations`, {
        method: 'POST',
        body: JSON.stringify(
          compactPayload({
            checkin_date: checkinDate,
            checkout_date: checkoutDate,
            guest_name: guestName.trim(),
            guests: selectedGuestId
              ? [{guest_id: selectedGuestId, is_primary: true, relationship: 'self'}]
              : undefined,
            notes: notes.trim() || undefined,
            phone: phone.trim() || undefined,
            room_id: selectedRoomId || undefined,
            source,
            whatsapp_phone: whatsappPhone.trim() || undefined,
          }),
        ),
      });
      onRefreshResource('reservations');
      onRefreshResource('guests');
      onRefreshResource('rooms');
      Alert.alert('Reservation created', 'Reservation saved successfully.');
      onClose();
    } catch (error) {
      onError(error, 'Reservation create failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View>
      <LookupField
        displayKeys={['name', 'guest_name', 'phone', 'whatsapp_phone', 'email']}
        label="Existing Guest"
        placeholder="Search saved guest or leave blank"
        records={data.guests}
        selectedRecord={selectedGuest}
        onSelect={setSelectedGuest}
      />
      <EditableField
        label="Guest Name"
        placeholder="Full name"
        value={guestName}
        onChangeText={setGuestName}
      />
      <EditableField
        label="Phone"
        placeholder="+91..."
        value={phone}
        onChangeText={setPhone}
      />
      <EditableField
        label="WhatsApp Phone"
        placeholder="Optional WhatsApp number"
        value={whatsappPhone}
        onChangeText={setWhatsappPhone}
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
        ]}
        value={source}
        onChange={setSource}
      />
      <LookupField
        displayKeys={['room_number', 'name', 'number']}
        label="Room"
        placeholder="Search room number"
        records={data.rooms}
        selectedRecord={selectedRoom}
        onSelect={setSelectedRoom}
      />
      <EditableField
        label="Notes"
        multiline
        placeholder="Special requests or internal notes"
        value={notes}
        onChangeText={setNotes}
      />
      <View style={styles.popupActions}>
        <PopupActionButton label="Cancel" tone="secondary" onPress={onClose} />
        <PopupActionButton
          label={submitting ? 'Saving...' : 'Create Reservation'}
          disabled={submitting}
          onPress={handleSubmit}
        />
      </View>
    </View>
  );
}

function RoomForm({
  hotelId,
  request,
  room,
  onClose,
  onError,
  onRefreshResource,
}: {
  hotelId: string;
  request: RequestFn;
  room: ArcadiaRecord | null;
  onClose: () => void;
  onError: (error: unknown, fallback: string) => void;
  onRefreshResource: (resource: ResourceKey) => void;
}) {
  const [roomNumber, setRoomNumber] = useState(firstRecordValue(room, ['room_number', 'name', 'number']));
  const [floor, setFloor] = useState(firstRecordValue(room, ['floor', 'floor_number']));
  const [roomType, setRoomType] = useState(firstRecordValue(room, ['room_type', 'room_type_name', 'type']));
  const [status, setStatus] = useState(firstRecordValue(room, ['status']) || 'available');
  const [notes, setNotes] = useState(firstRecordValue(room, ['notes']));
  const [submitting, setSubmitting] = useState(false);
  const roomId = firstRecordValue(room, ['id', 'room_id']);

  async function handleSubmit() {
    if (!roomNumber.trim()) {
      onError(new Error('Room number is required.'), 'Room validation failed');
      return;
    }

    setSubmitting(true);
    try {
      await request<ArcadiaRecord>(
        roomId
          ? `/api/v1/hotels/${hotelId}/rooms/${roomId}`
          : `/api/v1/hotels/${hotelId}/rooms`,
        {
          method: roomId ? 'PATCH' : 'POST',
          body: JSON.stringify(
            compactPayload({
              floor: floor.trim() || undefined,
              notes: notes.trim() || undefined,
              room_number: roomNumber.trim(),
              room_type: roomType.trim() || undefined,
              status: status.trim() || undefined,
            }),
          ),
        },
      );
      onRefreshResource('rooms');
      Alert.alert('Room saved', 'Room inventory updated.');
      onClose();
    } catch (error) {
      onError(error, 'Room save failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View>
      <EditableField label="Room Number" placeholder="Room number" value={roomNumber} onChangeText={setRoomNumber} />
      <EditableField label="Floor" placeholder="Floor" value={floor} onChangeText={setFloor} />
      <EditableField label="Room Type" placeholder="Room type" value={roomType} onChangeText={setRoomType} />
      <OptionRow
        label="Status"
        options={[
          ['available', 'Available'],
          ['occupied', 'Occupied'],
          ['dirty', 'Dirty'],
          ['out_of_order', 'Out of order'],
        ]}
        value={status}
        onChange={setStatus}
      />
      <EditableField label="Notes" multiline placeholder="Internal notes" value={notes} onChangeText={setNotes} />
      <View style={styles.popupActions}>
        <PopupActionButton label="Cancel" tone="secondary" onPress={onClose} />
        <PopupActionButton label={submitting ? 'Saving...' : 'Save Room'} disabled={submitting} onPress={handleSubmit} />
      </View>
    </View>
  );
}

function TicketDetail({
  data,
  hotelId,
  request,
  ticket,
  onClose,
  onError,
  onRefreshResource,
}: {
  data: AppData;
  hotelId: string;
  request: RequestFn;
  ticket: TicketView;
  onClose: () => void;
  onError: (error: unknown, fallback: string) => void;
  onRefreshResource: (resource: ResourceKey) => void;
}) {
  const [stage, setStage] = useState(stageValue(ticket.status));
  const [selectedStaff, setSelectedStaff] = useState<ArcadiaRecord | null>(null);
  const [submitting, setSubmitting] = useState<string | null>(null);

  async function runTicketAction(action: string) {
    setSubmitting(action);
    try {
      await request<ArcadiaRecord>(
        `/api/v1/hotels/${hotelId}/tickets/${ticket.id}/${action}`,
        {method: 'POST'},
      );
      onRefreshResource('tickets');
      Alert.alert('Ticket updated', `Action ${action.replaceAll('_', ' ')} completed.`);
      onClose();
    } catch (error) {
      onError(error, 'Ticket action failed');
    } finally {
      setSubmitting(null);
    }
  }

  async function saveStage() {
    setSubmitting('stage');
    try {
      await request<ArcadiaRecord>(
        `/api/v1/hotels/${hotelId}/tickets/${ticket.id}/stage`,
        {
          method: 'PATCH',
          body: JSON.stringify({stage}),
        },
      );
      onRefreshResource('tickets');
      Alert.alert('Ticket stage updated', stage.replaceAll('_', ' '));
      onClose();
    } catch (error) {
      onError(error, 'Ticket stage update failed');
    } finally {
      setSubmitting(null);
    }
  }

  async function saveAssignment() {
    const staffId = firstRecordValue(selectedStaff, ['id', 'user_id']);
    if (!staffId) {
      onError(new Error('Select a staff member before saving assignment.'), 'Ticket assignment failed');
      return;
    }
    setSubmitting('assign');
    try {
      await request<ArcadiaRecord>(
        `/api/v1/hotels/${hotelId}/tickets/${ticket.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({assigned_to: staffId}),
        },
      );
      onRefreshResource('tickets');
      Alert.alert('Ticket assigned', firstRecordValue(selectedStaff, ['name', 'email']));
      onClose();
    } catch (error) {
      onError(error, 'Ticket assignment failed');
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <View>
      <View style={styles.popupBadgeRow}>
        <StatusBadge label={ticket.priority} tone={priorityTone(ticket.priority)} />
        <StatusBadge label={ticket.status} tone={statusTone(ticket.status)} />
      </View>
      <Text style={styles.popupBodyTitle}>{ticket.title}</Text>
      <InfoLine label="Ticket" value={ticket.code} />
      <InfoLine label="Room" value={ticket.roomNumber || 'Unassigned'} />
      <InfoLine label="Guest" value={ticket.guestName || 'Unassigned'} />
      <InfoLine label="Department" value={ticket.department || 'Unassigned'} />
      <InfoLine label="Created" value={ticket.createdAt} />

      <OptionRow
        label="Stage"
        options={[
          ['accepted', 'Accepted'],
          ['in_progress', 'In progress'],
          ['completed', 'Completed'],
          ['approved', 'Approved'],
        ]}
        value={stage}
        onChange={setStage}
      />
      <LookupField
        displayKeys={['name', 'full_name', 'email']}
        label="Assign Staff"
        placeholder="Search staff member"
        records={data.staff}
        selectedRecord={selectedStaff}
        onSelect={setSelectedStaff}
      />
      <View style={styles.popupActions}>
        <PopupActionButton
          label={submitting === 'assign' ? 'Assigning...' : 'Save Assignment'}
          tone="secondary"
          disabled={Boolean(submitting)}
          onPress={saveAssignment}
        />
        <PopupActionButton
          label={submitting === 'stage' ? 'Updating...' : 'Save Stage'}
          disabled={Boolean(submitting)}
          onPress={saveStage}
        />
      </View>
      <View style={styles.popupActions}>
        <PopupActionButton
          label="Accept"
          tone="secondary"
          disabled={Boolean(submitting)}
          onPress={() => runTicketAction('accept')}
        />
        <PopupActionButton
          label="Complete"
          disabled={Boolean(submitting)}
          onPress={() => runTicketAction('complete')}
        />
      </View>
      <View style={styles.popupActions}>
        <PopupActionButton
          label="Approve"
          tone="secondary"
          disabled={Boolean(submitting)}
          onPress={() => runTicketAction('approve')}
        />
        <PopupActionButton
          label="Reopen"
          disabled={Boolean(submitting)}
          onPress={() => runTicketAction('reopen')}
        />
      </View>
    </View>
  );
}

function ReservationDetail({
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

function ReservationLifecycle({
  hotelId,
  mode,
  request,
  reservation,
  user,
  onClose,
  onError,
  onRefreshResource,
  onReservationBack,
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
      Alert.alert(
        isCheckIn ? 'Check-in complete' : 'Check-out complete',
        reservation.guestName,
      );
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

function GuestDetail({
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

function WhatsAppChat({
  conversation,
  hotelId,
  request,
  onCreateTicket,
  onError,
  onRefreshResource,
  onClose,
}: {
  conversation: ArcadiaRecord | null;
  hotelId: string;
  request: RequestFn;
  onCreateTicket: () => void;
  onError: (error: unknown, fallback: string) => void;
  onRefreshResource: (resource: ResourceKey) => void;
  onClose: () => void;
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
      Alert.alert('Conversation resolved', 'WhatsApp conversation marked resolved.');
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

function StaffProfile({
  hotelId,
  request,
  staff,
  onClose,
  onError,
  onRefreshResource,
}: {
  hotelId: string;
  request: RequestFn;
  staff: ArcadiaRecord | null;
  onClose: () => void;
  onError: (error: unknown, fallback: string) => void;
  onRefreshResource: (resource: ResourceKey) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const staffId = firstRecordValue(staff, ['id', 'user_id']);
  const name = firstRecordValue(staff, ['name', 'full_name', 'email']) || 'Staff Member';
  const onDuty = isRecordTruthy(staff ?? {}, ['is_on_duty']);
  const active = isRecordTruthy(staff ?? {}, ['is_active']);

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
      Alert.alert('Staff updated', successLabel);
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
    </View>
  );
}

function PasswordField({
  label,
  visible,
  onToggleVisible,
}: {
  label: string;
  visible: boolean;
  onToggleVisible: () => void;
}) {
  const [value, setValue] = useState('');

  return (
    <View style={styles.formField}>
      <Text style={styles.formLabel}>{label}</Text>
      <View style={styles.passwordInputRow}>
        <TextInput
          autoCapitalize="none"
          placeholder={label}
          placeholderTextColor="#94A3B8"
          secureTextEntry={!visible}
          style={styles.passwordInput}
          value={value}
          onChangeText={setValue}
        />
        <Pressable style={styles.passwordEyeButton} onPress={onToggleVisible}>
          <Eye color="#64748B" size={18} strokeWidth={2.1} />
        </Pressable>
      </View>
    </View>
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

function LookupField({
  displayKeys,
  label,
  placeholder,
  records,
  selectedRecord,
  onSelect,
}: {
  displayKeys: string[];
  label: string;
  placeholder: string;
  records: ArcadiaRecord[];
  selectedRecord: ArcadiaRecord | null;
  onSelect: (record: ArcadiaRecord | null) => void;
}) {
  const [query, setQuery] = useState('');
  const selectedTitle = firstRecordValue(selectedRecord, displayKeys);
  const options = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return records
      .filter(record => {
        if (!needle) {
          return true;
        }
        return displayKeys.some(key =>
          String(record[key] ?? '').toLowerCase().includes(needle),
        );
      })
      .slice(0, 8);
  }, [displayKeys, query, records]);

  return (
    <View style={styles.formField}>
      <Text style={styles.formLabel}>{label}</Text>
      {selectedTitle ? (
        <View style={styles.selectedLookupRow}>
          <Text style={styles.lookupTitle}>{selectedTitle}</Text>
          <Pressable onPress={() => onSelect(null)}>
            <Text style={styles.inlineLinkText}>Clear</Text>
          </Pressable>
        </View>
      ) : null}
      <TextInput
        placeholder={selectedTitle || placeholder}
        placeholderTextColor="#94A3B8"
        style={styles.formInput}
        value={query}
        onChangeText={setQuery}
      />
      {query || (!selectedTitle && options.length > 0) ? (
        <View style={styles.lookupList}>
          {options.length > 0 ? (
            options.map((record, index) => {
              const title = firstRecordValue(record, displayKeys) || `Record ${index + 1}`;
              const subtitle = firstRecordValue(record, [
                'room_type',
                'job_role',
                'phone',
                'email',
                'status',
              ]);
              return (
                <Pressable
                  key={`${title}-${index}`}
                  style={styles.lookupOption}
                  onPress={() => {
                    onSelect(record);
                    setQuery('');
                  }}>
                  <Text style={styles.lookupTitle}>{title}</Text>
                  {subtitle ? <Text style={styles.captionTiny}>{subtitle}</Text> : null}
                </Pressable>
              );
            })
          ) : (
            <Text style={styles.lookupEmpty}>No matching DB records</Text>
          )}
        </View>
      ) : null}
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
          const active = optionValue === value;
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

function PopupActionButton({
  disabled,
  label,
  onPress,
  tone = 'primary',
}: {
  disabled?: boolean;
  label: string;
  onPress: () => void;
  tone?: 'primary' | 'secondary';
}) {
  return (
    <Pressable
      disabled={disabled}
      style={[
        styles.popupActionButton,
        tone === 'secondary' && styles.secondaryActionButton,
        disabled && styles.disabledActionButton,
      ]}
      onPress={onPress}>
      <Text
        style={[
          styles.popupActionText,
          tone === 'secondary' && styles.secondaryActionText,
        ]}>
        {label}
      </Text>
    </Pressable>
  );
}

function InlineFormError({message}: {message: string}) {
  return (
    <View style={styles.formErrorBox}>
      <Text style={styles.formErrorTitle}>Action failed</Text>
      <Text style={styles.formErrorText}>{message}</Text>
    </View>
  );
}

function ContextBanner({label, value}: {label: string; value: string}) {
  return (
    <View style={styles.contextBanner}>
      <Text style={styles.formLabel}>{label}</Text>
      <Text style={styles.contextBannerText}>{value || 'Current record'}</Text>
    </View>
  );
}

function EmptyPopupText({text}: {text: string}) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateText}>{text}</Text>
    </View>
  );
}

function getPopupTitle(
  popup: PopupKey,
  selectedLabel: string,
  conversation: ArcadiaRecord | null,
  guest: ArcadiaRecord | null,
  staff: ArcadiaRecord | null,
) {
  if (popup === 'ticketForm') {
    return 'Create Ticket';
  }
  if (popup === 'reservationForm') {
    return 'Create Reservation';
  }
  if (popup === 'ticketDetail') {
    return 'Ticket Detail';
  }
  if (popup === 'reservationDetail') {
    return 'Reservation Detail';
  }
  if (popup === 'checkIn') {
    return 'Guest Check In';
  }
  if (popup === 'checkOut') {
    return 'Guest Check Out';
  }
  if (popup === 'whatsappChat') {
    return (
      firstRecordValue(conversation, ['guest_name', 'contact_name', 'name', 'phone']) ||
      'WhatsApp Chat'
    );
  }
  if (popup === 'guestDetail') {
    return firstRecordValue(guest, ['name', 'guest_name']) || 'Guest Detail';
  }
  if (popup === 'staffProfile') {
    return firstRecordValue(staff, ['name', 'full_name']) || 'Staff Profile';
  }
  if (popup === 'roomForm') {
    return 'Room';
  }
  if (popup === 'profileOption') {
    return selectedLabel || 'Profile';
  }
  return '';
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

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function stageValue(value: string) {
  const normalized = value.toLowerCase().replaceAll(' ', '_');
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
