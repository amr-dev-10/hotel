import {useEffect, useMemo, useState} from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View
} from 'react-native';

import {
  ActionMenu,
  ChipRow,
  EmptyState,
  ErrorNotice,
  InfoLine,
  LoadingProcessCard,
  MetricTile,
  SearchBox,
  StatusBadge,
  TicketCard,
  TopAppBar
} from '../../../components/AppComponents';

import {
  Bell,
  ChevronLeft,
  Filter,
  Hotel,
  Menu,
  Plus,
  Ticket
} from '../../../components/icons';
import {
  filterByStatus,
  firstRecordValue,
  filterRecordsBySearch
} from '../../../utils/dataUtils';
import {blue, styles} from '../../../theme/styles';
import type {ScreenAction} from '../../../navigation/types';
import type {TicketView} from '../../dashboard';
import type {ActionHandler} from '../types';
import {priorityTone, statusTone} from '../utils';

import type {ArcadiaRecord, UserProfile} from '../../../types/domain';
import {
  canViewAllEscalations,
  defaultEscalationScope,
  escalationMatchesStatus,
  escalationMetrics,
  escalationScopeLabels,
  escalationScopeOptions,
  escalationSearchBlob,
  escalationToTicketView,
  formatEscalationAge,
  titleCase,
  useEscalations,
  type EscalatedTicket,
  type EscalationScope
} from '../../escalation';
import {
  ListFooter,
  isTicketAssignedToUser,
  useScrollPagination
} from './operationScreenHelpers';
import type {RequestFn} from './screenTypes';

export function RoomScreen({
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

export function TicketsScreen({
  error,
  loading,
  loadingProcesses,
  tickets,
  user,
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
  user: UserProfile;
  onBack: () => void;
  onCreateTicket: () => void;
  onOpenTicket: (ticket: TicketView) => void;
  onOpenNotifications: () => void;
  onQuickRecordAction: ActionHandler;
  onRefresh: () => void;
}) {
  const [filter, setFilter] = useState('All');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [smartFilter, setSmartFilter] = useState<'assigned' | 'all'>('assigned');
  const [query, setQuery] = useState('');
  const smartFilteredTickets = useMemo(
    () =>
      smartFilter === 'all'
        ? tickets
        : tickets.filter(ticket => isTicketAssignedToUser(ticket, user.id)),
    [smartFilter, tickets, user.id],
  );
  const filteredTickets = useMemo(
    () => filterRecordsBySearch(filterByStatus(smartFilteredTickets, filter), query),
    [filter, query, smartFilteredTickets],
  );
  const {hasMore, loadMore, visibleItems} = useScrollPagination(filteredTickets);
  const smartFilterLabel = smartFilter === 'assigned' ? 'Assigned to me' : 'All Tickets';

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
          <ChipRow
            labels={['Assigned to me', 'All Tickets']}
            activeLabel={smartFilterLabel}
            onSelect={label => setSmartFilter(label === 'All Tickets' ? 'all' : 'assigned')}
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
      ListEmptyComponent={
        loading ? null : (
          <EmptyState
            label={
              smartFilter === 'assigned'
                ? 'No tickets are assigned to you. Switch to All Tickets to see the full queue.'
                : 'No tickets returned from API.'
            }
          />
        )
      }
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

export function EscalationsScreen({
  error,
  escalations,
  hotelId,
  loading,
  loadingProcesses,
  onBack,
  onMenu,
  onOpenTicket,
  onOpenNotifications,
  onQuickRecordAction,
  onRefresh,
  request,
  user,
}: {
  error: string | null;
  escalations: ArcadiaRecord[];
  hotelId: string;
  loading: boolean;
  loadingProcesses: string[];
  onBack: () => void;
  onMenu: () => void;
  onOpenTicket: (ticket: TicketView) => void;
  onOpenNotifications: () => void;
  onQuickRecordAction: ActionHandler;
  onRefresh: () => void;
  request: RequestFn;
  user: UserProfile;
}) {
  const [scope, setScope] = useState<EscalationScope>(() =>
    defaultEscalationScope(user),
  );
  const [filter, setFilter] = useState('All');
  const [query, setQuery] = useState('');
  const scopeOptions = useMemo(() => escalationScopeOptions(user), [user]);
  const scopeLabels = useMemo(
    () => scopeOptions.map(option => escalationScopeLabels[option]),
    [scopeOptions],
  );
  const {
    error: scopedError,
    loading: scopedLoading,
    refresh,
    rows,
  } = useEscalations({
    hotelId,
    initialRows: escalations,
    request,
    scope,
  });
  const metrics = useMemo(() => escalationMetrics(rows), [rows]);
  const filteredEscalations = useMemo(
    () =>
      rows.filter(item => {
        const matchesStatus = escalationMatchesStatus(item, filter);
        const matchesSearch =
          !query.trim() ||
          escalationSearchBlob(item).includes(query.trim().toLowerCase());
        return matchesStatus && matchesSearch;
      }),
    [filter, query, rows],
  );
  const {hasMore, loadMore, visibleItems} = useScrollPagination(filteredEscalations);
  const activeLoading = loading || scopedLoading;
  const activeError = scopedError ?? error;

  useEffect(() => {
    if (canViewAllEscalations(user)) {
      return;
    }
    if (scope === 'all') {
      setScope('department');
    }
  }, [scope, user]);

  async function handleRefresh() {
    await refresh();
    onRefresh();
  }

  function selectScope(label: string) {
    const nextScope = scopeOptions.find(option => escalationScopeLabels[option] === label);
    if (nextScope) {
      setScope(nextScope);
    }
  }

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.screenContent}
      data={visibleItems}
      keyExtractor={(item, index) =>
        `${item.escalation_id}-${index}`
      }
      onEndReached={loadMore}
      onEndReachedThreshold={0.35}
      refreshControl={<RefreshControl refreshing={activeLoading} onRefresh={handleRefresh} />}
      ListFooterComponent={<ListFooter hasMore={hasMore} loading={activeLoading} />}
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
            active={activeLoading}
            label="Loading escalations"
            processes={loadingProcesses}
          />
          <ErrorNotice message={activeError} onRetry={handleRefresh} />
          <View style={styles.staffSummaryGrid}>
            <MetricTile label="Escalated" value={metrics.total} tone="blue" />
            <MetricTile label="Priority 4+" value={metrics.critical} tone="red" />
            <MetricTile label="Pending" value={metrics.pending} tone="orange" />
          </View>
          <ChipRow
            labels={scopeLabels}
            activeLabel={escalationScopeLabels[scope]}
            onSelect={selectScope}
          />
          <SearchBox
            placeholder="Search escalation, owner, ticket..."
            value={query}
            onChangeText={setQuery}
          />
          <ChipRow
            labels={['All', 'Pending accept', 'Open', 'Resolved', 'Breached']}
            activeLabel={filter}
            onSelect={setFilter}
          />
        </View>
      }
      ListEmptyComponent={
        activeLoading ? null : <EmptyState label="No escalated tickets in this view." />
      }
      renderItem={({item}) => (
        <EscalationCard
          item={item}
          onOpenTicket={() => onOpenTicket(escalationToTicketView(item))}
          onQuickRecordAction={onQuickRecordAction}
        />
      )}
    />
  );
}

function EscalationCard({
  item,
  onOpenTicket,
  onQuickRecordAction,
}: {
  item: EscalatedTicket;
  onOpenTicket: () => void;
  onQuickRecordAction: ActionHandler;
}) {
  const levelLabel =
    item.escalation_level > 0 ? `Level ${item.escalation_level}` : 'Pending accept';
  const levelTone = item.escalation_level >= 3 ? 'red' : 'orange';
  const ticketActionRecord = {
    ...item.ticket.raw,
    id: item.ticket_id || item.ticket.id,
  };

  return (
    <View style={styles.ticketCard}>
      <View style={styles.rowBetween}>
        <Text style={styles.ticketCode}>{item.escalation_id}</Text>
        <View style={styles.ticketCardActions}>
          <StatusBadge label={levelLabel} tone={levelTone} />
          <StatusBadge
            label={`P${item.ticket.priority}`}
            tone={priorityTone(String(item.ticket.priority))}
          />
          <ActionMenu
            items={[
              {label: 'Open Ticket', onPress: onOpenTicket},
              {
                label: 'Acknowledge',
                onPress: () => onQuickRecordAction('escalations', item.raw, 'acknowledge'),
              },
              {
                label: 'Resolve',
                onPress: () => onQuickRecordAction('escalations', item.raw, 'resolve'),
              },
              {
                label: 'Accept Ticket',
                onPress: () => onQuickRecordAction('tickets', ticketActionRecord, 'accept'),
              },
            ]}
          />
        </View>
      </View>
      <View style={styles.popupBadgeRow}>
        <StatusBadge label={titleCase(item.ticket.stage)} tone={statusTone(item.ticket.stage)} />
        <Text style={styles.captionTiny}>{formatEscalationAge(item.escalated_at)}</Text>
      </View>
      <Text style={styles.ticketTitle}>{item.ticket.ticket_code}</Text>
      <Text style={styles.cardSubtitle}>{item.ticket.item_description}</Text>
      <InfoLine label="Reason" value={titleCase(item.reason)} />
      <InfoLine label="Assigned" value={item.ticket.assigned_to_name ?? 'Unassigned'} />
      <InfoLine label="Escalated to" value={item.escalated_to_name ?? 'Unassigned'} />
      <InfoLine
        label="Room"
        value={item.ticket.room_number ? `Room ${item.ticket.room_number}` : 'No room'}
      />
    </View>
  );
}
