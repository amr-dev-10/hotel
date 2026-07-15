import type {AppDialogRequest} from '../../../components/AppDialog';
import type {ScreenAction, ScreenKey} from '../../../navigation/types';
import type {ArcadiaRecord, UserProfile} from '../../../types/domain';
import type {AppData, ReservationView, TicketView} from '../../dashboard';
import type {ActionHandler, ResourceKey} from '../types';
import {
  GuestDetailScreen,
  ReservationDetailScreen,
  TicketDetailScreen,
  TicketFormScreen,
  WhatsAppConversationScreen,
} from './DetailScreens';
import {
  AssistantScreen,
  DashboardScreen,
  EscalationsScreen,
  FoodScreen,
  GuestsScreen,
  HierarchyScreen,
  HousekeepingScreen,
  KitchenScreen,
  NotificationsScreen,
  ProfileScreen,
  ReservationsScreen,
  RoomScreen,
  StaffScreen,
  TicketsScreen,
  WhatsAppScreen,
} from './OperationsScreens';
import type {RequestFn} from './screenTypes';

export function ScreenContent({
  data,
  error,
  hotelName,
  loading,
  loadingProcesses,
  request,
  screen,
  selectedConversation,
  selectedGuest,
  selectedReservation,
  selectedTicket,
  user,
  onBack,
  onLogout,
  onMenu,
  onNavigate,
  onOpenProfileOption,
  onOpenGuest,
  onOpenReservation,
  onOpenReservationForm,
  onOpenRoomForm,
  onOpenStaffProfile,
  onOpenTicket,
  onOpenContextTicketForm,
  onOpenTicketForm,
  onOpenWhatsAppChat,
  onOpenNotifications,
  onQuickRecordAction,
  onRefresh,
  onRefreshResource,
  onShowDialog,
  permissions,
}: {
  data: AppData;
  error: string | null;
  hotelName: string;
  loading: boolean;
  loadingProcesses: string[];
  permissions?: string[];
  request: RequestFn;
  screen: ScreenKey;
  selectedConversation: ArcadiaRecord | null;
  selectedGuest: ArcadiaRecord | null;
  selectedReservation: ReservationView | null;
  selectedTicket: TicketView | null;
  user: UserProfile;
  onBack: () => void;
  onLogout: () => void;
  onMenu: () => void;
  onNavigate: ScreenAction;
  onOpenProfileOption: (label: string) => void;
  onOpenGuest: (guest: ArcadiaRecord) => void;
  onOpenReservation: (reservation: ReservationView) => void;
  onOpenReservationForm: () => void;
  onOpenRoomForm: (room: ArcadiaRecord | null) => void;
  onOpenStaffProfile: (staff: ArcadiaRecord) => void;
  onOpenTicket: (ticket: TicketView) => void;
  onOpenContextTicketForm: () => void;
  onOpenTicketForm: () => void;
  onOpenWhatsAppChat: (conversation: ArcadiaRecord) => void;
  onOpenNotifications: () => void;
  onQuickRecordAction: ActionHandler;
  onRefresh: () => void;
  onRefreshResource: (resource: ResourceKey) => void;
  onShowDialog: (dialog: AppDialogRequest) => void;
}) {
  if (screen === 'ticketForm') {
    return (
      <TicketFormScreen
        data={data}
        error={error}
        hotelId={user.hotel_id}
        loading={loading}
        request={request}
        selectedConversation={selectedConversation}
        selectedGuest={selectedGuest}
        selectedReservation={selectedReservation}
        user={user}
        onBack={onBack}
        onMenu={onMenu}
        onRefresh={onRefresh}
        onOpenNotifications={onOpenNotifications}
        onRefreshResource={onRefreshResource}
        onShowDialog={onShowDialog}
      />
    );
  }
  if (screen === 'ticketDetail') {
    return (
      <TicketDetailScreen
        data={data}
        error={error}
        hotelId={user.hotel_id}
        loading={loading}
        request={request}
        ticket={selectedTicket}
        user={user}
        onBack={onBack}
        onMenu={onMenu}
        onOpenWhatsAppConversation={onOpenWhatsAppChat}
        onOpenNotifications={onOpenNotifications}
        onRefresh={onRefresh}
        onRefreshResource={onRefreshResource}
        onShowDialog={onShowDialog}
      />
    );
  }
  if (screen === 'reservationDetail') {
    return (
      <ReservationDetailScreen
        data={data}
        error={error}
        hotelId={user.hotel_id}
        loading={loading}
        request={request}
        reservation={selectedReservation}
        onBack={onBack}
        onCreateTicket={onOpenContextTicketForm}
        onMenu={onMenu}
        onOpenWhatsAppConversation={onOpenWhatsAppChat}
        onOpenNotifications={onOpenNotifications}
        onRefresh={onRefresh}
        onRefreshResource={onRefreshResource}
        onShowDialog={onShowDialog}
      />
    );
  }
  if (screen === 'guestDetail') {
    return (
      <GuestDetailScreen
        data={data}
        error={error}
        guest={selectedGuest}
        hotelId={user.hotel_id}
        loading={loading}
        request={request}
        onBack={onBack}
        onCreateTicket={onOpenContextTicketForm}
        onMenu={onMenu}
        onOpenWhatsAppConversation={onOpenWhatsAppChat}
        onOpenNotifications={onOpenNotifications}
        onRefresh={onRefresh}
        onRefreshResource={onRefreshResource}
        onShowDialog={onShowDialog}
      />
    );
  }
  if (screen === 'whatsappChat') {
    return (
      <WhatsAppConversationScreen
        data={data}
        conversation={selectedConversation}
        error={error}
        hotelId={user.hotel_id}
        loading={loading}
        request={request}
        onBack={onBack}
        onCreateTicket={onOpenContextTicketForm}
        onMenu={onMenu}
        onOpenNotifications={onOpenNotifications}
        onRefresh={onRefresh}
        onRefreshResource={onRefreshResource}
        onShowDialog={onShowDialog}
      />
    );
  }
  if (screen === 'dashboard') {
    return (
      <DashboardScreen
        data={data}
        error={error}
        loading={loading}
        loadingProcesses={loadingProcesses}
        onMenu={onMenu}
        onNavigate={onNavigate}
        onOpenNotifications={onOpenNotifications}
        onOpenTicketForm={onOpenTicketForm}
        permissions={permissions}
        onRefresh={onRefresh}
      />
    );
  }
  if (screen === 'reservations') {
    return (
      <ReservationsScreen
        reservations={data.reservations}
        error={error}
        loading={loading}
        loadingProcesses={loadingProcesses}
        onBack={onBack}
        onMenu={onMenu}
        onOpenReservation={onOpenReservation}
        onOpenReservationForm={onOpenReservationForm}
        onOpenNotifications={onOpenNotifications}
        onQuickRecordAction={onQuickRecordAction}
        onRefresh={onRefresh}
      />
    );
  }
  if (screen === 'guests') {
    return (
      <GuestsScreen
        error={error}
        guests={data.guests}
        loading={loading}
        loadingProcesses={loadingProcesses}
        onBack={onBack}
        onMenu={onMenu}
        onOpenGuest={onOpenGuest}
        onOpenNotifications={onOpenNotifications}
        onQuickRecordAction={onQuickRecordAction}
        onRefresh={onRefresh}
      />
    );
  }
  if (screen === 'room') {
    return (
      <RoomScreen
        error={error}
        loading={loading}
        loadingProcesses={loadingProcesses}
        rooms={data.rooms}
        onBack={onBack}
        onMenu={onMenu}
        onNavigate={onNavigate}
        onOpenNotifications={onOpenNotifications}
        onOpenRoomForm={onOpenRoomForm}
        onQuickRecordAction={onQuickRecordAction}
        onRefresh={onRefresh}
      />
    );
  }
  if (screen === 'tickets') {
    return (
      <TicketsScreen
        loading={loading}
        loadingProcesses={loadingProcesses}
        error={error}
        tickets={data.tickets}
        user={user}
        onBack={onBack}
        onCreateTicket={onOpenTicketForm}
        onOpenTicket={onOpenTicket}
        onOpenNotifications={onOpenNotifications}
        onQuickRecordAction={onQuickRecordAction}
        onRefresh={onRefresh}
      />
    );
  }
  if (screen === 'escalations') {
    return (
      <EscalationsScreen
        escalations={data.escalations}
        error={error}
        hotelId={user.hotel_id}
        loading={loading}
        loadingProcesses={loadingProcesses}
        onBack={onBack}
        onMenu={onMenu}
        onOpenTicket={onOpenTicket}
        onOpenNotifications={onOpenNotifications}
        onQuickRecordAction={onQuickRecordAction}
        onRefresh={onRefresh}
        request={request}
        user={user}
      />
    );
  }
  if (screen === 'notifications') {
    return (
      <NotificationsScreen
        loading={loading}
        error={error}
        loadingProcesses={loadingProcesses}
        notifications={data.notifications}
        onBack={onBack}
        onMenu={onMenu}
        onOpenNotifications={onOpenNotifications}
        onQuickRecordAction={onQuickRecordAction}
        onRefresh={onRefresh}
      />
    );
  }
  if (screen === 'housekeeping') {
    return (
      <HousekeepingScreen
        loading={loading}
        error={error}
        hotelId={user.hotel_id}
        loadingProcesses={loadingProcesses}
        request={request}
        rooms={data.rooms}
        staff={data.staff}
        tasks={data.housekeeping}
        onBack={onBack}
        onMenu={onMenu}
        onOpenNotifications={onOpenNotifications}
        onRefresh={onRefresh}
        onShowDialog={onShowDialog}
      />
    );
  }
  if (screen === 'food') {
    return (
      <FoodScreen
        loading={loading}
        error={error}
        hotelId={user.hotel_id}
        loadingProcesses={loadingProcesses}
        request={request}
        onBack={onBack}
        onMenu={onMenu}
        onOpenNotifications={onOpenNotifications}
        onShowDialog={onShowDialog}
      />
    );
  }
  if (screen === 'kitchen') {
    return (
      <KitchenScreen
        loading={loading}
        error={error}
        guests={data.guests}
        hotelId={user.hotel_id}
        loadingProcesses={loadingProcesses}
        orders={data.orders}
        request={request}
        reservations={data.reservations}
        rooms={data.rooms}
        onBack={onBack}
        onMenu={onMenu}
        onOpenNotifications={onOpenNotifications}
        onQuickRecordAction={onQuickRecordAction}
        onRefresh={onRefresh}
      />
    );
  }
  if (screen === 'whatsapp') {
    return (
      <WhatsAppScreen
        conversations={data.whatsapp}
        error={error}
        hotelId={user.hotel_id}
        loading={loading}
        loadingProcesses={loadingProcesses}
        request={request}
        staff={data.staff}
        userId={user.id}
        onBack={onBack}
        onMenu={onMenu}
        onOpenChat={onOpenWhatsAppChat}
        onOpenNotifications={onOpenNotifications}
        onRefresh={onRefresh}
        onShowDialog={onShowDialog}
      />
    );
  }
  if (screen === 'assistant') {
    return <AssistantScreen data={data} onBack={onBack} onMenu={onMenu} onOpenNotifications={onOpenNotifications} />;
  }
  if (screen === 'staff') {
    return (
      <StaffScreen
        loading={loading}
        error={error}
        loadingProcesses={loadingProcesses}
        hotelId={user.hotel_id}
        request={request}
        staff={data.staff}
        onBack={onBack}
        onMenu={onMenu}
        onOpenNotifications={onOpenNotifications}
        onOpenStaffProfile={onOpenStaffProfile}
        onRefresh={onRefresh}
        onRefreshResource={onRefreshResource}
        onShowDialog={onShowDialog}
      />
    );
  }
  if (screen === 'hierarchy') {
    return (
      <HierarchyScreen
        error={error}
        hotelId={user.hotel_id}
        loading={loading}
        loadingProcesses={loadingProcesses}
        request={request}
        userDepartmentId={user.department_id ?? ''}
        onBack={onBack}
        onMenu={onMenu}
        onOpenNotifications={onOpenNotifications}
        onRefresh={onRefresh}
      />
    );
  }
  return (
    <ProfileScreen
      user={user}
      hotelName={hotelName}
      onBack={onBack}
      onLogout={onLogout}
      onMenu={onMenu}
      onOpenNotifications={onOpenNotifications}
      onNavigate={onNavigate}
      onOpenProfileOption={onOpenProfileOption}
    />
  );
}
