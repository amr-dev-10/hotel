import {useEffect, useState} from 'react';
import {View} from 'react-native';

import {type AppDialogRequest} from '../../../components/AppDialog';
import {firstRecordValue} from '../../../utils/dataUtils';
import {styles} from '../../../theme/styles';

import type {AppData, ReservationView} from '../../dashboard';
import type {ResourceKey} from '../types';

import type {ArcadiaRecord} from '../../../types/domain';
import {
  ContextBanner,
  EditableField,
  LookupField,
  OptionRow,
  PopupActionButton
} from './popup/PopupFields';
import {compactPayload} from './popup/popupUtils';
import type {RequestFn} from './popup/popupTypes';

export function TicketForm({
  conversation,
  data,
  guest,
  hotelId,
  request,
  reservation,
  onClose,
  onError,
  onRefreshResource,
  onShowDialog,
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
  onShowDialog: (dialog: AppDialogRequest) => void;
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
      onShowDialog({
        message: firstRecordValue(result.data, ['ticket_code', 'code', 'id']) || 'Ticket created successfully.',
        title: 'Ticket created',
        tone: 'success',
      });
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
