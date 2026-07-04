import {useMemo, useState} from 'react';
import {Modal, Pressable, ScrollView, Text, TextInput, View} from 'react-native';

import {Avatar, InfoLine, StatusBadge} from './AppComponents';
import {Eye, Ticket} from './icons';
import {firstRecordValue} from './dataUtils';
import {blue, styles} from './styles';
import type {PopupKey} from './types';
import type {AppData, ReservationView, TicketView} from '../modules/dashboard';
import {priorityTone, statusTone} from '../modules/operations/utils';
import type {ArcadiaRecord, UserProfile} from '../types/domain';

export function CustomPopup({
  data,
  popup,
  reservation,
  room,
  selectedLabel,
  ticket,
  user,
  onCheckIn,
  onCheckOut,
  onClose,
  onCreateTicket,
  onReservationBack,
}: {
  data: AppData;
  popup: PopupKey;
  reservation: ReservationView | null;
  room: ArcadiaRecord | null;
  selectedLabel: string;
  ticket: TicketView | null;
  user: UserProfile;
  onCheckIn: () => void;
  onCheckOut: () => void;
  onClose: () => void;
  onCreateTicket: () => void;
  onReservationBack: () => void;
}) {
  const visible = popup !== null;
  const title = getPopupTitle(popup, selectedLabel);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.popupBackdrop} onPress={onClose}>
        <Pressable style={styles.popupCard}>
          <View style={styles.popupHeader}>
            <Text style={styles.popupTitle}>{title}</Text>
            <Pressable style={styles.popupCloseButton} onPress={onClose}>
              <Text style={styles.popupCloseText}>×</Text>
            </Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {popup === 'ticketForm' ? (
              <View>
                <RelatedField
                  label="Room"
                  placeholder="Type room number"
                  records={data.rooms}
                  displayKeys={['room_number', 'name', 'number']}
                />
                <RelatedField
                  label="Guest"
                  placeholder="Type guest name"
                  records={data.reservations}
                  displayKeys={['guestName', 'bookingId']}
                />
                <RelatedField
                  label="Assign Staff"
                  placeholder="Type staff name"
                  records={data.staff}
                  displayKeys={['name', 'full_name', 'email']}
                />
                <FormField label="Category" placeholder="Type category" />
                <FormField label="Priority" placeholder="Low / Medium / High" />
                <FormField label="Issue" placeholder="Describe issue" multiline />
                <View style={styles.popupActions}>
                  <PopupActionButton label="Cancel" tone="secondary" onPress={onClose} />
                  <PopupActionButton label="Create Ticket" onPress={onClose} />
                </View>
              </View>
            ) : null}

            {popup === 'roomForm' ? (
              <View>
                <FormField
                  label="Room Number"
                  placeholder="Room number"
                  value={firstRecordValue(room, ['room_number', 'name', 'number'])}
                />
                <FormField
                  label="Floor"
                  placeholder="Floor"
                  value={firstRecordValue(room, ['floor', 'floor_number'])}
                />
                <FormField
                  label="Room Type"
                  placeholder="Room type"
                  value={firstRecordValue(room, ['room_type', 'room_type_name', 'type'])}
                />
                <FormField
                  label="Status"
                  placeholder="vacant / occupied / out_of_order"
                  value={firstRecordValue(room, ['status'])}
                />
                <FormField
                  label="Notes"
                  placeholder="Internal notes"
                  value={firstRecordValue(room, ['notes'])}
                  multiline
                />
                <View style={styles.popupActions}>
                  <PopupActionButton label="Cancel" tone="secondary" onPress={onClose} />
                  <PopupActionButton label={room ? 'Save Room' : 'Create Room'} onPress={onClose} />
                </View>
              </View>
            ) : null}

            {popup === 'ticketDetail' && ticket ? (
              <View>
                <View style={styles.popupBadgeRow}>
                  <StatusBadge label={ticket.priority} tone={priorityTone(ticket.priority)} />
                  <StatusBadge label={ticket.status} tone={statusTone(ticket.status)} />
                </View>
                <Text style={styles.popupBodyTitle}>{ticket.title}</Text>
                <InfoLine label="Ticket" value={ticket.code} />
                <InfoLine label="Room" value={ticket.roomNumber} />
                <InfoLine label="Guest" value={ticket.guestName} />
                <InfoLine label="Department" value={ticket.department} />
                <InfoLine label="Created" value={ticket.createdAt} />
                <View style={styles.stageTrack}>
                  {['Open', 'In Progress', 'Completed', 'Closed'].map(stage => (
                    <View
                      key={stage}
                      style={[
                        styles.stagePill,
                        ticket.status === stage && styles.activeStagePill,
                      ]}>
                      <Text
                        style={[
                          styles.stageText,
                          ticket.status === stage && styles.activeStageText,
                        ]}>
                        {stage}
                      </Text>
                    </View>
                  ))}
                </View>
                <View style={styles.popupActions}>
                  <PopupActionButton label="Assign Staff" tone="secondary" onPress={onClose} />
                  <PopupActionButton label="Update Stage" onPress={onClose} />
                </View>
              </View>
            ) : null}

            {popup === 'reservationDetail' && reservation ? (
              <View>
                <View style={styles.popupBadgeRow}>
                  <StatusBadge label={reservation.status} tone={statusTone(reservation.status)} />
                </View>
                <Text style={styles.popupBodyTitle}>{reservation.guestName}</Text>
                <InfoLine label="Booking ID" value={reservation.bookingId} />
                <InfoLine label="Room" value={reservation.roomNumber} />
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
            ) : null}

            {(popup === 'checkIn' || popup === 'checkOut') && reservation ? (
              <View>
                <Text style={styles.popupBodyText}>
                  {popup === 'checkIn'
                    ? 'Confirm guest arrival, collect ID proof, and mark the room occupied.'
                    : 'Confirm settlement, minibar review, and housekeeping handoff.'}
                </Text>
                <InfoLine label="Guest" value={reservation.guestName} />
                <InfoLine label="Room" value={reservation.roomNumber} />
                <InfoLine label="Handled by" value={user.name ?? user.email} />
                <View style={styles.popupActions}>
                  <PopupActionButton label="Back" tone="secondary" onPress={onReservationBack} />
                  <PopupActionButton
                    label={popup === 'checkIn' ? 'Complete Check In' : 'Complete Check Out'}
                    onPress={onClose}
                  />
                </View>
              </View>
            ) : null}

            {popup === 'whatsappChat' ? (
              <View>
                <View style={styles.chatTranscript}>
                  <Text style={styles.chatMessageGuest}>
                    {selectedLabel
                      ? `Conversation opened for ${selectedLabel}.`
                      : 'No conversation record selected from API.'}
                  </Text>
                </View>
                <View style={styles.popupActions}>
                  <PopupActionButton label="Create Ticket" tone="secondary" onPress={onCreateTicket} />
                  <PopupActionButton label="Mark Resolved" onPress={onClose} />
                </View>
              </View>
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
                      onToggleVisible={() => setShowConfirmPassword(current => !current)}
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
              <View>
                <View style={styles.staffPopupHeader}>
                  <Avatar label={(selectedLabel || 'S').charAt(0)} size={52} />
                  <View>
                    <Text style={styles.popupBodyTitle}>{selectedLabel || 'Staff Member'}</Text>
                    <Text style={styles.caption}>Loaded from staff API selection</Text>
                  </View>
                </View>
                <InfoLine label="Status" value="Use staff attendance API" />
                <InfoLine label="Check-in" value="" />
                <InfoLine label="Check-out" value="" />
                <InfoLine label="Assigned Area" value="" />
                <View style={styles.popupActions}>
                  <PopupActionButton label="Check In" tone="secondary" onPress={onClose} />
                  <PopupActionButton label="Check Out" onPress={onClose} />
                </View>
              </View>
            ) : null}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function getPopupTitle(popup: PopupKey, selectedLabel: string) {
  if (popup === 'ticketForm') {
    return 'Create Ticket';
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
    return selectedLabel || 'WhatsApp Chat';
  }
  if (popup === 'staffProfile') {
    return 'Staff Profile';
  }
  if (popup === 'roomForm') {
    return 'Room';
  }
  if (popup === 'profileOption') {
    return selectedLabel || 'Profile';
  }
  return '';
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

function FormField({
  label,
  placeholder,
  value = '',
  multiline,
}: {
  label: string;
  placeholder?: string;
  value?: string;
  multiline?: boolean;
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
      />
    </View>
  );
}

function RelatedField({
  displayKeys,
  label,
  placeholder,
  records,
}: {
  displayKeys: string[];
  label: string;
  placeholder: string;
  records: ArcadiaRecord[];
}) {
  const [query, setQuery] = useState('');
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
      .slice(0, 10);
  }, [displayKeys, query, records]);

  return (
    <View style={styles.formField}>
      <Text style={styles.formLabel}>{label}</Text>
      <TextInput
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        style={styles.formInput}
        value={query}
        onChangeText={setQuery}
      />
      {query || options.length > 0 ? (
        <View style={styles.lookupList}>
          {options.length > 0 ? (
            options.map((record, index) => {
              const title = firstRecordValue(record, displayKeys) || `Record ${index + 1}`;
              return (
                <Pressable
                  key={`${title}-${index}`}
                  style={styles.lookupOption}
                  onPress={() => setQuery(title)}>
                  <Text style={styles.lookupTitle}>{title}</Text>
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

function PopupActionButton({
  label,
  onPress,
  tone = 'primary',
}: {
  label: string;
  onPress: () => void;
  tone?: 'primary' | 'secondary';
}) {
  return (
    <Pressable
      style={[
        styles.popupActionButton,
        tone === 'secondary' && styles.secondaryActionButton,
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

