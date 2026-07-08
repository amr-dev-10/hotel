import {useMemo, useState} from 'react';
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
  Avatar,
  ChipRow,
  EmptyState,
  ErrorNotice,
  LoadingProcessCard,
  MetricTile,
  SearchBox,
  SectionTitle,
  StatusBadge,
  TopAppBar
} from '../../../components/AppComponents';
import type {AppDialogRequest} from '../../../components/AppDialog';
import {
  Bell,
  ChevronLeft,
  Menu,
  MessageCircle,
  QrCode,
  Utensils
} from '../../../components/icons';
import {
  filterRecordsByStatus,
  firstRecordValue,
  filterRecordsBySearch,
  formatAmount,
  isRecordTruthy
} from '../../../utils/dataUtils';
import {blue, styles} from '../../../theme/styles';

import type {ActionHandler, ResourceKey} from '../types';
import {statusTone} from '../utils';

import {formatErrorDetails} from '../../../services/api';
import type {RequestFn} from './screenTypes';
import type {ArcadiaRecord} from '../../../types/domain';
import {
  ListFooter,
  handleScrollLoadMore,
  useScrollPagination
} from './operationScreenHelpers';

export function NotificationsScreen({
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
    <View style={styles.screen}>
      <View style={styles.staticTopAppBar}>
        <TopAppBar
          title="Notifications"
          leftIcon={ChevronLeft}
          onLeftPress={onBack}
          rightIcon={Menu}
          notificationIcon={Bell}
          onRightPress={onMenu}
          onNotificationPress={onOpenNotifications}
        />
      </View>
      <LoadingProcessCard
        active={loading}
        floating
        label="Loading notifications"
        processes={loadingProcesses}
      />
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
    </View>
  );
}

export function HousekeepingScreen({
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
    <View style={styles.screen}>
      <View style={styles.staticTopAppBar}>
        <TopAppBar
          title="Housekeeping"
          leftIcon={ChevronLeft}
          onLeftPress={onBack}
          rightIcon={Menu}
          notificationIcon={Bell}
          onRightPress={onMenu}
          onNotificationPress={onOpenNotifications}
        />
      </View>
      <LoadingProcessCard
        active={loading}
        floating
        label="Loading housekeeping"
        processes={loadingProcesses}
      />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.screenContent}
        onScroll={handleScrollLoadMore(loadMore)}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} />}>
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
    </View>
  );
}

export function FoodScreen({
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
      <View style={styles.staticTopAppBar}>
        <TopAppBar
          title="F&B"
          leftIcon={ChevronLeft}
          onLeftPress={onBack}
          rightIcon={Menu}
          notificationIcon={Bell}
          onRightPress={onMenu}
          onNotificationPress={onOpenNotifications}
        />
      </View>
      <LoadingProcessCard
        active={loading}
        floating
        label="Loading F&B orders"
        processes={loadingProcesses}
      />
      <ScrollView
        contentContainerStyle={styles.screenContentWithCart}
        onScroll={handleScrollLoadMore(loadMore)}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} />}>
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

export function KitchenScreen({
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
    <View style={styles.screen}>
      <View style={styles.staticTopAppBar}>
        <TopAppBar
          title="Kitchen"
          leftIcon={ChevronLeft}
          onLeftPress={onBack}
          rightIcon={Menu}
          notificationIcon={Bell}
          onRightPress={onMenu}
          onNotificationPress={onOpenNotifications}
        />
      </View>
      <LoadingProcessCard
        active={loading}
        floating
        label="Loading kitchen orders"
        processes={loadingProcesses}
      />
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
    </View>
  );
}

export function WhatsAppScreen({
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
    <View style={styles.screen}>
      <View style={styles.staticTopAppBar}>
        <TopAppBar
          title="WhatsApp"
          leftIcon={ChevronLeft}
          onLeftPress={onBack}
          rightIcon={Menu}
          notificationIcon={Bell}
          onRightPress={onMenu}
          onNotificationPress={onOpenNotifications}
        />
      </View>
      <LoadingProcessCard
        active={loading}
        floating
        label="Loading WhatsApp conversations"
        processes={loadingProcesses}
      />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.screenContent}
        onScroll={handleScrollLoadMore(loadMore)}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} />}>
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
    </View>
  );
}

export function StaffScreen({
  error,
  hotelId,
  loading,
  loadingProcesses,
  request,
  staff,
  onBack,
  onMenu,
  onOpenNotifications,
  onOpenStaffProfile,
  onRefresh,
  onRefreshResource,
  onShowDialog,
}: {
  error: string | null;
  hotelId: string;
  loading: boolean;
  loadingProcesses: string[];
  request: RequestFn;
  staff: ArcadiaRecord[];
  onBack: () => void;
  onMenu: () => void;
  onOpenNotifications: () => void;
  onOpenStaffProfile: (staff: ArcadiaRecord) => void;
  onRefresh: () => void;
  onRefreshResource: (resource: ResourceKey) => void;
  onShowDialog: (dialog: AppDialogRequest) => void;
}) {
  const [filter, setFilter] = useState('All');
  const [query, setQuery] = useState('');
  const [deactivatingStaffId, setDeactivatingStaffId] = useState<string | null>(null);
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

  async function deactivateStaff(member: ArcadiaRecord) {
    const staffId = firstRecordValue(member, ['id', 'user_id']);
    if (!staffId) {
      onShowDialog({
        message: 'The selected staff record is missing an id.',
        title: 'Deactivate failed',
        tone: 'error',
      });
      return;
    }

    setDeactivatingStaffId(staffId);
    try {
      await request<ArcadiaRecord>(
        `/api/v1/hotels/${hotelId}/users/${staffId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({is_active: false, is_on_duty: false}),
        },
      );
      onRefreshResource('staff');
      onShowDialog({
        message: `${firstRecordValue(member, ['name', 'full_name', 'email']) || 'Staff'} was deactivated.`,
        title: 'Staff updated',
        tone: 'success',
      });
    } catch (nextError) {
      const details = formatErrorDetails(nextError, 'Staff deactivate failed');
      onShowDialog({
        details,
        message: details.split('\n').find(Boolean) || 'The staff record could not be updated.',
        title: 'Staff deactivate failed',
        tone: 'error',
      });
    } finally {
      setDeactivatingStaffId(null);
    }
  }

  function confirmDeactivateStaff(member: ArcadiaRecord) {
    const name = firstRecordValue(member, ['name', 'full_name', 'email']) || 'this staff member';
    onShowDialog({
      actions: [
        {label: 'Cancel', tone: 'secondary'},
        {label: 'Deactivate', onPress: () => deactivateStaff(member)},
      ],
      message: `${name} will be marked inactive and off duty.`,
      title: 'Deactivate staff?',
      tone: 'info',
    });
  }

  return (
    <View style={styles.screen}>
      <View style={styles.staticTopAppBar}>
        <TopAppBar
          title="Staff Portal"
          leftIcon={ChevronLeft}
          onLeftPress={onBack}
          rightIcon={Menu}
          notificationIcon={Bell}
          onRightPress={onMenu}
          onNotificationPress={onOpenNotifications}
        />
      </View>
      <LoadingProcessCard
        active={loading}
        floating
        label="Loading staff"
        processes={loadingProcesses}
      />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.screenContent}
        onScroll={handleScrollLoadMore(loadMore)}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} />}>
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
            const staffId = firstRecordValue(member, ['id', 'user_id']);
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
                    ...(active
                      ? [
                          {
                            label:
                              deactivatingStaffId === staffId
                                ? 'Deactivating...'
                                : 'Deactivate',
                            tone: 'danger' as const,
                            onPress: () => confirmDeactivateStaff(member),
                          },
                        ]
                      : []),
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
    </View>
  );
}
