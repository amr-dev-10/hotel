import {useMemo, useState} from 'react';
import {FlatList, Pressable, RefreshControl, ScrollView, Text, TextInput, View} from 'react-native';

import {
  Avatar,
  ChipRow,
  DepartmentRow,
  EmptyState,
  ErrorNotice,
  MetricTile,
  OverviewStat,
  ProfileOption,
  QuickAction,
  ReservationCard,
  RoomAction,
  SearchBox,
  SectionTitle,
  StatusBadge,
  TicketCard,
  TopAppBar,
} from '../AppComponents';
import {
  Bell,
  Bot,
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
  formatAmount,
  isRecordTruthy,
} from '../dataUtils';
import {blue, styles} from '../styles';
import type {ScreenAction, ScreenKey} from '../types';
import type {AppData, ReservationView, TicketView} from '../../modules/dashboard';
import {statusTone} from '../../modules/operations/utils';
import type {ArcadiaRecord, UserProfile} from '../../types/domain';

export function ScreenContent({
  data,
  error,
  loading,
  screen,
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
  onOpenTicketForm,
  onOpenWhatsAppChat,
  onRefresh,
}: {
  data: AppData;
  error: string | null;
  loading: boolean;
  screen: ScreenKey;
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
  onOpenTicketForm: () => void;
  onOpenWhatsAppChat: (conversation: ArcadiaRecord) => void;
  onRefresh: () => void;
}) {
  if (screen === 'dashboard') {
    return (
      <DashboardScreen
        data={data}
        error={error}
        loading={loading}
        onMenu={onMenu}
        onNavigate={onNavigate}
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
        onBack={onBack}
        onMenu={onMenu}
        onOpenReservation={onOpenReservation}
        onOpenReservationForm={onOpenReservationForm}
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
        onBack={onBack}
        onMenu={onMenu}
        onOpenGuest={onOpenGuest}
        onRefresh={onRefresh}
      />
    );
  }
  if (screen === 'room') {
    return (
      <RoomScreen
        error={error}
        rooms={data.rooms}
        onBack={onBack}
        onMenu={onMenu}
        onNavigate={onNavigate}
        onOpenRoomForm={onOpenRoomForm}
      />
    );
  }
  if (screen === 'tickets') {
    return (
      <TicketsScreen
        loading={loading}
        error={error}
        tickets={data.tickets}
        onBack={onBack}
        onCreateTicket={onOpenTicketForm}
        onMenu={onMenu}
        onOpenTicket={onOpenTicket}
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
        onBack={onBack}
        onMenu={onMenu}
        onRefresh={onRefresh}
      />
    );
  }
  if (screen === 'notifications') {
    return (
      <NotificationsScreen
        loading={loading}
        error={error}
        notifications={data.notifications}
        onBack={onBack}
        onMenu={onMenu}
        onRefresh={onRefresh}
      />
    );
  }
  if (screen === 'housekeeping') {
    return (
      <HousekeepingScreen
        loading={loading}
        error={error}
        tasks={data.housekeeping}
        onBack={onBack}
        onMenu={onMenu}
        onRefresh={onRefresh}
      />
    );
  }
  if (screen === 'food') {
    return (
      <FoodScreen
        loading={loading}
        error={error}
        orders={data.orders}
        onBack={onBack}
        onMenu={onMenu}
        onRefresh={onRefresh}
      />
    );
  }
  if (screen === 'kitchen') {
    return (
      <KitchenScreen
        loading={loading}
        error={error}
        orders={data.orders}
        onBack={onBack}
        onMenu={onMenu}
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
        onBack={onBack}
        onMenu={onMenu}
        onOpenChat={onOpenWhatsAppChat}
        onRefresh={onRefresh}
      />
    );
  }
  if (screen === 'assistant') {
    return <AssistantScreen data={data} onBack={onBack} onMenu={onMenu} />;
  }
  if (screen === 'staff') {
    return (
      <StaffScreen
        loading={loading}
        error={error}
        staff={data.staff}
        onBack={onBack}
        onMenu={onMenu}
        onOpenStaffProfile={onOpenStaffProfile}
        onRefresh={onRefresh}
      />
    );
  }
  return (
    <ProfileScreen
      user={user}
      onBack={onBack}
      onLogout={onLogout}
      onMenu={onMenu}
      onNavigate={onNavigate}
      onOpenProfileOption={onOpenProfileOption}
    />
  );
}

function DashboardScreen({
  data,
  error,
  loading,
  onMenu,
  onNavigate,
  onRefresh,
}: {
  data: AppData;
  error: string | null;
  loading: boolean;
  onMenu: () => void;
  onNavigate: ScreenAction;
  onRefresh: () => void;
}) {
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.screenContent}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} />}>
      <TopAppBar title="Dashboard" leftIcon={Menu} onLeftPress={onMenu} rightIcon={Bell} />
      <ErrorNotice message={error} onRetry={onRefresh} />
      <View style={styles.overviewCard}>
        <View style={styles.rowBetween}>
          <View>
            <Text style={styles.overviewTitle}>Today's Overview</Text>
            <Text style={styles.overviewDate}>Live operations from API</Text>
          </View>
          <Pressable style={styles.reportButton}>
            <Text style={styles.reportButtonText}>View Report</Text>
          </Pressable>
        </View>
        <View style={styles.overviewStats}>
          <OverviewStat label="Check-ins" value={String(data.todayCheckIns)} trend="Live" />
          <OverviewStat label="Check-outs" value={String(data.todayCheckOuts)} trend="Live" />
          <OverviewStat label="Occupancy" value={`${data.occupancy}%`} trend="Live" />
          <OverviewStat label="Pending Tickets" value={String(data.openTickets)} trend="Live" danger />
        </View>
      </View>

      <SectionTitle title="Rooms Overview" action="View All" />
      <View style={styles.roomGrid}>
        <MetricTile label="Total Rooms" value={data.roomsTotal} tone="blue" />
        <MetricTile label="Occupied" value={data.occupiedRooms} tone="green" />
        <MetricTile label="Vacant" value={data.vacantRooms} tone="orange" />
        <MetricTile label="Out of Order" value={data.outOfOrderRooms} tone="red" />
      </View>

      <SectionTitle title="Department Status" action="View All" />
      <View style={styles.cardStack}>
        <DepartmentRow
          icon={ClipboardCheck}
          title="Housekeeping"
          tasks={data.housekeeping.length}
          tone="blue"
        />
        <DepartmentRow
          icon={Wrench}
          title="Tickets"
          tasks={data.openTickets}
          tone="red"
          up={data.openTickets > 0}
        />
        <DepartmentRow
          icon={Utensils}
          title="F&B Service"
          tasks={data.orders.length}
          tone="orange"
          up={data.orders.length > 0}
        />
        <DepartmentRow
          icon={Users}
          title="Staff"
          tasks={data.staff.length}
          tone="green"
        />
      </View>

      <View style={styles.quickGrid}>
        <QuickAction icon={Ticket} label="Create Ticket" onPress={() => onNavigate('tickets')} />
        <QuickAction icon={CalendarDays} label="Reservation" onPress={() => onNavigate('reservations')} />
        <QuickAction icon={QrCode} label="Scan QR" onPress={() => onNavigate('housekeeping')} />
        <QuickAction icon={Bot} label="Ask AI" onPress={() => onNavigate('assistant')} />
      </View>
    </ScrollView>
  );
}

function ReservationsScreen({
  error,
  reservations,
  loading,
  onBack,
  onMenu,
  onOpenReservation,
  onOpenReservationForm,
  onRefresh,
}: {
  error: string | null;
  reservations: ReservationView[];
  loading: boolean;
  onBack: () => void;
  onMenu: () => void;
  onOpenReservation: (reservation: ReservationView) => void;
  onOpenReservationForm: () => void;
  onRefresh: () => void;
}) {
  const [filter, setFilter] = useState('All');
  const filteredReservations = useMemo(
    () => filterByStatus(reservations, filter),
    [filter, reservations],
  );

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.screenContent}
      data={filteredReservations}
      keyExtractor={(item, index) => `${item.bookingId}-${index}`}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} />}
      ListHeaderComponent={
        <View>
          <TopAppBar
            title="Reservations"
            leftIcon={ChevronLeft}
            onLeftPress={onBack}
            rightIcon={Menu}
            secondaryRightIcon={Plus}
            onRightPress={onMenu}
            onSecondaryRightPress={onOpenReservationForm}
          />
          <ErrorNotice message={error} onRetry={onRefresh} />
          <SearchBox placeholder="Search by Guest, Room No, Booking ID..." />
          <ChipRow
            labels={['All', 'Today', 'Upcoming', 'Checked In', 'Checked Out']}
            activeLabel={filter}
            onSelect={setFilter}
          />
        </View>
      }
      ListEmptyComponent={<EmptyState label="No reservations returned from API." />}
      renderItem={({item}) => (
        <ReservationCard reservation={item} onPress={() => onOpenReservation(item)} />
      )}
    />
  );
}

function GuestsScreen({
  error,
  guests,
  loading,
  onBack,
  onMenu,
  onOpenGuest,
  onRefresh,
}: {
  error: string | null;
  guests: ArcadiaRecord[];
  loading: boolean;
  onBack: () => void;
  onMenu: () => void;
  onOpenGuest: (guest: ArcadiaRecord) => void;
  onRefresh: () => void;
}) {
  const [filter, setFilter] = useState('All');
  const filteredGuests = useMemo(() => filterRecordsByStatus(guests, filter), [filter, guests]);

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.screenContent}
      data={filteredGuests}
      keyExtractor={(item, index) =>
        `${firstRecordValue(item, ['id', 'phone', 'whatsapp_phone', 'name'])}-${index}`
      }
      refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} />}
      ListHeaderComponent={
        <View>
          <TopAppBar
            title="Guests"
            leftIcon={ChevronLeft}
            onLeftPress={onBack}
            rightIcon={Menu}
            onRightPress={onMenu}
          />
          <ErrorNotice message={error} onRetry={onRefresh} />
          <SearchBox placeholder="Search guest, phone, email..." />
          <ChipRow
            labels={['All', 'Pre Arrival', 'Checked In', 'Checked Out']}
            activeLabel={filter}
            onSelect={setFilter}
          />
        </View>
      }
      ListEmptyComponent={<EmptyState label="No guests returned from API." />}
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
            </View>
          </Pressable>
        );
      }}
    />
  );
}

function RoomScreen({
  error,
  rooms,
  onBack,
  onMenu,
  onNavigate,
  onOpenRoomForm,
}: {
  error: string | null;
  rooms: ArcadiaRecord[];
  onBack: () => void;
  onMenu: () => void;
  onNavigate: ScreenAction;
  onOpenRoomForm: (room: ArcadiaRecord | null) => void;
}) {
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
    if (floor === 'All') {
      return rooms;
    }
    return rooms.filter(
      room => firstRecordValue(room, ['floor', 'floor_number']) === floor,
    );
  }, [floor, rooms]);

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.screenContent}
      data={filteredRooms}
      keyExtractor={(item, index) =>
        `${firstRecordValue(item, ['id', 'room_number', 'number'])}-${index}`
      }
      ListHeaderComponent={
        <View>
          <TopAppBar
            title="Rooms"
            leftIcon={ChevronLeft}
            onLeftPress={onBack}
            rightIcon={Menu}
            secondaryRightIcon={Plus}
            onRightPress={onMenu}
            onSecondaryRightPress={() => onOpenRoomForm(null)}
          />
          <ErrorNotice message={error} />
          <SearchBox placeholder="Search room, type, floor..." />
          <ChipRow labels={floors} activeLabel={floor} onSelect={setFloor} />
        </View>
      }
      ListEmptyComponent={<EmptyState label="No rooms returned from API." />}
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
  tickets,
  onBack,
  onCreateTicket,
  onMenu,
  onOpenTicket,
  onRefresh,
}: {
  error: string | null;
  loading: boolean;
  tickets: TicketView[];
  onBack: () => void;
  onCreateTicket: () => void;
  onMenu: () => void;
  onOpenTicket: (ticket: TicketView) => void;
  onRefresh: () => void;
}) {
  const [filter, setFilter] = useState('All');
  const filteredTickets = useMemo(
    () => filterByStatus(tickets, filter),
    [filter, tickets],
  );

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.screenContent}
      data={filteredTickets}
      keyExtractor={(item, index) => `${item.code}-${index}`}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} />}
      ListHeaderComponent={
        <View>
          <TopAppBar
            title="Tickets"
            leftIcon={ChevronLeft}
            onLeftPress={onBack}
            rightIcon={Filter}
            secondaryRightIcon={Plus}
            onRightPress={onMenu}
            onSecondaryRightPress={onCreateTicket}
          />
          <ErrorNotice message={error} onRetry={onRefresh} />
          <ChipRow
            labels={['All', 'Open', 'In Progress', 'Closed']}
            activeLabel={filter}
            onSelect={setFilter}
          />
        </View>
      }
      ListEmptyComponent={<EmptyState label="No tickets returned from API." />}
      renderItem={({item}) => (
        <TicketCard ticket={item} onPress={() => onOpenTicket(item)} />
      )}
    />
  );
}

function EscalationsScreen({
  error,
  escalations,
  loading,
  onBack,
  onMenu,
  onRefresh,
}: {
  error: string | null;
  escalations: ArcadiaRecord[];
  loading: boolean;
  onBack: () => void;
  onMenu: () => void;
  onRefresh: () => void;
}) {
  const [filter, setFilter] = useState('All');
  const filteredEscalations = useMemo(
    () => filterRecordsByStatus(escalations, filter),
    [escalations, filter],
  );

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.screenContent}
      data={filteredEscalations}
      keyExtractor={(item, index) =>
        `${firstRecordValue(item, ['id', 'escalation_id', 'ticket_id'])}-${index}`
      }
      refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} />}
      ListHeaderComponent={
        <View>
          <TopAppBar
            title="Escalations"
            leftIcon={ChevronLeft}
            onLeftPress={onBack}
            rightIcon={Menu}
            onRightPress={onMenu}
          />
          <ErrorNotice message={error} onRetry={onRefresh} />
          <SearchBox placeholder="Search escalation, owner, ticket..." />
          <ChipRow
            labels={['All', 'Open', 'Acknowledged', 'Resolved', 'Breached']}
            activeLabel={filter}
            onSelect={setFilter}
          />
        </View>
      }
      ListEmptyComponent={<EmptyState label="No escalations returned from API." />}
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
              <StatusBadge label={status} tone={statusTone(status)} />
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
  notifications,
  onBack,
  onMenu,
  onRefresh,
}: {
  error: string | null;
  loading: boolean;
  notifications: ArcadiaRecord[];
  onBack: () => void;
  onMenu: () => void;
  onRefresh: () => void;
}) {
  const [filter, setFilter] = useState('All');
  const filteredNotifications = useMemo(() => {
    if (filter === 'Unread') {
      return notifications.filter(item =>
        ['false', '0', 'unread', ''].includes(
          firstRecordValue(item, ['is_read', 'read', 'status']).toLowerCase(),
        ),
      );
    }
    return filterRecordsByStatus(notifications, filter);
  }, [filter, notifications]);

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.screenContent}
      data={filteredNotifications}
      keyExtractor={(item, index) =>
        `${firstRecordValue(item, ['id', 'notification_id'])}-${index}`
      }
      refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} />}
      ListHeaderComponent={
        <View>
          <TopAppBar
            title="Notifications"
            leftIcon={ChevronLeft}
            onLeftPress={onBack}
            rightIcon={Menu}
            onRightPress={onMenu}
          />
          <ErrorNotice message={error} onRetry={onRefresh} />
          <SearchBox placeholder="Search notifications..." />
          <ChipRow
            labels={['All', 'Unread', 'Read', 'Resolved']}
            activeLabel={filter}
            onSelect={setFilter}
          />
        </View>
      }
      ListEmptyComponent={<EmptyState label="No notifications returned from API." />}
      renderItem={({item}) => {
        const status = firstRecordValue(item, ['status', 'read_status']);
        const title = firstRecordValue(item, ['title', 'subject', 'type']);
        return (
          <View style={styles.chatRow}>
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
  tasks,
  onBack,
  onMenu,
  onRefresh,
}: {
  error: string | null;
  loading: boolean;
  tasks: ArcadiaRecord[];
  onBack: () => void;
  onMenu: () => void;
  onRefresh: () => void;
}) {
  const [filter, setFilter] = useState('All');
  const filteredTasks = useMemo(() => filterRecordsByStatus(tasks, filter), [filter, tasks]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.screenContent}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} />}>
      <TopAppBar
        title="Housekeeping"
        leftIcon={ChevronLeft}
        onLeftPress={onBack}
        rightIcon={Menu}
        onRightPress={onMenu}
      />
      <ErrorNotice message={error} onRetry={onRefresh} />
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
        {filteredTasks.map((task, index) => {
          const status = firstRecordValue(task, ['status', 'stage']);
          const room = firstRecordValue(task, ['room_number', 'room', 'room_name']);
          return (
          <View key={`${room}-${index}`} style={styles.taskCard}>
            <View>
              <Text style={styles.cardTitle}>{room}</Text>
              <Text style={styles.cardSubtitleStrong}>
                {firstRecordValue(task, ['task_name', 'title', 'description'])}
              </Text>
              <Text style={styles.caption}>
                Due: {firstRecordValue(task, ['due_time', 'due_at', 'scheduled_at'])}
              </Text>
            </View>
            <StatusBadge label={status} tone={statusTone(status)} />
          </View>
        );})}
      </View>
      {filteredTasks.length === 0 ? (
        <EmptyState label="No housekeeping tasks returned from API." />
      ) : null}
      <Pressable style={styles.fullPrimaryButton}>
        <QrCode color="#FFFFFF" size={18} strokeWidth={2} />
        <Text style={styles.fullPrimaryButtonText}>Scan Room QR</Text>
      </Pressable>
    </ScrollView>
  );
}

function FoodScreen({
  error,
  loading,
  orders,
  onBack,
  onMenu,
  onRefresh,
}: {
  error: string | null;
  loading: boolean;
  orders: ArcadiaRecord[];
  onBack: () => void;
  onMenu: () => void;
  onRefresh: () => void;
}) {
  const [filter, setFilter] = useState('All');
  const [tab, setTab] = useState('Orders');
  const filteredOrders = useMemo(
    () => filterRecordsByStatus(orders, filter),
    [filter, orders],
  );

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.screenContentWithCart}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} />}>
        <TopAppBar
          title="F&B"
          leftIcon={ChevronLeft}
          onLeftPress={onBack}
          rightIcon={Menu}
          onRightPress={onMenu}
        />
        <ErrorNotice message={error} onRetry={onRefresh} />
        <SearchBox placeholder="Search order, guest, room..." />
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
            {tab === 'Orders' ? filteredOrders.map((order, index) => (
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
            {tab === 'Orders' && filteredOrders.length === 0 ? (
              <EmptyState label="No F&B orders returned from API." />
            ) : null}
          </View>
        </View>
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
  orders,
  onBack,
  onMenu,
  onRefresh,
}: {
  error: string | null;
  loading: boolean;
  orders: ArcadiaRecord[];
  onBack: () => void;
  onMenu: () => void;
  onRefresh: () => void;
}) {
  const [filter, setFilter] = useState('Received');
  const filteredOrders = useMemo(
    () => filterRecordsByStatus(orders, filter),
    [filter, orders],
  );

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.screenContent}
      data={filteredOrders}
      keyExtractor={(item, index) =>
        `${firstRecordValue(item, ['id', 'order_number'])}-${index}`
      }
      refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} />}
      ListHeaderComponent={
        <View>
          <TopAppBar
            title="Kitchen"
            leftIcon={ChevronLeft}
            onLeftPress={onBack}
            rightIcon={Menu}
            onRightPress={onMenu}
          />
          <ErrorNotice message={error} onRetry={onRefresh} />
          <ChipRow
            labels={['Received', 'Preparing', 'Ready', 'Delivered', 'Cancelled']}
            activeLabel={filter}
            onSelect={setFilter}
          />
        </View>
      }
      ListEmptyComponent={<EmptyState label="No kitchen orders returned from API." />}
      renderItem={({item}) => {
        const status = firstRecordValue(item, ['status']);
        return (
          <View style={styles.kitchenOrderCard}>
            <View style={styles.rowBetween}>
              <Text style={styles.ticketCode}>
                {firstRecordValue(item, ['order_number', 'id'])}
              </Text>
              <StatusBadge label={status} tone={statusTone(status)} />
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
  onBack,
  onMenu,
  onOpenChat,
  onRefresh,
}: {
  conversations: ArcadiaRecord[];
  error: string | null;
  loading: boolean;
  onBack: () => void;
  onMenu: () => void;
  onOpenChat: (conversation: ArcadiaRecord) => void;
  onRefresh: () => void;
}) {
  const [filter, setFilter] = useState('All');
  const filteredConversations = useMemo(
    () => filterRecordsByStatus(conversations, filter),
    [conversations, filter],
  );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.screenContent}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} />}>
      <TopAppBar
        title="WhatsApp"
        leftIcon={ChevronLeft}
        onLeftPress={onBack}
        rightIcon={Menu}
        onRightPress={onMenu}
      />
      <ErrorNotice message={error} onRetry={onRefresh} />
      <SearchBox placeholder="Search conversations..." />
      <ChipRow
        labels={['All', 'Open', 'Pending', 'Resolved']}
        activeLabel={filter}
        onSelect={setFilter}
      />
      <View style={styles.cardStack}>
        {filteredConversations.map((conversation, index) => {
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
            </View>
          </Pressable>
        );})}
      </View>
      {filteredConversations.length === 0 ? (
        <EmptyState label="No WhatsApp conversations returned from API." />
      ) : null}
    </ScrollView>
  );
}

function StaffScreen({
  error,
  loading,
  staff,
  onBack,
  onMenu,
  onOpenStaffProfile,
  onRefresh,
}: {
  error: string | null;
  loading: boolean;
  staff: ArcadiaRecord[];
  onBack: () => void;
  onMenu: () => void;
  onOpenStaffProfile: (staff: ArcadiaRecord) => void;
  onRefresh: () => void;
}) {
  const [filter, setFilter] = useState('All');
  const filteredStaff = useMemo(() => {
    if (filter === 'All') {
      return staff;
    }
    if (filter === 'On Duty') {
      return staff.filter(item => isRecordTruthy(item, ['is_on_duty']));
    }
    if (filter === 'Off Duty') {
      return staff.filter(
        item =>
          isRecordTruthy(item, ['is_active']) &&
          !isRecordTruthy(item, ['is_on_duty']),
      );
    }
    if (filter === 'Active') {
      return staff.filter(item => isRecordTruthy(item, ['is_active']));
    }
    if (filter === 'Inactive') {
      return staff.filter(item => !isRecordTruthy(item, ['is_active']));
    }
    return filterRecordsByStatus(staff, filter);
  }, [filter, staff]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.screenContent}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} />}>
      <TopAppBar
        title="Staff Portal"
        leftIcon={ChevronLeft}
        onLeftPress={onBack}
        rightIcon={Menu}
        onRightPress={onMenu}
      />
      <ErrorNotice message={error} onRetry={onRefresh} />
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
      <SectionTitle title="Today's Attendance" action="View Roster" />
      <View style={styles.cardStack}>
        {filteredStaff.map((member, index) => {
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
            <StatusBadge label={status} tone={statusTone(status)} />
          </Pressable>
        );})}
      </View>
      {filteredStaff.length === 0 ? (
        <EmptyState label="No staff records returned from API." />
      ) : null}
      <View style={styles.actionGrid}>
        <RoomAction icon={User} label="Directory" onPress={onRefresh} />
        <RoomAction icon={LogOut} label="Duty Status" onPress={onRefresh} />
        <RoomAction icon={CalendarDays} label="Shift Plan" onPress={onRefresh} />
      </View>
    </ScrollView>
  );
}

function AssistantScreen({
  data,
  onBack,
  onMenu,
}: {
  data: AppData;
  onBack: () => void;
  onMenu: () => void;
}) {
  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.chatContent}>
        <TopAppBar
          title="AI Assistant"
          leftIcon={ChevronLeft}
          onLeftPress={onBack}
          rightIcon={Menu}
          onRightPress={onMenu}
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
          <Pressable style={styles.aiReportButton}>
            <Text style={styles.aiReportText}>View Detailed Report</Text>
          </Pressable>
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
  user,
  onBack,
  onLogout,
  onMenu,
  onNavigate,
  onOpenProfileOption,
}: {
  user: UserProfile;
  onBack: () => void;
  onLogout: () => void;
  onMenu: () => void;
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
        secondaryRightIcon={Settings}
        onRightPress={onMenu}
      />
      <View style={styles.profileHeader}>
        <Avatar label="A" size={58} />
        <View>
          <Text style={styles.profileName}>{user.name ?? user.email}</Text>
          <Text style={styles.profileRole}>{user.job_role ?? user.user_type ?? 'User'}</Text>
          <Text style={styles.profileHotel}>{user.hotel_id}</Text>
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
