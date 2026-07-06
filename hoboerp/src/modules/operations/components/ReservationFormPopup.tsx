import {useEffect, useState} from 'react';
import {View} from 'react-native';

import {type AppDialogRequest} from '../../../components/AppDialog';

import {firstRecordValue} from '../../../utils/dataUtils';
import {styles} from '../../../theme/styles';

import type {AppData} from '../../dashboard';
import type {ResourceKey} from '../types';

import type {ArcadiaRecord} from '../../../types/domain';
import {
  EditableField,
  LookupField,
  OptionRow,
  PopupActionButton
} from './popup/PopupFields';
import {
  addDaysIso,
  compactPayload,
  todayIso
} from './popup/popupUtils';
import type {RequestFn} from './popup/popupTypes';

export function ReservationForm({
  data,
  hotelId,
  request,
  onClose,
  onError,
  onRefreshResource,
  onShowDialog,
}: {
  data: AppData;
  hotelId: string;
  request: RequestFn;
  onClose: () => void;
  onError: (error: unknown, fallback: string) => void;
  onRefreshResource: (resource: ResourceKey) => void;
  onShowDialog: (dialog: AppDialogRequest) => void;
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
      onShowDialog({
        message: 'Reservation saved successfully.',
        title: 'Reservation created',
        tone: 'success',
      });
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
