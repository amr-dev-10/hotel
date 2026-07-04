import {useEffect, useMemo, useState} from 'react';
import {ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, Text, TextInput, View} from 'react-native';

import {
  ActionMenu,
  Avatar,
  ChipRow,
  DepartmentRow,
  EmptyState,
  ErrorNotice,
  LoadingProcessCard,
  MetricTile,
  OverviewStat,
  ProfileOption,
  QuickAction,
  ReservationCard,
  SearchBox,
  SectionTitle,
  StatusBadge,
  TicketCard,
  TopAppBar,
} from '../AppComponents';
import {
  GuestDetailScreen,
  ReservationDetailScreen,
  TicketFormScreen,
  TicketDetailScreen,
  WhatsAppConversationScreen,
} from './DetailScreens';
import type {AppDialogRequest} from '../AppDialog';
import {
  Bell,
  CalendarDays,
  ChevronLeft,
  ClipboardCheck,
  Filter,
  Hotel,
  KeyRound,
  LockKeyhole,
  LogOut,
  Menu,
  MessageCircle,
  Mic,
  Plus,
  QrCode,
  Send,
  Settings,
  Ticket,
  Utensils,
  User,
  Users,
  Wrench,
} from '../icons';
import {
  filterByStatus,
  filterRecordsByStatus,
  firstRecordValue,
  filterRecordsBySearch,
  formatAmount,
  isRecordTruthy,
} from '../dataUtils';
import {blue, styles} from '../styles';
import type {ScreenAction, ScreenKey} from '../types';
import type {AppData, ReservationView, TicketView} from '../../modules/dashboard';
import type {ActionHandler, ResourceKey} from '../../modules/operations/types';
import {statusTone} from '../../modules/operations/utils';
import type {ApiEnvelope} from '../../types/api';
import type {ArcadiaRecord, UserProfile} from '../../types/domain';

type RequestFn = <T>(
  path: string,
  options?: RequestInit,
) => Promise<ApiEnvelope<T>>;

const PAGE_SIZE = 12;

function useScrollPagination<T>(items: T[], pageSize = PAGE_SIZE) {
  const [visibleCount, setVisibleCount] = useState(pageSize);

  useEffect(() => {
    setVisibleCount(pageSize);
  }, [items, pageSize]);

  const visibleItems = useMemo(
    () => items.slice(0, visibleCount),
    [items, visibleCount],
  );
  const hasMore = visibleCount < items.length;
  const loadMore = () => {
    if (hasMore) {
      setVisibleCount(current => Math.min(current + pageSize, items.length));
    }
  };

  return {hasMore, loadMore, visibleItems};
}

function ListFooter({hasMore, loading}: {hasMore: boolean; loading?: boolean}) {
  return (
    <View style={styles.listFooter}>
      {loading ? <ActivityIndicator color={blue} size="small" /> : null}
      <Text style={styles.listFooterText}>
        {loading ? 'Loading records...' : hasMore ? 'Scroll for more' : 'All records loaded'}
      </Text>
    </View>
  );
}

function handleScrollLoadMore(loadMore: () => void) {
  return ({nativeEvent}: {nativeEvent: {contentOffset: {y: number}; contentSize: {height: number}; layoutMeasurement: {height: number}}}) => {
    const distanceFromBottom =
      nativeEvent.contentSize.height -
      (nativeEvent.contentOffset.y + nativeEvent.layoutMeasurement.height);
    if (distanceFromBottom < 72) {
      loadMore();
    }
  };
}

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
}: {
  data: AppData;
  error: string | null;
  hotelName: string;
  loading: boolean;
  loadingProcesses: string[];
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
        loading={loading}
        loadingProcesses={loadingProcesses}
        onBack={onBack}
        onMenu={onMenu}
        onOpenNotifications={onOpenNotifications}
        onQuickRecordAction={onQuickRecordAction}
        onRefresh={onRefresh}
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
        loadingProcesses={loadingProcesses}
        tasks={data.housekeeping}
        onBack={onBack}
        onMenu={onMenu}
        onOpenNotifications={onOpenNotifications}
        onQuickRecordAction={onQuickRecordAction}
        onRefresh={onRefresh}
      />
    );
  }
  if (screen === 'food') {
    return (
      <FoodScreen
        loading={loading}
        error={error}
        loadingProcesses={loadingProcesses}
        orders={data.orders}
        onBack={onBack}
        onMenu={onMenu}
        onOpenNotifications={onOpenNotifications}
        onQuickRecordAction={onQuickRecordAction}
        onRefresh={onRefresh}
      />
    );
  }
  if (screen === 'kitchen') {
    return (
      <KitchenScreen
        loading={loading}
        error={error}
        loadingProcesses={loadingProcesses}
        orders={data.orders}
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
        loading={loading}
        loadingProcesses={loadingProcesses}
        onBack={onBack}
        onMenu={onMenu}
        onOpenChat={onOpenWhatsAppChat}
        onOpenNotifications={onOpenNotifications}
        onRefresh={onRefresh}
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
        staff={data.staff}
        onBack={onBack}
        onMenu={onMenu}
        onOpenNotifications={onOpenNotifications}
        onOpenStaffProfile={onOpenStaffProfile}
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

function DashboardScreen({
  data,
  error,
  loading,
  loadingProcesses,
  onMenu,
  onNavigate,
  onOpenNotifications,
  onOpenTicketForm,
  onRefresh,
}: {
  data: AppData;
  error: string | null;
  loading: boolean;
  loadingProcesses: string[];
  onMenu: () => void;
  onNavigate: ScreenAction;
  onOpenNotifications: () => void;
  onOpenTicketForm: () => void;
  onRefresh: () => void;
}) {
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.screenContent}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} />}>
      <TopAppBar
        title="Dashboard"
        leftIcon={Menu}
        onLeftPress={onMenu}
        rightIcon={Bell}
        onRightPress={onOpenNotifications}
      />
      <LoadingProcessCard
        active={loading}
        label="Loading dashboard data"
        processes={loadingProcesses}
      />
      <ErrorNotice message={error} onRetry={onRefresh} />
      <View style={styles.overviewCard}>
        <View style={styles.rowBetween}>
          <View>
            <Text style={styles.overviewTitle}>Today's Overview</Text>
            <Text style={styles.overviewDate}>Live operations from API</Text>
          </View>
        </View>
        <View style={styles.overviewStats}>
          <OverviewStat label="Check-ins" value={String(data.todayCheckIns)} trend="Live" />
          <OverviewStat label="Check-outs" value={String(data.todayCheckOuts)} trend="Live" />
          <OverviewStat label="Occupancy" value={`${data.occupancy}%`} trend="Live" />
          <OverviewStat label="Pending Tickets" value={String(data.openTickets)} trend="Live" danger />
        </View>
      </View>

      <SectionTitle title="Rooms Overview" />
      <View style={styles.roomGrid}>
        <MetricTile label="Total Rooms" value={data.roomsTotal} tone="blue" />
        <MetricTile label="Occupied" value={data.occupiedRooms} tone="green" />
        <MetricTile label="Vacant" value={data.vacantRooms} tone="orange" />
        <MetricTile label="Out of Order" value={data.outOfOrderRooms} tone="red" />
      </View>

      <SectionTitle title="Department Status" />
      <View style={styles.cardStack}>
        <DepartmentRow
          icon={ClipboardCheck}
          onPress={() => onNavigate('housekeeping')}
          title="Housekeeping"
          tasks={data.housekeeping.length}
          tone="blue"
        />
        <DepartmentRow
          icon={Wrench}
          onPress={() => onNavigate('tickets')}
          title="Tickets"
          tasks={data.openTickets}
          tone="red"
          up={data.openTickets > 0}
        />
        <DepartmentRow
          icon={Utensils}
          onPress={() => onNavigate('food')}
          title="F&B Service"
          tasks={data.orders.length}
          tone="orange"
          up={data.orders.length > 0}
        />
        <DepartmentRow
          icon={Users}
          onPress={() => onNavigate('staff')}
          title="Staff"
          tasks={data.staff.length}
          tone="green"
        />
      </View>

      <View style={styles.quickGrid}>
        <View style={styles.quickMenuHeader}>
          <Text style={styles.quickMenuTitle}>Quick Actions</Text>
          <Pressable style={styles.quickMenuAddButton} onPress={onOpenTicketForm}>
            <Plus color="#FFFFFF" size={18} strokeWidth={2.4} />
          </Pressable>
        </View>
        <QuickAction icon={Ticket} label="Create Ticket" onPress={onOpenTicketForm} />
        <QuickAction icon={CalendarDays} label="Reservation" onPress={() => onNavigate('reservations')} />
        <QuickAction icon={Users} label="Guest" onPress={() => onNavigate('guests')} />
        <QuickAction icon={Utensils} label="Kitchen" onPress={() => onNavigate('kitchen')} />
      </View>
    </ScrollView>
  );
}

function ReservationsScreen({
  error,
  reservations,
  loading,
  loadingProcesses,
  onBack,
  onMenu,
  onOpenNotifications,
  onOpenReservation,
  onOpenReservationForm,
  onQuickRecordAction,
  onRefresh,
}: {
  error: string | null;
  reservations: ReservationView[];
  loading: boolean;
  loadingProcesses: string[];
  onBack: () => void;
  onMenu: () => void;
  onOpenNotifications: () => void;
  onOpenReservation: (reservation: ReservationView) => void;
  onOpenReservationForm: () => void;
  onQuickRecordAction: ActionHandler;
  onRefresh: () => void;
}) {
  const [filter, setFilter] = useState('All');
  const [query, setQuery] = useState('');
  const filteredReservations = useMemo(
    () => filterRecordsBySearch(filterByStatus(reservations, filter), query),
    [filter, query, reservations],
  );
  const {hasMore, loadMore, visibleItems} = useScrollPagination(filteredReservations);

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.screenContent}
      data={visibleItems}
      keyExtractor={(item, index) => `${item.bookingId}-${index}`}
      onEndReached={loadMore}
      onEndReachedThreshold={0.35}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} />}
      ListFooterComponent={<ListFooter hasMore={hasMore} loading={loading} />}
      ListHeaderComponent={
        <View>
          <TopAppBar
            title="Reservations"
            leftIcon={ChevronLeft}
            onLeftPress={onBack}
            rightIcon={Menu}
            notificationIcon={Bell}
            secondaryRightIcon={Plus}
            onRightPress={onMenu}
            onNotificationPress={onOpenNotifications}
            onSecondaryRightPress={onOpenReservationForm}
          />
          <LoadingProcessCard
            active={loading}
            label="Loading reservations"
            processes={loadingProcesses}
          />
          <ErrorNotice message={error} onRetry={onRefresh} />
          <SearchBox
            placeholder="Search by guest, room, booking ID..."
            value={query}
            onChangeText={setQuery}
          />
          <ChipRow
            labels={['All', 'Today', 'Upcoming', 'Checked In', 'Checked Out']}
            activeLabel={filter}
            onSelect={setFilter}
          />
        </View>
      }
      ListEmptyComponent={
        loading ? null : <EmptyState label="No reservations returned from API." />
      }
      renderItem={({item}) => (
        <ReservationCard
          reservation={item}
          onPress={() => onOpenReservation(item)}
          actions={[
            {label: 'Open Detail', onPress: () => onOpenReservation(item)},
            {label: 'Check In', onPress: () => onQuickRecordAction('reservations', {...item.raw, id: item.id}, 'check-in')},
            {label: 'Check Out', onPress: () => onQuickRecordAction('reservations', {...item.raw, id: item.id}, 'check-out')},
            {label: 'Cancel Reservation', tone: 'danger', onPress: () => onQuickRecordAction('reservations', {...item.raw, id: item.id}, 'cancel')},
          ]}
        />
      )}
    />
  );
}

function GuestsScreen({
  error,
  guests,
  loading,
  loadingProcesses,
  onBack,
  onMenu,
  onOpenGuest,
  onOpenNotifications,
  onQuickRecordAction,
  onRefresh,
}: {
  error: string | null;
  guests: ArcadiaRecord[];
  loading: boolean;
  loadingProcesses: string[];
  onBack: () => void;
  onMenu: () => void;
  onOpenGuest: (guest: ArcadiaRecord) => void;
  onOpenNotifications: () => void;
  onQuickRecordAction: ActionHandler;
  onRefresh: () => void;
}) {
  const [filter, setFilter] = useState('All');
  const [query, setQuery] = useState('');
  const filteredGuests = useMemo(
    () => filterRecordsBySearch(filterRecordsByStatus(guests, filter), query),
    [filter, guests, query],
  );
  const {hasMore, loadMore, visibleItems} = useScrollPagination(filteredGuests);

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.screenContent}
      data={visibleItems}
      keyExtractor={(item, index) =>
        `${firstRecordValue(item, ['id', 'phone', 'whatsapp_phone', 'name'])}-${index}`
      }
      onEndReached={loadMore}
      onEndReachedThreshold={0.35}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} />}
      ListFooterComponent={<ListFooter hasMore={hasMore} loading={loading} />}
      ListHeaderComponent={
        <View>
          <TopAppBar
            title="Guests"
            leftIcon={ChevronLeft}
            onLeftPress={onBack}
            rightIcon={Menu}
            notificationIcon={Bell}
            onRightPress={onMenu}
            onNotificationPress={onOpenNotifications}
          />
          <LoadingProcessCard
            active={loading}
            label="Loading guests"
            processes={loadingProcesses}
          />
          <ErrorNotice message={error} onRetry={onRefresh} />
          <SearchBox
            placeholder="Search guest, phone, email..."
            value={query}
            onChangeText={setQuery}
          />
          <ChipRow
            labels={['All', 'Pre Arrival', 'Checked In', 'Checked Out']}
            activeLabel={filter}
            onSelect={setFilter}
          />
        </View>
      }
      ListEmptyComponent={loading ? null : <EmptyState label="No guests returned from API." />}
      renderItem={({item}) => {
        const name = firstRecordValue(item, ['name', 'guest_name', 'email']);
        const status = firstRecordValue(item, ['status']) || 'Guest';
        const phone = firstRecordValue(item, ['whatsapp_phone', 'phone', 'email']);
        const hasChat = isRecordTruthy(item, ['has_whatsapp_conversation']);
        return (
          <Pressable style={styles.staffCard} onPress={() => onOpenGuest(item)}>
            <Avatar label={(name || 'G').charAt(0)} size={42} />
            <View style={styles.staffText}>
              <Text style={styles.cardTitle}>{name || 'Unknown guest'}</Text>
              <Text style={styles.caption}>{phone || 'No contact saved'}</Text>
              <Text style={styles.captionTiny}>
                Reservations {firstRecordValue(item, ['reservation_count']) || '0'}
              </Text>
            </View>
            <View style={styles.chatMeta}>
              <StatusBadge label={status} tone={statusTone(status)} />
              {hasChat ? <Text style={styles.captionTiny}>WhatsApp linked</Text> : null}
              <ActionMenu
                items={[
                  {label: 'Open Guest', onPress: () => onOpenGuest(item)},
                  {label: 'Create Ticket', onPress: () => onQuickRecordAction('guests', item, 'create-ticket')},
                  {label: 'Delete Guest', tone: 'danger', onPress: () => onQuickRecordAction('guests', item, 'delete')},
                ]}
              />
            </View>
          </Pressable>
        );
      }}
    />
  );
}

function RoomScreen({
  error,
  loading,
  loadingProcesses,
  rooms,
  onBack,
  onMenu,
  onNavigate,
  onOpenNotifications,
  onOpenRoomForm,
  onQuickRecordAction,
  onRefresh,
}: {
  error: string | null;
  loading: boolean;
  loadingProcesses: string[];
  rooms: ArcadiaRecord[];
  onBack: () => void;
  onMenu: () => void;
  onNavigate: ScreenAction;
  onOpenNotifications: () => void;
  onOpenRoomForm: (room: ArcadiaRecord | null) => void;
  onQuickRecordAction: ActionHandler;
  onRefresh: () => void;
}) {
  const [query, setQuery] = useState('');
  const floors = useMemo(() => {
    const uniqueFloors = Array.from(
      new Set(
        rooms
          .map(room => firstRecordValue(room, ['floor', 'floor_number']))
          .filter(Boolean),
      ),
    );
    return ['All', ...uniqueFloors];
  }, [rooms]);
  const [floor, setFloor] = useState('All');
  const filteredRooms = useMemo(() => {
    const floorFiltered =
      floor === 'All'
        ? rooms
        : rooms.filter(
            room => firstRecordValue(room, ['floor', 'floor_number']) === floor,
          );
    return filterRecordsBySearch(floorFiltered, query);
  }, [floor, query, rooms]);
  const {hasMore, loadMore, visibleItems} = useScrollPagination(filteredRooms);

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.screenContent}
      data={visibleItems}
      keyExtractor={(item, index) =>
        `${firstRecordValue(item, ['id', 'room_number', 'number'])}-${index}`
      }
      onEndReached={loadMore}
      onEndReachedThreshold={0.35}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} />}
      ListFooterComponent={<ListFooter hasMore={hasMore} loading={loading} />}
      ListHeaderComponent={
        <View>
          <TopAppBar
            title="Rooms"
            leftIcon={ChevronLeft}
            onLeftPress={onBack}
            rightIcon={Menu}
            notificationIcon={Bell}
            secondaryRightIcon={Plus}
            onRightPress={onMenu}
            onNotificationPress={onOpenNotifications}
            onSecondaryRightPress={() => onOpenRoomForm(null)}
          />
          <LoadingProcessCard
            active={loading}
            label="Loading rooms"
            processes={loadingProcesses}
          />
          <ErrorNotice message={error} onRetry={onRefresh} />
          <SearchBox
            placeholder="Search room, type, floor..."
            value={query}
            onChangeText={setQuery}
          />
          <ChipRow labels={floors} activeLabel={floor} onSelect={setFloor} />
        </View>
      }
      ListEmptyComponent={loading ? null : <EmptyState label="No rooms returned from API." />}
      renderItem={({item}) => {
        const roomNumber = firstRecordValue(item, ['room_number', 'name', 'number']);
        const status = firstRecordValue(item, ['status']);
        return (
          <Pressable style={styles.roomListCard} onPress={() => onOpenRoomForm(item)}>
            <View style={styles.roomListIcon}>
              <Hotel color={blue} size={22} strokeWidth={2.2} />
            </View>
            <View style={styles.roomListText}>
              <Text style={styles.cardTitle}>Room {roomNumber}</Text>
              <Text style={styles.caption}>
                Floor {firstRecordValue(item, ['floor', 'floor_number'])}
                {' • '}
                {firstRecordValue(item, ['room_type', 'room_type_name', 'type'])}
              </Text>
              <Text style={styles.captionTiny}>
                Guest {firstRecordValue(item, ['guest_name', 'primary_guest_name']) || 'None'}
              </Text>
            </View>
            <View style={styles.roomListActions}>
              <StatusBadge label={status || 'No Status'} tone={statusTone(status)} />
              <ActionMenu
                items={[
                  {label: 'Edit Room', onPress: () => onOpenRoomForm(item)},
                  {label: 'Create Ticket', onPress: () => onNavigate('tickets')},
                  {label: 'Mark Maintenance', onPress: () => onQuickRecordAction('rooms', item, 'maintenance')},
                  {label: 'Delete Room', tone: 'danger', onPress: () => onQuickRecordAction('rooms', item, 'delete')},
                ]}
              />
              <Pressable style={styles.addMiniButton} onPress={() => onNavigate('tickets')}>
                <Ticket color={blue} size={16} strokeWidth={2.2} />
              </Pressable>
            </View>
          </Pressable>
        );
      }}
    />
  );
}

function TicketsScreen({
  error,
  loading,
  loadingProcesses,
  tickets,
  onBack,
  onCreateTicket,
  onOpenTicket,
  onOpenNotifications,
  onQuickRecordAction,
  onRefresh,
}: {
  error: string | null;
  loading: boolean;
  loadingProcesses: string[];
  tickets: TicketView[];
  onBack: () => void;
  onCreateTicket: () => void;
  onOpenTicket: (ticket: TicketView) => void;
  onOpenNotifications: () => void;
  onQuickRecordAction: ActionHandler;
  onRefresh: () => void;
}) {
  const [filter, setFilter] = useState('All');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [query, setQuery] = useState('');
  const filteredTickets = useMemo(
    () => filterRecordsBySearch(filterByStatus(tickets, filter), query),
    [filter, query, tickets],
  );
  const {hasMore, loadMore, visibleItems} = useScrollPagination(filteredTickets);

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.screenContent}
      data={visibleItems}
      keyExtractor={(item, index) => `${item.code}-${index}`}
      onEndReached={loadMore}
      onEndReachedThreshold={0.35}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} />}
      ListFooterComponent={<ListFooter hasMore={hasMore} loading={loading} />}
      ListHeaderComponent={
        <View>
          <TopAppBar
            title="Tickets"
            leftIcon={ChevronLeft}
            onLeftPress={onBack}
            rightIcon={Filter}
            notificationIcon={Bell}
            secondaryRightIcon={Plus}
            onRightPress={() => setFiltersOpen(current => !current)}
            onNotificationPress={onOpenNotifications}
            onSecondaryRightPress={onCreateTicket}
          />
          <LoadingProcessCard
            active={loading}
            label="Loading tickets"
            processes={loadingProcesses}
          />
          <ErrorNotice message={error} onRetry={onRefresh} />
          <SearchBox
            placeholder="Search ticket, guest, room..."
            value={query}
            onChangeText={setQuery}
          />
          {filtersOpen ? (
            <View style={styles.contextBanner}>
              <Text style={styles.formLabel}>Ticket Filters</Text>
              <ChipRow
                labels={['All', 'Open', 'In Progress', 'Closed']}
                activeLabel={filter}
                onSelect={setFilter}
              />
            </View>
          ) : null}
        </View>
      }
      ListEmptyComponent={loading ? null : <EmptyState label="No tickets returned from API." />}
      renderItem={({item}) => (
        <TicketCard
          ticket={item}
          onPress={() => onOpenTicket(item)}
          actions={[
            {label: 'Open Detail', onPress: () => onOpenTicket(item)},
            {
              label: 'Accept',
              onPress: () => onQuickRecordAction('tickets', {...item.raw, id: item.id}, 'accept'),
            },
            {
              label: 'Complete',
              onPress: () => onQuickRecordAction('tickets', {...item.raw, id: item.id}, 'complete'),
            },
            {
              label: 'Reopen',
              onPress: () => onQuickRecordAction('tickets', {...item.raw, id: item.id}, 'reopen'),
            },
          ]}
        />
      )}
    />
  );
}

function EscalationsScreen({
  error,
  escalations,
  loading,
  loadingProcesses,
  onBack,
  onMenu,
  onOpenNotifications,
  onQuickRecordAction,
  onRefresh,
}: {
  error: string | null;
  escalations: ArcadiaRecord[];
  loading: boolean;
  loadingProcesses: string[];
  onBack: () => void;
  onMenu: () => void;
  onOpenNotifications: () => void;
  onQuickRecordAction: ActionHandler;
  onRefresh: () => void;
}) {
  const [filter, setFilter] = useState('All');
  const [query, setQuery] = useState('');
  const filteredEscalations = useMemo(
    () => filterRecordsBySearch(filterRecordsByStatus(escalations, filter), query),
    [escalations, filter, query],
  );
  const {hasMore, loadMore, visibleItems} = useScrollPagination(filteredEscalations);

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.screenContent}
      data={visibleItems}
      keyExtractor={(item, index) =>
        `${firstRecordValue(item, ['id', 'escalation_id', 'ticket_id'])}-${index}`
      }
      onEndReached={loadMore}
      onEndReachedThreshold={0.35}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} />}
      ListFooterComponent={<ListFooter hasMore={hasMore} loading={loading} />}
      ListHeaderComponent={
        <View>
          <TopAppBar
            title="Escalations"
            leftIcon={ChevronLeft}
            onLeftPress={onBack}
            rightIcon={Menu}
            notificationIcon={Bell}
            onRightPress={onMenu}
            onNotificationPress={onOpenNotifications}
          />
          <LoadingProcessCard
            active={loading}
            label="Loading escalations"
            processes={loadingProcesses}
          />
          <ErrorNotice message={error} onRetry={onRefresh} />
          <SearchBox
            placeholder="Search escalation, owner, ticket..."
            value={query}
            onChangeText={setQuery}
          />
          <ChipRow
            labels={['All', 'Open', 'Acknowledged', 'Resolved', 'Breached']}
            activeLabel={filter}
            onSelect={setFilter}
          />
        </View>
      }
      ListEmptyComponent={
        loading ? null : <EmptyState label="No escalations returned from API." />
      }
      renderItem={({item}) => {
        const status = firstRecordValue(item, ['status', 'stage']);
        const title =
          firstRecordValue(item, ['title', 'reason', 'summary', 'ticket_title']) ||
          firstRecordValue(item, ['ticket_code', 'ticket_id']);
        return (
          <View style={styles.ticketCard}>
            <View style={styles.rowBetween}>
              <Text style={styles.ticketCode}>
                {firstRecordValue(item, ['escalation_code', 'code', 'id'])}
              </Text>
              <View style={styles.ticketCardActions}>
                <StatusBadge label={status} tone={statusTone(status)} />
                <ActionMenu
                  items={[
                    {label: 'Acknowledge', onPress: () => onQuickRecordAction('escalations', item, 'acknowledge')},
                    {label: 'Resolve', onPress: () => onQuickRecordAction('escalations', item, 'resolve')},
                    {label: 'Delete Record', tone: 'danger', onPress: () => onQuickRecordAction('escalations', item, 'delete')},
                  ]}
                />
              </View>
            </View>
            <Text style={styles.ticketTitle}>{title}</Text>
            <Text style={styles.cardSubtitle}>
              Level {firstRecordValue(item, ['level', 'priority', 'severity'])}
              {' • '}
              Owner {firstRecordValue(item, ['owner_name', 'assigned_to_name', 'team_name'])}
            </Text>
            <Text style={styles.caption}>
              SLA {firstRecordValue(item, ['sla_status', 'sla_due_at', 'due_at'])}
            </Text>
          </View>
        );
      }}
    />
  );
}

function NotificationsScreen({
  error,
  loading,
  loadingProcesses,
  notifications,
  onBack,
  onMenu,
  onOpenNotifications,
  onQuickRecordAction,
  onRefresh,
}: {
  error: string | null;
  loading: boolean;
  loadingProcesses: string[];
  notifications: ArcadiaRecord[];
  onBack: () => void;
  onMenu: () => void;
  onOpenNotifications: () => void;
  onQuickRecordAction: ActionHandler;
  onRefresh: () => void;
}) {
  const [filter, setFilter] = useState('All');
  const [query, setQuery] = useState('');
  const filteredNotifications = useMemo(() => {
    const base =
      filter === 'Unread'
        ? notifications.filter(item =>
            ['false', '0', 'unread', ''].includes(
              firstRecordValue(item, ['is_read', 'read', 'status']).toLowerCase(),
            ),
          )
        : filterRecordsByStatus(notifications, filter);
    return filterRecordsBySearch(base, query);
  }, [filter, notifications, query]);
  const {hasMore, loadMore, visibleItems} = useScrollPagination(filteredNotifications);

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.screenContent}
      data={visibleItems}
      keyExtractor={(item, index) =>
        `${firstRecordValue(item, ['id', 'notification_id'])}-${index}`
      }
      onEndReached={loadMore}
      onEndReachedThreshold={0.35}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} />}
      ListFooterComponent={<ListFooter hasMore={hasMore} loading={loading} />}
      ListHeaderComponent={
        <View>
          <TopAppBar
            title="Notifications"
            leftIcon={ChevronLeft}
            onLeftPress={onBack}
            rightIcon={Menu}
            notificationIcon={Bell}
            onRightPress={onMenu}
            onNotificationPress={onOpenNotifications}
          />
          <LoadingProcessCard
            active={loading}
            label="Loading notifications"
            processes={loadingProcesses}
          />
          <ErrorNotice message={error} onRetry={onRefresh} />
          <SearchBox
            placeholder="Search notifications..."
            value={query}
            onChangeText={setQuery}
          />
          <ChipRow
            labels={['All', 'Unread', 'Read', 'Resolved']}
            activeLabel={filter}
            onSelect={setFilter}
          />
        </View>
      }
      ListEmptyComponent={
        loading ? null : <EmptyState label="No notifications returned from API." />
      }
      renderItem={({item}) => {
        const status = firstRecordValue(item, ['status', 'read_status']);
        const title = firstRecordValue(item, ['title', 'subject', 'type']);
        return (
          <View style={styles.notificationCard}>
            <View style={styles.whatsappIcon}>
              <Bell color="#FFFFFF" size={18} strokeWidth={2} />
            </View>
            <View style={styles.chatText}>
              <Text style={styles.cardTitle}>{title}</Text>
              <Text style={styles.caption}>
                {firstRecordValue(item, ['message', 'body', 'description'])}
              </Text>
            </View>
            <View style={styles.chatMeta}>
              <Text style={styles.captionTiny}>
                {firstRecordValue(item, ['created_at', 'updated_at'])}
              </Text>
              {status ? <StatusBadge label={status} tone={statusTone(status)} /> : null}
              <ActionMenu
                items={[
                  {label: 'Mark Read', onPress: () => onQuickRecordAction('notifications', item, 'read')},
                  {label: 'Archive', onPress: () => onQuickRecordAction('notifications', item, 'archive')},
                  {label: 'Delete Notification', tone: 'danger', onPress: () => onQuickRecordAction('notifications', item, 'delete')},
                ]}
              />
            </View>
          </View>
        );
      }}
    />
  );
}

function HousekeepingScreen({
  error,
  loading,
  loadingProcesses,
  tasks,
  onBack,
  onMenu,
  onOpenNotifications,
  onQuickRecordAction,
  onRefresh,
}: {
  error: string | null;
  loading: boolean;
  loadingProcesses: string[];
  tasks: ArcadiaRecord[];
  onBack: () => void;
  onMenu: () => void;
  onOpenNotifications: () => void;
  onQuickRecordAction: ActionHandler;
  onRefresh: () => void;
}) {
  const [filter, setFilter] = useState('All');
  const [query, setQuery] = useState('');
  const filteredTasks = useMemo(
    () => filterRecordsBySearch(filterRecordsByStatus(tasks, filter), query),
    [filter, query, tasks],
  );
  const {hasMore, loadMore, visibleItems} = useScrollPagination(filteredTasks);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.screenContent}
      onScroll={handleScrollLoadMore(loadMore)}
      scrollEventThrottle={16}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} />}>
      <TopAppBar
        title="Housekeeping"
        leftIcon={ChevronLeft}
        onLeftPress={onBack}
      rightIcon={Menu}
      notificationIcon={Bell}
      onRightPress={onMenu}
      onNotificationPress={onOpenNotifications}
    />
      <LoadingProcessCard
        active={loading}
        label="Loading housekeeping"
        processes={loadingProcesses}
      />
      <ErrorNotice message={error} onRetry={onRefresh} />
      <SearchBox
        placeholder="Search room, task, status..."
        value={query}
        onChangeText={setQuery}
      />
      <View style={styles.tabs}>
        <View style={[styles.tabItem, styles.activeTabItem]}>
          <Text style={[styles.tabText, styles.activeTabText]}>Tasks</Text>
        </View>
        <View style={styles.tabItem}>
          <Text style={styles.tabText}>Rooms</Text>
        </View>
      </View>
      <ChipRow
        labels={['All', 'Pending', 'In Progress', 'Completed']}
        activeLabel={filter}
        onSelect={setFilter}
      />
      <SectionTitle title="Today's Tasks" badge={String(filteredTasks.length)} />
      <View style={styles.cardStack}>
        {visibleItems.map((task, index) => {
          const status = firstRecordValue(task, ['status', 'stage']);
          const room = firstRecordValue(task, ['room_number', 'room', 'room_name']);
          return (
          <View key={`${room}-${index}`} style={styles.taskCard}>
            <View style={styles.staffText}>
              <Text style={styles.cardTitle}>{room}</Text>
              <Text style={styles.cardSubtitleStrong}>
                {firstRecordValue(task, ['task_name', 'title', 'description'])}
              </Text>
              <Text style={styles.caption}>
                Due: {firstRecordValue(task, ['due_time', 'due_at', 'scheduled_at'])}
              </Text>
            </View>
            <StatusBadge label={status} tone={statusTone(status)} />
            <ActionMenu
              items={[
                {label: 'Mark In Progress', onPress: () => onQuickRecordAction('housekeeping', task, 'in_progress')},
                {label: 'Mark Completed', onPress: () => onQuickRecordAction('housekeeping', task, 'completed')},
                {label: 'Delete Record', tone: 'danger', onPress: () => onQuickRecordAction('housekeeping', task, 'delete')},
              ]}
            />
          </View>
        );})}
      </View>
      {filteredTasks.length === 0 && !loading ? (
        <EmptyState label="No housekeeping tasks returned from API." />
      ) : null}
      <Pressable style={styles.fullPrimaryButton}>
        <QrCode color="#FFFFFF" size={18} strokeWidth={2} />
        <Text style={styles.fullPrimaryButtonText}>Scan Room QR</Text>
      </Pressable>
      <ListFooter hasMore={hasMore} loading={loading} />
    </ScrollView>
  );
}

function FoodScreen({
  error,
  loading,
  loadingProcesses,
  orders,
  onBack,
  onMenu,
  onOpenNotifications,
  onQuickRecordAction,
  onRefresh,
}: {
  error: string | null;
  loading: boolean;
  loadingProcesses: string[];
  orders: ArcadiaRecord[];
  onBack: () => void;
  onMenu: () => void;
  onOpenNotifications: () => void;
  onQuickRecordAction: ActionHandler;
  onRefresh: () => void;
}) {
  const [filter, setFilter] = useState('All');
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('Orders');
  const filteredOrders = useMemo(
    () => filterRecordsBySearch(filterRecordsByStatus(orders, filter), query),
    [filter, orders, query],
  );
  const {hasMore, loadMore, visibleItems} = useScrollPagination(filteredOrders);

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.screenContentWithCart}
        onScroll={handleScrollLoadMore(loadMore)}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} />}>
        <TopAppBar
          title="F&B"
          leftIcon={ChevronLeft}
          onLeftPress={onBack}
          rightIcon={Menu}
          notificationIcon={Bell}
          onRightPress={onMenu}
          onNotificationPress={onOpenNotifications}
        />
        <LoadingProcessCard
          active={loading}
          label="Loading F&B orders"
          processes={loadingProcesses}
        />
        <ErrorNotice message={error} onRetry={onRefresh} />
        <SearchBox
          placeholder="Search order, guest, room..."
          value={query}
          onChangeText={setQuery}
        />
        <ChipRow
          labels={['Orders', 'Menu', 'Taxes']}
          activeLabel={tab}
          onSelect={setTab}
        />
        <ChipRow
          labels={['All', 'Received', 'Preparing', 'Ready', 'Delivered']}
          activeLabel={filter}
          onSelect={setFilter}
        />
        <View style={styles.foodLayout}>
          <View style={styles.foodList}>
            {tab === 'Orders' ? visibleItems.map((order, index) => (
              <View key={`${firstRecordValue(order, ['id', 'order_number'])}-${index}`} style={styles.foodCard}>
                <View style={styles.foodImagePlaceholder}>
                  <Utensils color={blue} size={22} strokeWidth={2.2} />
                </View>
                <View style={styles.foodText}>
                  <Text style={styles.cardSubtitleStrong}>
                    {firstRecordValue(order, ['order_number', 'id'])}
                  </Text>
                  <Text style={styles.caption}>
                    Room {firstRecordValue(order, ['room_number', 'room'])}
                  </Text>
                  <Text style={styles.priceText}>
                    {formatAmount(firstRecordValue(order, ['total_amount', 'total']))}
                  </Text>
                </View>
                <StatusBadge
                  label={firstRecordValue(order, ['status'])}
                  tone={statusTone(firstRecordValue(order, ['status']))}
                />
                <ActionMenu
                  items={[
                    {label: 'Preparing', onPress: () => onQuickRecordAction('orders', order, 'preparing')},
                    {label: 'Ready', onPress: () => onQuickRecordAction('orders', order, 'ready')},
                    {label: 'Delivered', onPress: () => onQuickRecordAction('orders', order, 'delivered')},
                    {label: 'Cancel Order', tone: 'danger', onPress: () => onQuickRecordAction('orders', order, 'cancelled')},
                  ]}
                />
              </View>
            )) : (
              <EmptyState
                label={
                  tab === 'Menu'
                    ? 'Menu management will load from menu item APIs.'
                    : 'Tax rules will load from tax APIs.'
                }
              />
            )}
            {tab === 'Orders' && filteredOrders.length === 0 && !loading ? (
              <EmptyState label="No F&B orders returned from API." />
            ) : null}
          </View>
        </View>
        {tab === 'Orders' ? <ListFooter hasMore={hasMore} loading={loading} /> : null}
      </ScrollView>
      <View style={styles.cartBar}>
        <Text style={styles.cartText}>Orders • {filteredOrders.length}</Text>
        <Text style={styles.cartText}>API data ›</Text>
      </View>
    </View>
  );
}

function KitchenScreen({
  error,
  loading,
  loadingProcesses,
  orders,
  onBack,
  onMenu,
  onOpenNotifications,
  onQuickRecordAction,
  onRefresh,
}: {
  error: string | null;
  loading: boolean;
  loadingProcesses: string[];
  orders: ArcadiaRecord[];
  onBack: () => void;
  onMenu: () => void;
  onOpenNotifications: () => void;
  onQuickRecordAction: ActionHandler;
  onRefresh: () => void;
}) {
  const [filter, setFilter] = useState('Received');
  const [query, setQuery] = useState('');
  const filteredOrders = useMemo(
    () => filterRecordsBySearch(filterRecordsByStatus(orders, filter), query),
    [filter, orders, query],
  );
  const {hasMore, loadMore, visibleItems} = useScrollPagination(filteredOrders);

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.screenContent}
      data={visibleItems}
      keyExtractor={(item, index) =>
        `${firstRecordValue(item, ['id', 'order_number'])}-${index}`
      }
      onEndReached={loadMore}
      onEndReachedThreshold={0.35}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} />}
      ListFooterComponent={<ListFooter hasMore={hasMore} loading={loading} />}
      ListHeaderComponent={
        <View>
          <TopAppBar
            title="Kitchen"
            leftIcon={ChevronLeft}
            onLeftPress={onBack}
            rightIcon={Menu}
            notificationIcon={Bell}
            onRightPress={onMenu}
            onNotificationPress={onOpenNotifications}
          />
          <LoadingProcessCard
            active={loading}
            label="Loading kitchen orders"
            processes={loadingProcesses}
          />
          <ErrorNotice message={error} onRetry={onRefresh} />
          <SearchBox
            placeholder="Search order, guest, room..."
            value={query}
            onChangeText={setQuery}
          />
          <ChipRow
            labels={['Received', 'Preparing', 'Ready', 'Delivered', 'Cancelled']}
            activeLabel={filter}
            onSelect={setFilter}
          />
        </View>
      }
      ListEmptyComponent={
        loading ? null : <EmptyState label="No kitchen orders returned from API." />
      }
      renderItem={({item}) => {
        const status = firstRecordValue(item, ['status']);
        return (
          <View style={styles.kitchenOrderCard}>
            <View style={styles.rowBetween}>
              <Text style={styles.ticketCode}>
                {firstRecordValue(item, ['order_number', 'id'])}
              </Text>
              <View style={styles.ticketCardActions}>
                <StatusBadge label={status} tone={statusTone(status)} />
                <ActionMenu
                  items={[
                    {label: 'Preparing', onPress: () => onQuickRecordAction('orders', item, 'preparing')},
                    {label: 'Ready', onPress: () => onQuickRecordAction('orders', item, 'ready')},
                    {label: 'Delivered', onPress: () => onQuickRecordAction('orders', item, 'delivered')},
                    {label: 'Cancel Order', tone: 'danger', onPress: () => onQuickRecordAction('orders', item, 'cancelled')},
                  ]}
                />
              </View>
            </View>
            <Text style={styles.ticketTitle}>
              Room {firstRecordValue(item, ['room_number', 'room'])}
            </Text>
            <Text style={styles.caption}>
              {firstRecordValue(item, ['special_instructions', 'instructions'])}
            </Text>
            <View style={styles.stageTrack}>
              {['received', 'preparing', 'ready', 'delivered'].map(stage => (
                <View
                  key={stage}
                  style={[
                    styles.stagePill,
                    status.toLowerCase() === stage && styles.activeStagePill,
                  ]}>
                  <Text
                    style={[
                      styles.stageText,
                      status.toLowerCase() === stage && styles.activeStageText,
                    ]}>
                    {stage}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        );
      }}
    />
  );
}

function WhatsAppScreen({
  conversations,
  error,
  loading,
  loadingProcesses,
  onBack,
  onMenu,
  onOpenChat,
  onOpenNotifications,
  onRefresh,
}: {
  conversations: ArcadiaRecord[];
  error: string | null;
  loading: boolean;
  loadingProcesses: string[];
  onBack: () => void;
  onMenu: () => void;
  onOpenChat: (conversation: ArcadiaRecord) => void;
  onOpenNotifications: () => void;
  onRefresh: () => void;
}) {
  const [filter, setFilter] = useState('All');
  const [query, setQuery] = useState('');
  const filteredConversations = useMemo(
    () => filterRecordsBySearch(filterRecordsByStatus(conversations, filter), query),
    [conversations, filter, query],
  );
  const {hasMore, loadMore, visibleItems} = useScrollPagination(filteredConversations);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.screenContent}
      onScroll={handleScrollLoadMore(loadMore)}
      scrollEventThrottle={16}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} />}>
      <TopAppBar
        title="WhatsApp"
        leftIcon={ChevronLeft}
        onLeftPress={onBack}
      rightIcon={Menu}
      notificationIcon={Bell}
      onRightPress={onMenu}
      onNotificationPress={onOpenNotifications}
    />
      <LoadingProcessCard
        active={loading}
        label="Loading WhatsApp conversations"
        processes={loadingProcesses}
      />
      <ErrorNotice message={error} onRetry={onRefresh} />
      <SearchBox
        placeholder="Search conversations..."
        value={query}
        onChangeText={setQuery}
      />
      <ChipRow
        labels={['All', 'Open', 'Pending', 'Resolved']}
        activeLabel={filter}
        onSelect={setFilter}
      />
      <View style={styles.cardStack}>
        {visibleItems.map((conversation, index) => {
          const name = firstRecordValue(conversation, [
            'guest_name',
            'contact_name',
            'name',
            'phone',
          ]);
          const unread = firstRecordValue(conversation, ['unread_count', 'unread']);
          return (
          <Pressable
            key={`${name}-${index}`}
            style={styles.chatRow}
            onPress={() => onOpenChat(conversation)}>
            <View style={styles.whatsappIcon}>
              <MessageCircle color="#FFFFFF" size={18} strokeWidth={2} />
            </View>
            <View style={styles.chatText}>
              <Text style={styles.cardTitle}>{name}</Text>
              <Text style={styles.caption}>
                {firstRecordValue(conversation, ['last_message', 'message', 'preview'])}
              </Text>
            </View>
            <View style={styles.chatMeta}>
              <Text style={styles.captionTiny}>
                {firstRecordValue(conversation, ['last_message_at', 'updated_at'])}
              </Text>
              {unread ? (
                <View style={styles.unreadDot}>
                  <Text style={styles.unreadText}>{unread}</Text>
                </View>
              ) : null}
              <ActionMenu
                items={[
                  {label: 'Open Chat', onPress: () => onOpenChat(conversation)},
                  {label: 'Mark Resolved', onPress: () => onOpenChat(conversation)},
                  {label: 'Create Ticket', onPress: () => onOpenChat(conversation)},
                ]}
              />
            </View>
          </Pressable>
        );})}
      </View>
      {filteredConversations.length === 0 && !loading ? (
        <EmptyState label="No WhatsApp conversations returned from API." />
      ) : null}
      <ListFooter hasMore={hasMore} loading={loading} />
    </ScrollView>
  );
}

function StaffScreen({
  error,
  loading,
  loadingProcesses,
  staff,
  onBack,
  onMenu,
  onOpenNotifications,
  onOpenStaffProfile,
  onRefresh,
}: {
  error: string | null;
  loading: boolean;
  loadingProcesses: string[];
  staff: ArcadiaRecord[];
  onBack: () => void;
  onMenu: () => void;
  onOpenNotifications: () => void;
  onOpenStaffProfile: (staff: ArcadiaRecord) => void;
  onRefresh: () => void;
}) {
  const [filter, setFilter] = useState('All');
  const [query, setQuery] = useState('');
  const filteredStaff = useMemo(() => {
    let filtered = staff;
    if (filter === 'On Duty') {
      filtered = staff.filter(item => isRecordTruthy(item, ['is_on_duty']));
    } else if (filter === 'Off Duty') {
      filtered = staff.filter(
        item =>
          isRecordTruthy(item, ['is_active']) &&
          !isRecordTruthy(item, ['is_on_duty']),
      );
    } else if (filter === 'Active') {
      filtered = staff.filter(item => isRecordTruthy(item, ['is_active']));
    } else if (filter === 'Inactive') {
      filtered = staff.filter(item => !isRecordTruthy(item, ['is_active']));
    } else if (filter !== 'All') {
      filtered = filterRecordsByStatus(staff, filter);
    }
    return filterRecordsBySearch(filtered, query);
  }, [filter, query, staff]);
  const {hasMore, loadMore, visibleItems} = useScrollPagination(filteredStaff);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.screenContent}
      onScroll={handleScrollLoadMore(loadMore)}
      scrollEventThrottle={16}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} />}>
      <TopAppBar
        title="Staff Portal"
        leftIcon={ChevronLeft}
        onLeftPress={onBack}
      rightIcon={Menu}
      notificationIcon={Bell}
      onRightPress={onMenu}
      onNotificationPress={onOpenNotifications}
    />
      <LoadingProcessCard
        active={loading}
        label="Loading staff"
        processes={loadingProcesses}
      />
      <ErrorNotice message={error} onRetry={onRefresh} />
      <SearchBox
        placeholder="Search staff, role, department..."
        value={query}
        onChangeText={setQuery}
      />
      <View style={styles.staffSummaryGrid}>
        <MetricTile label="Total" value={staff.length} tone="blue" />
        <MetricTile
          label="On Duty"
          value={staff.filter(item => isRecordTruthy(item, ['is_on_duty'])).length}
          tone="green"
        />
        <MetricTile
          label="Active"
          value={staff.filter(item => isRecordTruthy(item, ['is_active'])).length}
          tone="orange"
        />
        <MetricTile
          label="Inactive"
          value={staff.filter(item => !isRecordTruthy(item, ['is_active'])).length}
          tone="red"
        />
      </View>
      <ChipRow
        labels={['All', 'On Duty', 'Off Duty', 'Active', 'Inactive']}
        activeLabel={filter}
        onSelect={setFilter}
      />
      <SectionTitle title="Today's Attendance" />
      <View style={styles.cardStack}>
        {visibleItems.map((member, index) => {
          const name = firstRecordValue(member, ['name', 'full_name', 'email']);
          const onDuty = isRecordTruthy(member, ['is_on_duty']);
          const active = isRecordTruthy(member, ['is_active']);
          const status = onDuty ? 'On Duty' : active ? 'Off Duty' : 'Inactive';
          return (
          <Pressable
            key={`${name}-${index}`}
            style={styles.staffCard}
            onPress={() => onOpenStaffProfile(member)}>
            <Avatar label={name.charAt(0)} size={42} />
            <View style={styles.staffText}>
              <Text style={styles.cardTitle}>{name}</Text>
              <Text style={styles.caption}>
                {firstRecordValue(member, ['job_role', 'role', 'department_name'])}
              </Text>
              <Text style={styles.captionTiny}>
                Last punch: {firstRecordValue(member, ['last_punch_at', 'check_in_time'])}
              </Text>
            </View>
            <View style={styles.ticketCardActions}>
              <StatusBadge label={status} tone={statusTone(status)} />
              <ActionMenu
                items={[
                  {label: 'Open Profile', onPress: () => onOpenStaffProfile(member)},
                  {label: 'Assign Task', onPress: () => onOpenStaffProfile(member)},
                  {label: 'Deactivate', tone: 'danger', onPress: () => onOpenStaffProfile(member)},
                ]}
              />
            </View>
          </Pressable>
        );})}
      </View>
      {filteredStaff.length === 0 && !loading ? (
        <EmptyState label="No staff records returned from API." />
      ) : null}
      <ListFooter hasMore={hasMore} loading={loading} />
    </ScrollView>
  );
}

function AssistantScreen({
  data,
  onBack,
  onMenu,
  onOpenNotifications,
}: {
  data: AppData;
  onBack: () => void;
  onMenu: () => void;
  onOpenNotifications: () => void;
}) {
  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.chatContent}>
        <TopAppBar
          title="AI Assistant"
          leftIcon={ChevronLeft}
          onLeftPress={onBack}
          rightIcon={Menu}
          notificationIcon={Bell}
          onRightPress={onMenu}
          onNotificationPress={onOpenNotifications}
        />
        <View style={styles.userBubble}>
          <Text style={styles.userBubbleText}>Show me today's occupancy and pending tickets</Text>
          <Text style={styles.bubbleTime}>10:30 AM</Text>
        </View>
        <View style={styles.aiBubble}>
          <Text style={styles.aiBubbleText}>Here is the summary for today:</Text>
          <Text style={styles.aiListText}>• Occupancy: {data.occupancy}%</Text>
          <Text style={styles.aiListText}>• Total Rooms: {data.roomsTotal}</Text>
          <Text style={styles.aiListText}>• Occupied: {data.occupiedRooms}</Text>
          <Text style={styles.aiListText}>• Vacant: {data.vacantRooms}</Text>
          <Text style={styles.aiListText}>• Out of Order: {data.outOfOrderRooms}</Text>
          <Text style={styles.aiListText}>• Pending Tickets: {data.openTickets}</Text>
        </View>
      </ScrollView>
      <View style={styles.composer}>
        <TextInput
          placeholder="Ask anything..."
          placeholderTextColor="#94A3B8"
          style={styles.composerInput}
        />
        <Mic color="#64748B" size={18} strokeWidth={2} />
        <View style={styles.sendButton}>
          <Send color={blue} size={18} strokeWidth={2.2} />
        </View>
      </View>
    </View>
  );
}

function ProfileScreen({
  hotelName,
  user,
  onBack,
  onLogout,
  onMenu,
  onOpenNotifications,
  onNavigate,
  onOpenProfileOption,
}: {
  hotelName: string;
  user: UserProfile;
  onBack: () => void;
  onLogout: () => void;
  onMenu: () => void;
  onOpenNotifications: () => void;
  onNavigate: ScreenAction;
  onOpenProfileOption: (label: string) => void;
}) {
  const options = [
    ['My Profile', User],
    ['Change Password', LockKeyhole],
    ['Notifications', Bell],
    ['App Settings', Settings],
    ['Help & Support', KeyRound],
  ] as const;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenContent}>
      <TopAppBar
        title="Profile"
        leftIcon={ChevronLeft}
        onLeftPress={onBack}
        rightIcon={Menu}
        notificationIcon={Bell}
        onRightPress={onMenu}
        onNotificationPress={onOpenNotifications}
      />
      <View style={styles.profileHeader}>
        <Avatar label="A" size={58} />
        <View>
          <Text style={styles.profileName}>{user.name ?? user.email}</Text>
          <Text style={styles.caption}>{user.email}</Text>
          <Text style={styles.profileRole}>{user.job_role ?? user.user_type ?? 'User'}</Text>
          <Text style={styles.profileHotel}>{hotelName}</Text>
        </View>
      </View>
      <View style={styles.profileOptions}>
        {options.map(([label, Icon]) => (
          <ProfileOption
            key={label}
            icon={Icon}
            label={label}
            onPress={() =>
              label === 'Notifications'
                ? onNavigate('notifications')
                : onOpenProfileOption(label)
            }
          />
        ))}
        <Pressable style={styles.profileOption} onPress={onLogout}>
          <LogOut color="#DC2626" size={19} strokeWidth={2} />
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
