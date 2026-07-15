import {
  useCallback,
  useEffect,
  useState
} from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  View
} from 'react-native';

import {InfoLine} from '../../../components/AppComponents';
import {appErrorDialog, type AppDialogRequest} from '../../../components/AppDialog';

import {styles} from '../../../theme/styles';
import type {PopupKey} from '../../../navigation/types';
import type {
  AppData,
  ReservationView,
  TicketView
} from '../../dashboard';
import type {ResourceKey} from '../types';

import {formatErrorDetails} from '../../../services/api';
import type {ArcadiaRecord, UserProfile} from '../../../types/domain';
import type {RequestFn} from './popup/popupTypes';
import {
  InlineFormError,
  PasswordField,
  PopupActionButton
} from './popup/PopupFields';
import {getPopupTitle} from './popup/popupUtils';
import {TicketForm} from './TicketFormPopup';
import {ReservationForm} from './ReservationFormPopup';
import {RoomForm} from './RoomFormPopup';
import {TicketDetail} from './TicketDetailPopup';
import {GuestDetail, ReservationDetail, ReservationLifecycle} from './ReservationGuestPopups';
import {StaffProfile, WhatsAppChat} from './WhatsAppStaffPopups';

export function CustomPopup({
  conversation,
  data,
  guest,
  hotelName,
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
  onShowDialog,
}: {
  conversation: ArcadiaRecord | null;
  data: AppData;
  guest: ArcadiaRecord | null;
  hotelName: string;
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
  onShowDialog: (dialog: AppDialogRequest) => void;
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
    onShowDialog(appErrorDialog(fallback, details));
  }, [onShowDialog]);

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
                onShowDialog={onShowDialog}
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
                onShowDialog={onShowDialog}
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
                onShowDialog={onShowDialog}
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
                onShowDialog={onShowDialog}
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
                onShowDialog={onShowDialog}
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
                onShowDialog={onShowDialog}
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
                    <InfoLine label="Hotel" value={hotelName} />
                    <InfoLine label="Theme" value="System default" />
                    <InfoLine label="Notifications" value="Enabled" />
                    <PopupActionButton label="Done" onPress={onClose} />
                  </>
                ) : (
                  <>
                    <InfoLine label="Name" value={user.name ?? user.email} />
                    <InfoLine label="Role" value={user.job_role ?? user.user_type ?? ''} />
                    <InfoLine label="Hotel" value={hotelName} />
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
                user={user}
                onClose={onClose}
                onError={handleError}
                onRefreshResource={onRefreshResource}
                onShowDialog={onShowDialog}
              />
            ) : null}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
