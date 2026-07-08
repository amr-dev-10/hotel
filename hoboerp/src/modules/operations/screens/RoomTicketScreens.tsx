import {useEffect, useMemo, useState} from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View
} from 'react-native';

import {
  ActionMenu,
  ChipRow,
  EmptyState,
  ErrorNotice,
  LoadingProcessCard,
  SearchBox,
  StatusBadge,
  TicketCard,
  TopAppBar
} from '../../../components/AppComponents';

import {
  Bell,
  CalendarDays,
  CheckCircle,
  ChevronLeft,
  Filter,
  HelpCircle,
  Hotel,
  Menu,
  Plus,
  Ticket,
  User
} from '../../../components/icons';
import {
  filterByStatus,
  firstRecordValue,
  filterRecordsBySearch
} from '../../../utils/dataUtils';
import {blue, muted, styles} from '../../../theme/styles';
import type {IconComponent, ScreenAction} from '../../../navigation/types';
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
    <View style={styles.screen}>
      <View style={styles.staticTopAppBar}>
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
      </View>
      <LoadingProcessCard
        active={loading}
        floating
        label="Loading rooms"
        processes={loadingProcesses}
      />
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
    </View>
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
    <View style={styles.screen}>
      <View style={styles.staticTopAppBar}>
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
      </View>
      <LoadingProcessCard
        active={loading}
        floating
        label="Loading tickets"
        processes={loadingProcesses}
      />
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
    </View>
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
  const [filter, setFilter] = useState('Unassigned');
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
      rows
        .filter(item => {
          const matchesStatus = escalationMatchesStatus(item, filter);
          const matchesSearch =
            !query.trim() ||
            escalationSearchBlob(item).includes(query.trim().toLowerCase());
          return matchesStatus && matchesSearch;
        })
        .sort(
          (left, right) =>
            escalationTimestamp(right.escalated_at) -
            escalationTimestamp(left.escalated_at),
        ),
    [filter, query, rows],
  );
  const {hasMore, loadMore, visibleItems} = useScrollPagination(filteredEscalations);
  const activeLoading = loading || scopedLoading;
  const activeError = scopedError ?? error;
  const visibleLoadingProcesses = useMemo(
    () =>
      loading
        ? loadingProcesses.filter(process => {
            const normalizedProcess = process.trim().toLowerCase();
            return (
              normalizedProcess !== 'loading escalation' &&
              normalizedProcess !== 'loading escalations'
            );
          })
        : [],
    [loading, loadingProcesses],
  );

  useEffect(() => {
    if (canViewAllEscalations(user)) {
      return;
    }
    if (scope === 'all') {
      setScope('department');
    }
  }, [scope, user]);

  async function handleRefresh() {
    onRefresh();
    await refresh();
  }

  function selectScope(label: string) {
    const nextScope = scopeOptions.find(option => escalationScopeLabels[option] === label);
    if (nextScope) {
      setScope(nextScope);
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.staticTopAppBar}>
        <TopAppBar
          title="Escalations"
          leftIcon={ChevronLeft}
          onLeftPress={onBack}
          rightIcon={Menu}
          notificationIcon={Bell}
          onRightPress={onMenu}
          onNotificationPress={onOpenNotifications}
        />
      </View>
      <LoadingProcessCard
        active={activeLoading}
        floating
        label="Loading escalations"
        processes={visibleLoadingProcesses}
      />
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
          <ErrorNotice message={activeError} onRetry={handleRefresh} />
          <View style={styles.escalationMetricGrid}>
            <EscalationMetricTile
              label="Escalation"
              value={metrics.total}
              tone="blue"
            />
            <EscalationMetricTile
              label="Priority +"
              value={metrics.critical}
              tone="red"
            />
            <EscalationMetricTile
              label="Pending"
              value={metrics.pending}
              tone="orange"
            />
          </View>
          <EscalationScopeTabs
            labels={scopeLabels}
            activeLabel={escalationScopeLabels[scope]}
            onSelect={selectScope}
          />
          <SearchBox
            placeholder="Search escalation, owner, ticket..."
            value={query}
            onChangeText={setQuery}
          />
          <EscalationStatusFilters
            labels={['Unassigned', 'All', 'Pending Accept', 'Open', 'Resolved', 'Backlog']}
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
    </View>
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
  const stageLabel = titleCase(item.ticket.stage);
  const assigneeName = item.ticket.assigned_to_name ?? 'Unassigned';
  const roomLabel = item.ticket.room_number ? `Room ${item.ticket.room_number}` : 'No room';
  const ticketActionRecord = {
    ...item.ticket.raw,
    id: item.ticket_id || item.ticket.id,
  };

  return (
    <View style={styles.escalationCard}>
      <View style={styles.escalationCardAccent} />
      <View style={styles.escalationCardHeader}>
        <View style={styles.escalationTicketIcon}>
          <CalendarDays color={blue} size={18} strokeWidth={2.2} />
        </View>
        <View style={styles.escalationCardTitleBlock}>
          <Text numberOfLines={1} style={styles.escalationTicketCode}>
            {item.ticket.ticket_code}
          </Text>
          <Text numberOfLines={1} style={styles.escalationTicketId}>
            {compactEscalationId(item.escalation_id)}
          </Text>
        </View>
        <View style={styles.escalationBadgeStack}>
          <StatusBadge label={stageLabel} tone={statusTone(item.ticket.stage)} />
          <StatusBadge
            label={`P${item.ticket.priority}`}
            tone={priorityTone(String(item.ticket.priority))}
          />
        </View>
        <ActionMenu
          items={[
            {label: 'Open Ticket', onPress: onOpenTicket},
            {
              label: 'Accept Ticket',
              onPress: () => onQuickRecordAction('tickets', ticketActionRecord, 'accept'),
            },
            {
              label: 'Reject Ticket',
              tone: 'danger',
              onPress: () => onQuickRecordAction('tickets', ticketActionRecord, 'reject'),
            },
            {
              label: 'Complete Ticket',
              onPress: () => onQuickRecordAction('tickets', ticketActionRecord, 'complete'),
            },
            {
              label: 'Approve Ticket',
              onPress: () => onQuickRecordAction('tickets', ticketActionRecord, 'approve'),
            },
            {
              label: 'Reopen Ticket',
              onPress: () => onQuickRecordAction('tickets', ticketActionRecord, 'reopen'),
            },
            {
              label: 'Delete Ticket',
              tone: 'danger',
              onPress: () => onQuickRecordAction('tickets', ticketActionRecord, 'delete'),
            },
          ]}
        />
      </View>
      <Text style={styles.escalationTitle}>{item.ticket.item_description}</Text>
      <View style={styles.escalationMetaRow}>
        <CalendarDays color={muted} size={15} strokeWidth={2} />
        <Text numberOfLines={1} style={styles.escalationMetaText}>
          {roomLabel}  -  {assigneeName}
        </Text>
      </View>
      <View style={styles.escalationActionRow}>
        <Pressable
          style={styles.escalationAcceptButton}
          onPress={() => onQuickRecordAction('tickets', ticketActionRecord, 'accept')}>
          <CheckCircle color="#FFFFFF" size={18} strokeWidth={2.1} />
          <Text style={styles.escalationAcceptText}>Accept</Text>
        </Pressable>
        <Pressable style={styles.escalationOpenButton} onPress={onOpenTicket}>
          <Ticket color={blue} size={18} strokeWidth={2.1} />
          <Text style={styles.escalationOpenText}>Open Ticket</Text>
        </Pressable>
      </View>
      <View style={styles.escalationDetailPanel}>
        <EscalationDetailRow
          icon={HelpCircle}
          label="Reason"
          value={levelLabel === 'Pending accept' ? 'Pending Acceptance' : titleCase(item.reason)}
        />
        <EscalationDetailRow
          icon={User}
          label="Assigned"
          value={assigneeName}
        />
        <EscalationDetailRow
          icon={Ticket}
          label="Escalated to"
          value={item.escalated_to_name ?? 'Unassigned'}
          isLast
        />
      </View>
    </View>
  );
}

function EscalationMetricTile({
  label,
  tone,
  value,
}: {
  label: string;
  tone: 'blue' | 'orange' | 'red';
  value: number;
}) {
  return (
    <View style={styles.escalationMetricTile}>
      <Text style={[styles.escalationMetricValue, escalationMetricTextStyle(tone)]}>
        {value}
      </Text>
      <Text numberOfLines={1} style={styles.escalationMetricLabel}>
        {label}
      </Text>
      <View style={[styles.escalationMetricBar, escalationMetricBarStyle(tone)]} />
    </View>
  );
}

function EscalationScopeTabs({
  activeLabel,
  labels,
  onSelect,
}: {
  activeLabel: string;
  labels: string[];
  onSelect: (label: string) => void;
}) {
  return (
    <View style={styles.escalationScopeTabs}>
      {labels.map(label => {
        const active = label === activeLabel;
        return (
          <Pressable
            key={label}
            style={[styles.escalationScopeTab, active && styles.escalationScopeTabActive]}
            onPress={() => onSelect(label)}>
            <Text
              numberOfLines={1}
              style={[
                styles.escalationScopeTabText,
                active && styles.escalationScopeTabTextActive,
              ]}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function EscalationStatusFilters({
  activeLabel,
  labels,
  onSelect,
}: {
  activeLabel: string;
  labels: string[];
  onSelect: (label: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.escalationFilterRow}>
      {labels.map(label => {
        const active = label === activeLabel;
        return (
          <Pressable
            key={label}
            style={[styles.escalationFilterPill, active && styles.escalationFilterPillActive]}
            onPress={() => onSelect(label)}>
            <Text
              numberOfLines={1}
              style={[
                styles.escalationFilterPillText,
                active && styles.escalationFilterPillTextActive,
              ]}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function EscalationDetailRow({
  icon: Icon,
  isLast,
  label,
  value,
}: {
  icon: IconComponent;
  isLast?: boolean;
  label: string;
  value: string;
}) {
  return (
    <View style={[styles.escalationDetailRow, isLast && styles.escalationDetailRowLast]}>
      <View style={styles.escalationDetailIcon}>
        <Icon color="#64748B" size={16} strokeWidth={2.1} />
      </View>
      <Text style={styles.escalationDetailLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.escalationDetailValue}>
        {value}
      </Text>
    </View>
  );
}

function compactEscalationId(value: string) {
  if (value.length <= 32) {
    return value;
  }
  return `${value.slice(0, 8)}-${value.slice(9, 13)}-${value.slice(14, 18)}...`;
}

function escalationTimestamp(value: string) {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function escalationMetricTextStyle(tone: 'blue' | 'orange' | 'red') {
  return {
    blue: styles.blueText,
    orange: styles.orangeText,
    red: styles.redText,
  }[tone];
}

function escalationMetricBarStyle(tone: 'blue' | 'orange' | 'red') {
  return {
    blue: styles.escalationMetricBarBlue,
    orange: styles.escalationMetricBarOrange,
    red: styles.escalationMetricBarRed,
  }[tone];
}
