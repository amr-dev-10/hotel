import {useState} from 'react';
import {View} from 'react-native';

import {type AppDialogRequest} from '../../../components/AppDialog';

import {firstRecordValue} from '../../../utils/dataUtils';
import {styles} from '../../../theme/styles';

import type {ResourceKey} from '../types';

import type {ArcadiaRecord} from '../../../types/domain';
import {
  EditableField,
  OptionRow,
  PopupActionButton
} from './popup/PopupFields';
import {compactPayload} from './popup/popupUtils';
import type {RequestFn} from './popup/popupTypes';

export function RoomForm({
  hotelId,
  request,
  room,
  onClose,
  onError,
  onRefreshResource,
  onShowDialog,
}: {
  hotelId: string;
  request: RequestFn;
  room: ArcadiaRecord | null;
  onClose: () => void;
  onError: (error: unknown, fallback: string) => void;
  onRefreshResource: (resource: ResourceKey) => void;
  onShowDialog: (dialog: AppDialogRequest) => void;
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
      onShowDialog({
        message: 'Room inventory updated.',
        title: 'Room saved',
        tone: 'success',
      });
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
