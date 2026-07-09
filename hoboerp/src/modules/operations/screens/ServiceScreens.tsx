import {type ReactNode, useCallback, useEffect, useMemo, useState} from 'react';
import {
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View
} from 'react-native';

import {
  ActionMenu,
  Avatar,
  ChipRow,
  EmptyState,
  ErrorNotice,
  InfoLine,
  LoadingProcessCard,
  MetricTile,
  SearchBox,
  SectionTitle,
  StatusBadge,
  TopAppBar
} from '../../../components/AppComponents';
import type {AppDialogRequest} from '../../../components/AppDialog';
import {
  AlertCircle,
  Bell,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Menu,
  MessageCircle,
  Plus,
  User,
  Utensils
} from '../../../components/icons';
import {
  filterRecordsByStatus,
  firstRecordValue,
  filterRecordsBySearch,
  isRecordTruthy
} from '../../../utils/dataUtils';
import {blue, styles} from '../../../theme/styles';

import type {ActionHandler, ResourceKey} from '../types';
import {priorityTone, statusTone} from '../utils';

import {formatErrorDetails} from '../../../services/api';
import type {RequestFn} from './screenTypes';
import type {ArcadiaRecord} from '../../../types/domain';
import type {ReservationView} from '../../dashboard';
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

type HousekeepingTaskFormState = {
  assignedTo: string;
  notes: string;
  priority: string;
  roomId: string;
  scheduledDate: string;
  scheduledTime: string;
  status: string;
  taskId?: string;
  taskType: string;
};

type HousekeepingTaskContext = {
  assignedLabel: string;
  notes: string;
  priority: string;
  roomLabel: string;
  scheduleLabel: string;
  status: string;
  statusLabel: string;
  taskLabel: string;
};

const housekeepingStatusOptions = [
  {label: 'Pending', value: 'pending'},
  {label: 'Assigned', value: 'assigned'},
  {label: 'In Progress', value: 'in_progress'},
  {label: 'Completed', value: 'completed'},
  {label: 'Blocked', value: 'blocked'},
];

const housekeepingTaskTypeOptions = [
  {label: 'Daily clean', value: 'daily_clean'},
  {label: 'Deep clean', value: 'deep_clean'},
  {label: 'Turnover', value: 'turnover'},
  {label: 'Inspection', value: 'inspection'},
  {label: 'Checkout clean', value: 'checkout_clean'},
  {label: 'Occupied clean', value: 'occupied_clean'},
];

const housekeepingPriorityOptions = ['1', '2', '3', '4', '5'];

function todayInputDate() {
  return new Date().toISOString().slice(0, 10);
}

function defaultHousekeepingForm(): HousekeepingTaskFormState {
  return {
    assignedTo: '',
    notes: '',
    priority: '2',
    roomId: '',
    scheduledDate: todayInputDate(),
    scheduledTime: '',
    status: 'pending',
    taskType: 'daily_clean',
  };
}

function formFromHousekeepingTask(task: ArcadiaRecord): HousekeepingTaskFormState {
  return {
    assignedTo: firstRecordValue(task, ['assigned_to', 'assigned_to_id']),
    notes: firstRecordValue(task, ['notes']),
    priority: firstRecordValue(task, ['priority']) || '2',
    roomId: firstRecordValue(task, ['room_id']),
    scheduledDate: firstRecordValue(task, ['scheduled_date']) || todayInputDate(),
    scheduledTime: firstRecordValue(task, ['scheduled_time']) || '',
    status: firstRecordValue(task, ['status']) || 'pending',
    taskId: firstRecordValue(task, ['id']),
    taskType: firstRecordValue(task, ['task_type']) || 'daily_clean',
  };
}

function housekeepingTitle(value: string) {
  return value
    .replaceAll('_', ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function housekeepingLookup(
  records: ArcadiaRecord[],
  id: string,
  keys = ['id'],
) {
  if (!id) {
    return null;
  }
  return records.find(record => keys.some(key => firstRecordValue(record, [key]) === id)) ?? null;
}

function housekeepingRoomLabel(room: ArcadiaRecord | null, fallbackId = '') {
  const number = firstRecordValue(room, ['room_number', 'name', 'number']);
  if (number) {
    return `Room ${number}`;
  }
  return fallbackId ? `Room ${fallbackId}` : 'Unassigned room';
}

function housekeepingStaffLabel(staff: ArcadiaRecord | null, fallbackId = '') {
  return (
    firstRecordValue(staff, ['name', 'full_name', 'email', 'phone']) ||
    (fallbackId ? `Staff ${fallbackId}` : 'Unassigned')
  );
}

function formatHousekeepingDate(value: string) {
  if (!value) {
    return '';
  }
  return value.includes('T') ? value.replace('T', ' ').slice(0, 16) : value;
}

function housekeepingTaskContext(
  task: ArcadiaRecord,
  rooms: ArcadiaRecord[],
  staff: ArcadiaRecord[],
): HousekeepingTaskContext {
  const roomId = firstRecordValue(task, ['room_id']);
  const assignedTo = firstRecordValue(task, ['assigned_to', 'assigned_to_id']);
  const room = housekeepingLookup(rooms, roomId, ['id', 'room_id']);
  const assignee = housekeepingLookup(staff, assignedTo, ['id', 'user_id']);
  const status = firstRecordValue(task, ['status', 'stage']) || 'pending';
  const scheduledDate = firstRecordValue(task, ['scheduled_date', 'due_date']);
  const scheduledTime = firstRecordValue(task, ['scheduled_time', 'due_time']);
  return {
    assignedLabel: housekeepingStaffLabel(assignee, assignedTo),
    notes: firstRecordValue(task, ['notes', 'description']),
    priority: firstRecordValue(task, ['priority']) || '2',
    roomLabel:
      firstRecordValue(task, ['room_number', 'room', 'room_name']) ||
      housekeepingRoomLabel(room, roomId),
    scheduleLabel:
      [formatHousekeepingDate(scheduledDate), scheduledTime].filter(Boolean).join(' ') ||
      'No schedule',
    status,
    statusLabel: housekeepingTitle(status),
    taskLabel:
      firstRecordValue(task, ['task_name', 'title']) ||
      housekeepingTitle(firstRecordValue(task, ['task_type']) || 'daily_clean'),
  };
}

function housekeepingStatusTone(
  status: string,
): 'green' | 'blue' | 'orange' | 'red' | 'gray' {
  const normalized = status.toLowerCase();
  if (normalized === 'completed') {
    return 'green';
  }
  if (normalized === 'in_progress') {
    return 'blue';
  }
  if (normalized === 'blocked') {
    return 'red';
  }
  if (normalized === 'assigned') {
    return 'gray';
  }
  return 'orange';
}

function housekeepingReport(tasks: ArcadiaRecord[], rooms: ArcadiaRecord[]) {
  const today = todayInputDate();
  return {
    blocked: tasks.filter(task => firstRecordValue(task, ['status']) === 'blocked').length,
    cleaningRooms: rooms.filter(room =>
      ['cleaning', 'dirty', 'checkout'].some(status =>
        firstRecordValue(room, ['status']).toLowerCase().includes(status),
      ),
    ).length,
    completed: tasks.filter(task => firstRecordValue(task, ['status']) === 'completed').length,
    open: tasks.filter(task => firstRecordValue(task, ['status']) !== 'completed').length,
    today: tasks.filter(task => firstRecordValue(task, ['scheduled_date']) === today).length,
  };
}

function housekeepingChecklistForTask(
  task: ArcadiaRecord,
  checklists: ArcadiaRecord[],
) {
  const taskType = firstRecordValue(task, ['task_type']);
  const checklist = checklists.find(item => firstRecordValue(item, ['task_type']) === taskType);
  const items = checklist?.items;
  return Array.isArray(items) ? items : [];
}

function housekeepingChecklistText(item: unknown) {
  if (typeof item === 'string') {
    return item;
  }
  if (item && typeof item === 'object') {
    const record = item as ArcadiaRecord;
    return (
      firstRecordValue(record, ['label', 'name', 'title', 'description']) ||
      JSON.stringify(record)
    );
  }
  return String(item ?? '');
}

function HousekeepingStatusButton({
  label,
  tone,
  onPress,
}: {
  label: string;
  tone: 'blue' | 'green' | 'orange' | 'red';
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[
        styles.housekeepingStatusButton,
        tone === 'blue' && styles.housekeepingStatusButtonBlue,
        tone === 'green' && styles.housekeepingStatusButtonGreen,
        tone === 'orange' && styles.housekeepingStatusButtonOrange,
        tone === 'red' && styles.housekeepingStatusButtonRed,
      ]}
      onPress={onPress}>
      <Text style={styles.housekeepingStatusButtonText}>{label}</Text>
    </Pressable>
  );
}

export function HousekeepingScreen({
  error,
  hotelId,
  loading,
  loadingProcesses,
  request,
  rooms,
  staff,
  tasks,
  onBack,
  onMenu,
  onOpenNotifications,
  onRefresh,
  onShowDialog,
}: {
  error: string | null;
  hotelId: string;
  loading: boolean;
  loadingProcesses: string[];
  request: RequestFn;
  rooms: ArcadiaRecord[];
  staff: ArcadiaRecord[];
  tasks: ArcadiaRecord[];
  onBack: () => void;
  onMenu: () => void;
  onOpenNotifications: () => void;
  onRefresh: () => void;
  onShowDialog: (dialog: AppDialogRequest) => void;
}) {
  const [filter, setFilter] = useState('All');
  const [query, setQuery] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [checklists, setChecklists] = useState<ArcadiaRecord[]>([]);
  const [formVisible, setFormVisible] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [form, setForm] = useState<HousekeepingTaskFormState>(() =>
    defaultHousekeepingForm(),
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const decoratedTasks = useMemo(
    () =>
      tasks.map(task => {
        const context = housekeepingTaskContext(task, rooms, staff);
        return {
          ...task,
          housekeeping_assigned_label: context.assignedLabel,
          housekeeping_date_label: context.scheduleLabel,
          housekeeping_room_label: context.roomLabel,
          housekeeping_task_label: context.taskLabel,
        };
      }),
    [rooms, staff, tasks],
  );
  const filteredTasks = useMemo(() => {
    const filteredByStatus =
      filter === 'Today'
        ? decoratedTasks.filter(
            task => firstRecordValue(task, ['scheduled_date']) === todayInputDate(),
          )
        : filterRecordsByStatus(decoratedTasks, filter);
    return filterRecordsBySearch(filteredByStatus, query);
  }, [decoratedTasks, filter, query]);
  const activeTask = useMemo(
    () =>
      selectedTaskId
        ? decoratedTasks.find(task => firstRecordValue(task, ['id']) === selectedTaskId) ??
          null
        : null,
    [decoratedTasks, selectedTaskId],
  );
  const {hasMore, loadMore, visibleItems} = useScrollPagination(filteredTasks);
  const report = useMemo(() => housekeepingReport(tasks, rooms), [rooms, tasks]);

  const loadChecklists = useCallback(async () => {
    try {
      const payload = await request<ArcadiaRecord[]>(
        `/api/v1/hotels/${hotelId}/housekeeping/checklists`,
      );
      setChecklists(Array.isArray(payload.data) ? payload.data : []);
    } catch {
      setChecklists([]);
    }
  }, [hotelId, request]);

  useEffect(() => {
    loadChecklists();
  }, [loadChecklists]);

  function openCreateTask() {
    setFormMode('create');
    setForm(defaultHousekeepingForm());
    setFormError(null);
    setFormVisible(true);
  }

  function openEditTask(task: ArcadiaRecord) {
    setSelectedTaskId(firstRecordValue(task, ['id']));
    setFormMode('edit');
    setForm(formFromHousekeepingTask(task));
    setFormError(null);
    setFormVisible(true);
  }

  async function submitTaskForm() {
    const roomId = form.roomId.trim();
    const date = form.scheduledDate.trim();
    const priority = Number(form.priority || 2);
    if (formMode === 'create' && !roomId) {
      setFormError('Choose a room for this task.');
      return;
    }
    if (!date) {
      setFormError('Enter a scheduled date.');
      return;
    }
    if (Number.isNaN(priority) || priority < 1 || priority > 5) {
      setFormError('Priority must be between 1 and 5.');
      return;
    }

    const taskId = form.taskId;
    if (formMode === 'edit' && !taskId) {
      setFormError('This task is missing an id.');
      return;
    }

    setSubmitting(true);
    setFormError(null);
    setActionError(null);
    try {
      const body = compactPayload({
        assigned_to: form.assignedTo.trim() || undefined,
        notes: form.notes.trim() || undefined,
        priority,
        room_id: formMode === 'create' ? roomId : undefined,
        scheduled_date: date,
        scheduled_time: form.scheduledTime.trim() || undefined,
        status: form.status.trim() || 'pending',
        task_type: form.taskType.trim() || 'daily_clean',
      });
      const payload = await request<ArcadiaRecord>(
        formMode === 'create'
          ? `/api/v1/hotels/${hotelId}/housekeeping`
          : `/api/v1/hotels/${hotelId}/housekeeping/${taskId}`,
        {
          method: formMode === 'create' ? 'POST' : 'PUT',
          body: JSON.stringify(body),
        },
      );
      const savedTaskId = firstRecordValue(payload.data, ['id']) || taskId;
      if (savedTaskId) {
        setSelectedTaskId(savedTaskId);
      }
      setFormVisible(false);
      onRefresh();
      onShowDialog({
        message:
          formMode === 'create'
            ? 'Housekeeping task has been created.'
            : 'Housekeeping task has been updated.',
        title: formMode === 'create' ? 'Task created' : 'Task updated',
        tone: 'success',
      });
    } catch (nextError) {
      setFormError(formatErrorDetails(nextError, 'Unable to save housekeeping task.'));
    } finally {
      setSubmitting(false);
    }
  }

  async function updateTaskStatus(task: ArcadiaRecord, status: string) {
    const taskId = firstRecordValue(task, ['id']);
    if (!taskId) {
      setActionError('This task is missing an id.');
      return;
    }
    setSubmitting(true);
    setActionError(null);
    try {
      await request<ArcadiaRecord>(
        `/api/v1/hotels/${hotelId}/housekeeping/${taskId}`,
        {
          method: 'PUT',
          body: JSON.stringify({status}),
        },
      );
      setSelectedTaskId(taskId);
      onRefresh();
    } catch (nextError) {
      setActionError(formatErrorDetails(nextError, 'Unable to update task status.'));
    } finally {
      setSubmitting(false);
    }
  }

  const formSheet = (
    <HousekeepingTaskFormSheet
      error={formError}
      form={form}
      mode={formMode}
      rooms={rooms}
      staff={staff}
      submitting={submitting}
      visible={formVisible}
      onChange={next => setForm(current => ({...current, ...next}))}
      onClose={() => setFormVisible(false)}
      onSubmit={submitTaskForm}
    />
  );

  if (activeTask) {
    const context = housekeepingTaskContext(activeTask, rooms, staff);
    const checklist = housekeepingChecklistForTask(activeTask, checklists);
    return (
      <View style={styles.screen}>
        <View style={styles.staticTopAppBar}>
          <TopAppBar
            title="Task Detail"
            leftIcon={ChevronLeft}
            onLeftPress={() => setSelectedTaskId(null)}
            rightIcon={Menu}
            notificationIcon={Bell}
            onRightPress={onMenu}
            onNotificationPress={onOpenNotifications}
          />
        </View>
        <LoadingProcessCard
          active={loading || submitting}
          floating
          label="Updating housekeeping task"
          processes={submitting ? ['Updating housekeeping task'] : loadingProcesses}
        />
        <ScrollView
          style={styles.screen}
          contentContainerStyle={styles.screenContent}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} />}>
          <ErrorNotice message={error || actionError} onRetry={onRefresh} />
          <View style={styles.housekeepingDetailHero}>
            <View style={styles.housekeepingDetailIcon}>
              <ClipboardCheck color="#FFFFFF" size={23} strokeWidth={2.2} />
            </View>
            <View style={styles.housekeepingDetailText}>
              <Text style={styles.captionUpper}>Room care</Text>
              <Text style={styles.housekeepingDetailTitle}>{context.roomLabel}</Text>
              <Text style={styles.cardSubtitle}>{context.taskLabel}</Text>
            </View>
            <View style={styles.ticketCardActions}>
              <StatusBadge
                label={context.statusLabel}
                tone={housekeepingStatusTone(context.status)}
              />
              <ActionMenu
                items={[
                  {label: 'Edit Task', onPress: () => openEditTask(activeTask)},
                  ...housekeepingStatusOptions
                    .filter(option => option.value !== context.status)
                    .map(option => ({
                      label: `Mark ${option.label}`,
                      onPress: () => updateTaskStatus(activeTask, option.value),
                    })),
                ]}
              />
            </View>
          </View>

          <View style={styles.housekeepingQuickRow}>
            <HousekeepingStatusButton
              label="Assign"
              tone="orange"
              onPress={() => updateTaskStatus(activeTask, 'assigned')}
            />
            <HousekeepingStatusButton
              label="Start"
              tone="blue"
              onPress={() => updateTaskStatus(activeTask, 'in_progress')}
            />
            <HousekeepingStatusButton
              label="Done"
              tone="green"
              onPress={() => updateTaskStatus(activeTask, 'completed')}
            />
          </View>
          <Pressable
            style={styles.fullPrimaryButton}
            onPress={() => openEditTask(activeTask)}>
            <ClipboardCheck color="#FFFFFF" size={18} strokeWidth={2.2} />
            <Text style={styles.fullPrimaryButtonText}>Edit Task</Text>
          </Pressable>

          <View style={styles.kitchenDetailCard}>
            <InfoLine label="Room" value={context.roomLabel} />
            <InfoLine label="Assigned" value={context.assignedLabel} />
            <InfoLine label="Task type" value={context.taskLabel} />
            <InfoLine label="Schedule" value={context.scheduleLabel} />
            <InfoLine label="Priority" value={`P${context.priority}`} />
            <InfoLine label="Status" value={context.statusLabel} />
            <InfoLine label="Started" value={formatHousekeepingDate(firstRecordValue(activeTask, ['started_at'])) || '-'} />
            <InfoLine label="Completed" value={formatHousekeepingDate(firstRecordValue(activeTask, ['completed_at'])) || '-'} />
          </View>

          {context.notes ? (
            <View style={styles.kitchenDetailCard}>
              <Text style={styles.captionUpper}>Notes</Text>
              <Text style={styles.kitchenDetailText}>{context.notes}</Text>
            </View>
          ) : null}

          {checklist.length ? (
            <View style={styles.kitchenDetailCard}>
              <Text style={styles.captionUpper}>Checklist</Text>
              {checklist.map((item, index) => (
                <View key={`${String(item)}-${index}`} style={styles.housekeepingChecklistRow}>
                  <CheckCircle color="#16A34A" size={16} strokeWidth={2.2} />
                  <Text style={styles.housekeepingChecklistText}>
                    {housekeepingChecklistText(item)}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </ScrollView>
        {formSheet}
      </View>
    );
  }

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
        <View style={styles.housekeepingReportGrid}>
          <MetricTile label="Open" value={report.open} tone="blue" />
          <MetricTile label="Today" value={report.today} tone="orange" />
          <MetricTile label="Done" value={report.completed} tone="green" />
          <MetricTile label="Rooms" value={report.cleaningRooms} tone="red" />
        </View>
        <Pressable style={styles.housekeepingCreateButton} onPress={openCreateTask}>
          <Plus color="#FFFFFF" size={18} strokeWidth={2.2} />
          <Text style={styles.housekeepingCreateText}>New Task</Text>
        </Pressable>
        <SearchBox
          placeholder="Search room, task, status..."
          value={query}
          onChangeText={setQuery}
        />
        <ChipRow
          labels={['All', 'Today', 'Pending', 'Assigned', 'In Progress', 'Completed', 'Blocked']}
          activeLabel={filter}
          onSelect={setFilter}
        />
        <SectionTitle title="Task Queue" badge={String(filteredTasks.length)} />
        <View style={styles.cardStack}>
          {visibleItems.map((task, index) => {
            const context = housekeepingTaskContext(task, rooms, staff);
            return (
            <Pressable
              key={`${firstRecordValue(task, ['id', 'room_id'])}-${index}`}
              style={styles.housekeepingTaskCard}
              onPress={() => setSelectedTaskId(firstRecordValue(task, ['id']))}>
              <View style={styles.rowBetween}>
                <View style={styles.housekeepingCardTitle}>
                  <Text style={styles.ticketCode}>{context.scheduleLabel}</Text>
                  <Text style={styles.ticketTitle}>{context.roomLabel}</Text>
                  <Text style={styles.cardSubtitleStrong}>{context.taskLabel}</Text>
                </View>
                <View style={styles.ticketCardActions}>
                  <StatusBadge
                    label={context.statusLabel}
                    tone={housekeepingStatusTone(context.status)}
                  />
                  <ActionMenu
                    items={[
                      {label: 'Edit Task', onPress: () => openEditTask(task)},
                      ...housekeepingStatusOptions.map(option => ({
                        label: `Mark ${option.label}`,
                        onPress: () => updateTaskStatus(task, option.value),
                      })),
                    ]}
                  />
                </View>
              </View>
              <View style={styles.housekeepingMetaRow}>
                <View style={styles.housekeepingMetaPill}>
                  <User color={blue} size={14} strokeWidth={2.1} />
                  <Text numberOfLines={1} style={styles.housekeepingMetaText}>
                    {context.assignedLabel}
                  </Text>
                </View>
                <View style={styles.housekeepingMetaPill}>
                  <AlertCircle color="#F97316" size={14} strokeWidth={2.1} />
                  <Text style={styles.housekeepingMetaText}>P{context.priority}</Text>
                </View>
              </View>
              {context.notes ? (
                <Text numberOfLines={2} style={styles.caption}>{context.notes}</Text>
              ) : null}
              <View style={styles.housekeepingQuickRow}>
                <HousekeepingStatusButton
                  label="Start"
                  tone="blue"
                  onPress={() => updateTaskStatus(task, 'in_progress')}
                />
                <HousekeepingStatusButton
                  label="Done"
                  tone="green"
                  onPress={() => updateTaskStatus(task, 'completed')}
                />
                <HousekeepingStatusButton
                  label="Block"
                  tone="red"
                  onPress={() => updateTaskStatus(task, 'blocked')}
                />
              </View>
            </Pressable>
          );})}
        </View>
        {filteredTasks.length === 0 && !loading ? (
          <EmptyState label="No housekeeping tasks returned from API." />
        ) : null}
        <ListFooter hasMore={hasMore} loading={loading} />
      </ScrollView>
      {formSheet}
    </View>
  );
}

function HousekeepingTaskFormSheet({
  error,
  form,
  mode,
  rooms,
  staff,
  submitting,
  visible,
  onChange,
  onClose,
  onSubmit,
}: {
  error: string | null;
  form: HousekeepingTaskFormState;
  mode: 'create' | 'edit';
  rooms: ArcadiaRecord[];
  staff: ArcadiaRecord[];
  submitting: boolean;
  visible: boolean;
  onChange: (next: Partial<HousekeepingTaskFormState>) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.relationPickerBackdrop}>
        <View style={styles.menuFormSheet}>
          <View style={styles.quickDrawerHandle} />
          <Text style={styles.relationPickerTitle}>
            {mode === 'create' ? 'Create housekeeping task' : 'Edit housekeeping task'}
          </Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            <FormError message={error} />
            <HousekeepingRelationField
              disabled={mode === 'edit'}
              label="Room"
              placeholder="Search room number..."
              records={rooms}
              selectedId={form.roomId}
              subtitleKeys={['room_type', 'floor', 'status']}
              titleKeys={['room_number', 'name', 'number']}
              onSelect={record => onChange({roomId: firstRecordValue(record, ['id'])})}
            />
            <HousekeepingRelationField
              label="Assign to"
              placeholder="Search staff name..."
              records={staff}
              selectedId={form.assignedTo}
              subtitleKeys={['job_role', 'email']}
              titleKeys={['name', 'full_name', 'email']}
              onClear={() => onChange({assignedTo: ''})}
              onSelect={record => onChange({assignedTo: firstRecordValue(record, ['id', 'user_id'])})}
            />
            <HousekeepingOptionGroup
              label="Task type"
              options={housekeepingTaskTypeOptions.map(option => [option.value, option.label])}
              value={form.taskType}
              onChange={value => onChange({taskType: value})}
            />
            <View style={styles.dualFieldRow}>
              <MenuFormField label="Date">
                <TextInput
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#94A3B8"
                  style={styles.formInput}
                  value={form.scheduledDate}
                  onChangeText={value => onChange({scheduledDate: value})}
                />
              </MenuFormField>
              <MenuFormField label="Time">
                <TextInput
                  placeholder="HH:mm"
                  placeholderTextColor="#94A3B8"
                  style={styles.formInput}
                  value={form.scheduledTime}
                  onChangeText={value => onChange({scheduledTime: value})}
                />
              </MenuFormField>
            </View>
            <HousekeepingOptionGroup
              label="Status"
              options={housekeepingStatusOptions.map(option => [option.value, option.label])}
              value={form.status}
              onChange={value => onChange({status: value})}
            />
            <HousekeepingOptionGroup
              label="Priority"
              options={housekeepingPriorityOptions.map(value => [value, `P${value}`])}
              value={form.priority}
              onChange={value => onChange({priority: value})}
            />
            <MenuFormField label="Notes">
              <TextInput
                multiline
                placeholder="Checklist, amenities, guest request..."
                placeholderTextColor="#94A3B8"
                style={[styles.formInput, styles.formInputMultiline]}
                value={form.notes}
                onChangeText={value => onChange({notes: value})}
              />
            </MenuFormField>
          </ScrollView>
          <View style={styles.menuFormActions}>
            <Pressable style={styles.menuFormSecondaryButton} onPress={onClose}>
              <Text style={styles.menuFormSecondaryText}>Cancel</Text>
            </Pressable>
            <Pressable
              disabled={submitting}
              style={[styles.menuFormPrimaryButton, submitting && styles.disabledActionButton]}
              onPress={onSubmit}>
              <Text style={styles.menuFormPrimaryText}>{submitting ? 'Saving...' : 'Done'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function HousekeepingRelationField({
  disabled = false,
  label,
  placeholder,
  records,
  selectedId,
  subtitleKeys,
  titleKeys,
  onClear,
  onSelect,
}: {
  disabled?: boolean;
  label: string;
  placeholder: string;
  records: ArcadiaRecord[];
  selectedId: string;
  subtitleKeys: string[];
  titleKeys: string[];
  onClear?: () => void;
  onSelect: (record: ArcadiaRecord) => void;
}) {
  const [open, setOpen] = useState(false);
  const [relationQuery, setRelationQuery] = useState('');
  const selectedRecord = housekeepingLookup(records, selectedId, ['id', 'user_id', 'room_id']);
  const selectedTitle =
    firstRecordValue(selectedRecord, titleKeys) ||
    (selectedId ? `${label} ${selectedId}` : '');
  const selectedSubtitle = subtitleKeys
    .map(key => firstRecordValue(selectedRecord, [key]))
    .filter(Boolean)
    .join(' - ');
  const filteredRecords = useMemo(
    () => filterRecordsBySearch(records, relationQuery),
    [records, relationQuery],
  );
  const {hasMore, loadMore, visibleItems} = useScrollPagination(filteredRecords, 18);

  useEffect(() => {
    if (!open) {
      setRelationQuery('');
    }
  }, [open]);

  return (
    <View style={styles.formField}>
      <View style={styles.rowBetween}>
        <Text style={styles.formLabel}>{label}</Text>
        {onClear && selectedId ? (
          <Pressable onPress={onClear}>
            <Text style={styles.inlineLinkText}>Clear</Text>
          </Pressable>
        ) : null}
      </View>
      <Pressable
        disabled={disabled}
        style={[styles.lookupInputButton, disabled && styles.disabledActionButton]}
        onPress={() => setOpen(true)}>
        <View style={styles.lookupInputTextBlock}>
          <Text
            numberOfLines={1}
            style={[
              styles.lookupInputText,
              !selectedTitle && styles.lookupPlaceholderText,
            ]}>
            {selectedTitle || placeholder}
          </Text>
          {selectedSubtitle ? (
            <Text numberOfLines={1} style={styles.captionTiny}>{selectedSubtitle}</Text>
          ) : null}
        </View>
        <ChevronRight color="#94A3B8" size={18} strokeWidth={2.2} />
      </Pressable>
      <Modal animationType="slide" transparent visible={open} onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.relationPickerBackdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.relationPickerSheet}>
            <View style={styles.quickDrawerHandle} />
            <View style={styles.relationPickerHeader}>
              <Text style={styles.relationPickerTitle}>{label}</Text>
              <Pressable style={styles.popupCloseButton} onPress={() => setOpen(false)}>
                <Text style={styles.popupCloseText}>x</Text>
              </Pressable>
            </View>
            <TextInput
              autoFocus
              placeholder={placeholder}
              placeholderTextColor="#94A3B8"
              style={styles.formInput}
              value={relationQuery}
              onChangeText={setRelationQuery}
            />
            <ScrollView
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              showsVerticalScrollIndicator
              style={styles.relationPickerList}
              onScroll={handleScrollLoadMore(loadMore)}
              scrollEventThrottle={16}>
              {visibleItems.length ? (
                visibleItems.map((record, index) => {
                  const recordId = firstRecordValue(record, ['id', 'user_id', 'room_id']);
                  const active = selectedId === recordId;
                  const title = firstRecordValue(record, titleKeys) || `Record ${index + 1}`;
                  const subtitle = subtitleKeys
                    .map(key => firstRecordValue(record, [key]))
                    .filter(Boolean)
                    .join(' - ');
                  return (
                    <Pressable
                      key={`${recordId || title}-${index}`}
                      style={[styles.lookupOption, active && styles.activeRelationOption]}
                      onPress={() => {
                        onSelect(record);
                        setOpen(false);
                      }}>
                      <Text style={styles.lookupTitle}>
                        {label === 'Room' ? `Room ${title}` : title}
                      </Text>
                      {subtitle ? <Text style={styles.captionTiny}>{subtitle}</Text> : null}
                    </Pressable>
                  );
                })
              ) : (
                <Text style={styles.lookupEmpty}>No matching records</Text>
              )}
              <Text style={styles.lookupEmpty}>
                {hasMore ? 'Scroll for more records' : 'All matching records loaded'}
              </Text>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function HousekeepingOptionGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[][];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.formField}>
      <Text style={styles.formLabel}>{label}</Text>
      <View style={styles.optionWrap}>
        {options.map(([optionValue, optionLabel]) => {
          const active = value === optionValue;
          return (
            <Pressable
              key={optionValue}
              style={[styles.optionPill, active && styles.activeOptionPill]}
              onPress={() => onChange(optionValue)}>
              <Text style={[styles.optionPillText, active && styles.activeOptionPillText]}>
                {optionLabel}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function FoodScreen({
  error,
  loading,
  loadingProcesses,
  hotelId,
  request,
  onBack,
  onMenu,
  onOpenNotifications,
  onShowDialog,
}: {
  error: string | null;
  loading: boolean;
  loadingProcesses: string[];
  hotelId: string;
  request: RequestFn;
  onBack: () => void;
  onMenu: () => void;
  onOpenNotifications: () => void;
  onShowDialog: (dialog: AppDialogRequest) => void;
}) {
  return (
    <FnbMenuManager
      error={error}
      hotelId={hotelId}
      loading={loading}
      loadingProcesses={loadingProcesses}
      request={request}
      onBack={onBack}
      onMenu={onMenu}
      onOpenNotifications={onOpenNotifications}
      onShowDialog={onShowDialog}
    />
  );
}

function FnbMenuManager({
  error,
  hotelId,
  loading,
  loadingProcesses,
  request,
  onBack,
  onMenu,
  onOpenNotifications,
  onShowDialog,
}: {
  error: string | null;
  hotelId: string;
  loading: boolean;
  loadingProcesses: string[];
  request: RequestFn;
  onBack: () => void;
  onMenu: () => void;
  onOpenNotifications: () => void;
  onShowDialog: (dialog: AppDialogRequest) => void;
}) {
  const [categories, setCategories] = useState<MenuCategoryRecord[]>([]);
  const [items, setItems] = useState<MenuItemRecord[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState('all');
  const [query, setQuery] = useState('');
  const [viewMode, setViewMode] = useState<'items' | 'categories'>('items');
  const [menuLoading, setMenuLoading] = useState(false);
  const [menuError, setMenuError] = useState<string | null>(null);
  const [itemForm, setItemForm] = useState<MenuItemFormState>(emptyItemForm);
  const [categoryForm, setCategoryForm] = useState<MenuCategoryFormState>(emptyCategoryForm);
  const [itemFormVisible, setItemFormVisible] = useState(false);
  const [categoryFormVisible, setCategoryFormVisible] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadMenu = useCallback(async () => {
    setMenuLoading(true);
    setMenuError(null);
    try {
      const [categoryPayload, itemPayload] = await Promise.all([
        request<MenuCategoryRecord[]>(`/api/v1/hotels/${hotelId}/menu/categories`),
        request<MenuItemRecord[]>(`/api/v1/hotels/${hotelId}/menu/items`),
      ]);
      setCategories(sortMenuRecords(Array.isArray(categoryPayload.data) ? categoryPayload.data : []));
      setItems(sortMenuRecords(Array.isArray(itemPayload.data) ? itemPayload.data : []));
    } catch (nextError) {
      setMenuError(formatErrorDetails(nextError, 'Unable to load menu data.'));
    } finally {
      setMenuLoading(false);
    }
  }, [hotelId, request]);

  useEffect(() => {
    loadMenu();
  }, [loadMenu]);

  const categoryNameById = useMemo(() => {
    return categories.reduce<Record<string, string>>((lookup, category) => {
      const id = firstRecordValue(category, ['id']);
      if (id) {
        lookup[id] = firstRecordValue(category, ['name']) || 'Untitled category';
      }
      return lookup;
    }, {});
  }, [categories]);

  const visibleItems = useMemo(() => {
    const filteredByCategory =
      selectedCategoryId === 'all'
        ? items
        : items.filter(item => firstRecordValue(item, ['category_id']) === selectedCategoryId);
    return filterRecordsBySearch(
      filteredByCategory.map(item => ({
        ...item,
        category_name: categoryNameById[firstRecordValue(item, ['category_id'])] ?? '',
      })),
      query,
    );
  }, [categoryNameById, items, query, selectedCategoryId]);

  const itemCountByCategory = useMemo(() => {
    return items.reduce<Record<string, number>>((counts, item) => {
      const categoryId = firstRecordValue(item, ['category_id']);
      if (categoryId) {
        counts[categoryId] = (counts[categoryId] ?? 0) + 1;
      }
      return counts;
    }, {});
  }, [items]);

  function openCreateItemForm() {
    if (!categories.length) {
      onShowDialog({
        message: 'Create a food category before adding a menu item.',
        title: 'Category required',
        tone: 'info',
      });
      setViewMode('categories');
      return;
    }
    setFormError(null);
    setItemForm({
      ...emptyItemForm,
      categoryId:
        selectedCategoryId !== 'all'
          ? selectedCategoryId
          : firstRecordValue(categories[0], ['id']),
    });
    setItemFormVisible(true);
  }

  function openEditItemForm(item: MenuItemRecord) {
    setFormError(null);
    setItemForm({
      categoryId: firstRecordValue(item, ['category_id']),
      descriptionShort: firstRecordValue(item, ['description_short', 'description']),
      displayOrder: firstRecordValue(item, ['display_order']) || '0',
      id: firstRecordValue(item, ['id']),
      imageUrl: firstRecordValue(item, ['image_url']),
      isAvailable: menuRecordBool(item, 'is_available', true),
      name: firstRecordValue(item, ['name']),
      prepMinutes: firstRecordValue(item, ['preparation_time_minutes']) || '15',
      price: firstRecordValue(item, ['price']) || '0.00',
    });
    setItemFormVisible(true);
  }

  function openCreateCategoryForm() {
    setFormError(null);
    setCategoryForm(emptyCategoryForm);
    setCategoryFormVisible(true);
  }

  function openEditCategoryForm(category: MenuCategoryRecord) {
    setFormError(null);
    setCategoryForm({
      displayOrder: firstRecordValue(category, ['display_order']) || '0',
      id: firstRecordValue(category, ['id']),
      isActive: menuRecordBool(category, 'is_active', true),
      name: firstRecordValue(category, ['name']),
      type: firstRecordValue(category, ['type']) || 'food',
    });
    setCategoryFormVisible(true);
  }

  async function submitItemForm() {
    const name = itemForm.name.trim();
    const categoryId = itemForm.categoryId.trim();
    const price = Number(itemForm.price);
    const prepMinutes = Number(itemForm.prepMinutes || 0);
    const displayOrder = Number(itemForm.displayOrder || 0);

    if (name.length < 2) {
      setFormError('Enter at least 2 characters for the item name.');
      return;
    }
    if (!categoryId) {
      setFormError('Choose a category for this item.');
      return;
    }
    if (Number.isNaN(price) || price < 0) {
      setFormError('Enter a valid price per unit.');
      return;
    }
    if (Number.isNaN(prepMinutes) || prepMinutes < 0) {
      setFormError('Enter a valid preparation time.');
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      await request<MenuItemRecord>(
        itemForm.id
          ? `/api/v1/hotels/${hotelId}/menu/items/${itemForm.id}`
          : `/api/v1/hotels/${hotelId}/menu/items`,
        {
          method: itemForm.id ? 'PATCH' : 'POST',
          body: JSON.stringify(
            compactPayload({
              category_id: categoryId,
              description_short: itemForm.descriptionShort.trim() || undefined,
              display_order: Number.isNaN(displayOrder) ? 0 : displayOrder,
              image_url: itemForm.imageUrl.trim() || undefined,
              is_available: itemForm.isAvailable,
              name,
              preparation_time_minutes: prepMinutes,
              price: price.toFixed(2),
            }),
          ),
        },
      );
      setItemFormVisible(false);
      await loadMenu();
      onShowDialog({
        message: `${name} is saved in the F&B menu.`,
        title: itemForm.id ? 'Item updated' : 'Item created',
        tone: 'success',
      });
    } catch (nextError) {
      setFormError(formatErrorDetails(nextError, 'Unable to save menu item.'));
    } finally {
      setSubmitting(false);
    }
  }

  async function submitCategoryForm() {
    const name = categoryForm.name.trim();
    const displayOrder = Number(categoryForm.displayOrder || 0);
    if (name.length < 2) {
      setFormError('Enter at least 2 characters for the category name.');
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      const payload = await request<MenuCategoryRecord>(
        categoryForm.id
          ? `/api/v1/hotels/${hotelId}/menu/categories/${categoryForm.id}`
          : `/api/v1/hotels/${hotelId}/menu/categories`,
        {
          method: categoryForm.id ? 'PATCH' : 'POST',
          body: JSON.stringify(
            compactPayload({
              display_order: Number.isNaN(displayOrder) ? 0 : displayOrder,
              is_active: categoryForm.isActive,
              name,
              type: categoryForm.type.trim() || 'food',
            }),
          ),
        },
      );
      const savedCategoryId = firstRecordValue(payload.data, ['id']);
      if (savedCategoryId) {
        setSelectedCategoryId(savedCategoryId);
      }
      setCategoryFormVisible(false);
      await loadMenu();
      onShowDialog({
        message: `${name} is saved as a food category.`,
        title: categoryForm.id ? 'Category updated' : 'Category created',
        tone: 'success',
      });
    } catch (nextError) {
      setFormError(formatErrorDetails(nextError, 'Unable to save category.'));
    } finally {
      setSubmitting(false);
    }
  }

  async function updateItemAvailability(item: MenuItemRecord) {
    const itemId = firstRecordValue(item, ['id']);
    if (!itemId) {
      return;
    }
    const available = !menuRecordBool(item, 'is_available', true);
    setMenuLoading(true);
    try {
      await request<MenuItemRecord>(
        `/api/v1/hotels/${hotelId}/menu/items/${itemId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({is_available: available}),
        },
      );
      await loadMenu();
      onShowDialog({
        message: `${firstRecordValue(item, ['name']) || 'Menu item'} is ${available ? 'visible on the guest web page.' : 'hidden from the guest web page.'}`,
        title: available ? 'Item shown' : 'Item hidden',
        tone: 'success',
      });
    } catch (nextError) {
      setMenuError(formatErrorDetails(nextError, 'Unable to update item visibility.'));
    } finally {
      setMenuLoading(false);
    }
  }

  async function updateCategoryAvailability(category: MenuCategoryRecord) {
    const categoryId = firstRecordValue(category, ['id']);
    if (!categoryId) {
      return;
    }
    const active = !menuRecordBool(category, 'is_active', true);
    setMenuLoading(true);
    try {
      await request<MenuCategoryRecord>(
        `/api/v1/hotels/${hotelId}/menu/categories/${categoryId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({is_active: active}),
        },
      );
      await loadMenu();
      onShowDialog({
        message: `${firstRecordValue(category, ['name']) || 'Category'} is ${active ? 'active.' : 'hidden.'}`,
        title: active ? 'Category shown' : 'Category hidden',
        tone: 'success',
      });
    } catch (nextError) {
      setMenuError(formatErrorDetails(nextError, 'Unable to update category.'));
    } finally {
      setMenuLoading(false);
    }
  }

  function confirmDeleteItem(item: MenuItemRecord) {
    const name = firstRecordValue(item, ['name']) || 'this item';
    onShowDialog({
      actions: [
        {label: 'Cancel', tone: 'secondary'},
        {label: 'Delete', onPress: () => deleteItem(item)},
      ],
      message: `${name} will be removed from the F&B menu.`,
      title: 'Delete item?',
      tone: 'info',
    });
  }

  async function deleteItem(item: MenuItemRecord) {
    const itemId = firstRecordValue(item, ['id']);
    if (!itemId) {
      return;
    }
    setMenuLoading(true);
    try {
      await request<{deleted: boolean}>(
        `/api/v1/hotels/${hotelId}/menu/items/${itemId}`,
        {method: 'DELETE'},
      );
      await loadMenu();
      onShowDialog({
        message: 'The menu item was deleted.',
        title: 'Item deleted',
        tone: 'success',
      });
    } catch (nextError) {
      setMenuError(formatErrorDetails(nextError, 'Unable to delete menu item.'));
    } finally {
      setMenuLoading(false);
    }
  }

  function confirmDeleteCategory(category: MenuCategoryRecord) {
    const name = firstRecordValue(category, ['name']) || 'this category';
    onShowDialog({
      actions: [
        {label: 'Cancel', tone: 'secondary'},
        {label: 'Delete', onPress: () => deleteCategory(category)},
      ],
      message: `${name} will be removed. Items in this category may need reassignment.`,
      title: 'Delete category?',
      tone: 'info',
    });
  }

  async function deleteCategory(category: MenuCategoryRecord) {
    const categoryId = firstRecordValue(category, ['id']);
    if (!categoryId) {
      return;
    }
    setMenuLoading(true);
    try {
      await request<{deleted: boolean}>(
        `/api/v1/hotels/${hotelId}/menu/categories/${categoryId}`,
        {method: 'DELETE'},
      );
      if (selectedCategoryId === categoryId) {
        setSelectedCategoryId('all');
      }
      await loadMenu();
      onShowDialog({
        message: 'The food category was deleted.',
        title: 'Category deleted',
        tone: 'success',
      });
    } catch (nextError) {
      setMenuError(formatErrorDetails(nextError, 'Unable to delete category.'));
    } finally {
      setMenuLoading(false);
    }
  }

  const activeError = menuError || error;
  const loadingLabel =
    viewMode === 'items' ? 'Loading menu items and categories' : 'Loading food categories';

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
        active={loading || menuLoading}
        floating
        label={loadingLabel}
        processes={menuLoading ? [loadingLabel] : loadingProcesses}
      />
      <ScrollView
        contentContainerStyle={styles.screenContent}
        refreshControl={<RefreshControl refreshing={loading || menuLoading} onRefresh={loadMenu} />}>
        <ErrorNotice message={activeError} onRetry={loadMenu} />
        <SearchBox
          placeholder="Search menu item, category..."
          value={query}
          onChangeText={setQuery}
        />
        <ChipRow
          labels={['Items', 'Categories']}
          activeLabel={viewMode === 'items' ? 'Items' : 'Categories'}
          onSelect={label => setViewMode(label === 'Categories' ? 'categories' : 'items')}
        />

        {viewMode === 'items' ? (
          <>
            <View style={styles.menuActionRow}>
              <Pressable style={styles.menuPrimaryAction} onPress={openCreateItemForm}>
                <Plus color="#FFFFFF" size={18} strokeWidth={2.2} />
                <Text style={styles.menuPrimaryActionText}>Create Item</Text>
              </Pressable>
              <Pressable
                style={styles.menuSecondaryAction}
                onPress={openCreateCategoryForm}>
                <Text style={styles.menuSecondaryActionText}>Create Category</Text>
              </Pressable>
            </View>
            <MenuCategoryFilter
              categories={categories}
              selectedCategoryId={selectedCategoryId}
              onSelect={setSelectedCategoryId}
            />
            <SectionTitle title="Food Items" badge={String(visibleItems.length)} />
            <View style={styles.menuGrid}>
              {visibleItems.map((item, index) => {
                const itemId = firstRecordValue(item, ['id']);
                const available = menuRecordBool(item, 'is_available', true);
                const imageUrl = firstRecordValue(item, ['image_url']);
                return (
                  <View key={`${itemId}-${index}`} style={styles.menuItemCard}>
                    {imageUrl ? (
                      <Image
                        resizeMode="cover"
                        source={{uri: imageUrl}}
                        style={styles.menuItemImage}
                      />
                    ) : (
                      <View style={styles.menuItemImagePlaceholder}>
                        <Utensils color={blue} size={28} strokeWidth={2.1} />
                      </View>
                    )}
                    <View style={styles.menuItemBody}>
                      <Text numberOfLines={2} style={styles.menuItemName}>
                        {firstRecordValue(item, ['name']) || 'Untitled item'}
                      </Text>
                      <Text style={styles.menuItemCategory} numberOfLines={1}>
                        {categoryNameById[firstRecordValue(item, ['category_id'])] || 'No category'}
                      </Text>
                      <Text style={styles.menuItemPrice}>
                        {formatMenuPrice(firstRecordValue(item, ['price']))}
                      </Text>
                    </View>
                    <View style={styles.menuItemFooter}>
                      <StatusBadge
                        label={available ? 'Guest visible' : 'Hidden'}
                        tone={available ? 'green' : 'gray'}
                      />
                      <ActionMenu
                        items={[
                          {label: 'Update Item', onPress: () => openEditItemForm(item)},
                          {
                            label: available ? 'Hide from Guest Web' : 'Show on Guest Web',
                            onPress: () => updateItemAvailability(item),
                          },
                          {label: 'Delete Item', tone: 'danger', onPress: () => confirmDeleteItem(item)},
                        ]}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
            {visibleItems.length === 0 && !loading && !menuLoading ? (
              <EmptyState label="No menu items found for this filter." />
            ) : null}
          </>
        ) : (
          <View>
            <View style={styles.menuActionRow}>
              <Pressable style={styles.menuPrimaryAction} onPress={openCreateCategoryForm}>
                <Plus color="#FFFFFF" size={18} strokeWidth={2.2} />
                <Text style={styles.menuPrimaryActionText}>Create Category</Text>
              </Pressable>
            </View>
            <SectionTitle title="Food Categories" badge={String(categories.length)} />
            <View style={styles.categoryManageList}>
              {categories.map((category, index) => {
                const categoryId = firstRecordValue(category, ['id']);
                const active = menuRecordBool(category, 'is_active', true);
                return (
                  <View key={`${categoryId}-${index}`} style={styles.categoryManageCard}>
                    <View style={styles.categoryManageText}>
                      <Text style={styles.cardTitle}>
                        {firstRecordValue(category, ['name']) || 'Untitled category'}
                      </Text>
                      <Text style={styles.caption}>
                        {firstRecordValue(category, ['type']) || 'food'} - {itemCountByCategory[categoryId] ?? 0} items
                      </Text>
                    </View>
                    <View style={styles.ticketCardActions}>
                      <StatusBadge label={active ? 'Active' : 'Hidden'} tone={active ? 'green' : 'gray'} />
                      <ActionMenu
                        items={[
                          {label: 'Update Category', onPress: () => openEditCategoryForm(category)},
                          {
                            label: active ? 'Hide Category' : 'Show Category',
                            onPress: () => updateCategoryAvailability(category),
                          },
                          {label: 'Delete Category', tone: 'danger', onPress: () => confirmDeleteCategory(category)},
                        ]}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
            {categories.length === 0 && !loading && !menuLoading ? (
              <EmptyState label="No food categories saved yet." />
            ) : null}
          </View>
        )}
      </ScrollView>
      <MenuItemFormSheet
        categories={categories}
        error={formError}
        form={itemForm}
        submitting={submitting}
        title={itemForm.id ? 'Update item' : 'Create item'}
        visible={itemFormVisible}
        onChange={next => setItemForm(current => ({...current, ...next}))}
        onClose={() => setItemFormVisible(false)}
        onSubmit={submitItemForm}
      />
      <MenuCategoryFormSheet
        error={formError}
        form={categoryForm}
        submitting={submitting}
        title={categoryForm.id ? 'Update category' : 'Create category'}
        visible={categoryFormVisible}
        onChange={next => setCategoryForm(current => ({...current, ...next}))}
        onClose={() => setCategoryFormVisible(false)}
        onSubmit={submitCategoryForm}
      />
    </View>
  );
}

type MenuCategoryRecord = ArcadiaRecord;
type MenuItemRecord = ArcadiaRecord;

type MenuItemFormState = {
  categoryId: string;
  descriptionShort: string;
  displayOrder: string;
  id?: string;
  imageUrl: string;
  isAvailable: boolean;
  name: string;
  prepMinutes: string;
  price: string;
};

type MenuCategoryFormState = {
  displayOrder: string;
  id?: string;
  isActive: boolean;
  name: string;
  type: string;
};

const emptyItemForm: MenuItemFormState = {
  categoryId: '',
  descriptionShort: '',
  displayOrder: '0',
  imageUrl: '',
  isAvailable: true,
  name: '',
  prepMinutes: '15',
  price: '0.00',
};

const emptyCategoryForm: MenuCategoryFormState = {
  displayOrder: '0',
  isActive: true,
  name: '',
  type: 'food',
};

function MenuCategoryFilter({
  categories,
  selectedCategoryId,
  onSelect,
}: {
  categories: MenuCategoryRecord[];
  selectedCategoryId: string;
  onSelect: (categoryId: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipRow}>
      <Pressable
        style={[styles.chip, selectedCategoryId === 'all' && styles.activeChip]}
        onPress={() => onSelect('all')}>
        <Text style={[styles.chipText, selectedCategoryId === 'all' && styles.activeChipText]}>
          All
        </Text>
      </Pressable>
      {categories.map(category => {
        const categoryId = firstRecordValue(category, ['id']);
        const active = selectedCategoryId === categoryId;
        return (
          <Pressable
            key={categoryId || firstRecordValue(category, ['name'])}
            style={[styles.chip, active && styles.activeChip]}
            onPress={() => onSelect(categoryId)}>
            <Text style={[styles.chipText, active && styles.activeChipText]}>
              {firstRecordValue(category, ['name']) || 'Untitled'}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function MenuItemFormSheet({
  categories,
  error,
  form,
  submitting,
  title,
  visible,
  onChange,
  onClose,
  onSubmit,
}: {
  categories: MenuCategoryRecord[];
  error: string | null;
  form: MenuItemFormState;
  submitting: boolean;
  title: string;
  visible: boolean;
  onChange: (next: Partial<MenuItemFormState>) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.relationPickerBackdrop}>
        <View style={styles.menuFormSheet}>
          <View style={styles.quickDrawerHandle} />
          <Text style={styles.relationPickerTitle}>{title}</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            <FormError message={error} />
            <MenuFormField label="Item name">
              <TextInput
                placeholder="Paneer tikka"
                placeholderTextColor="#94A3B8"
                style={styles.formInput}
                value={form.name}
                onChangeText={value => onChange({name: value})}
              />
            </MenuFormField>
            <MenuFormField label="Category">
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.optionWrap}>
                {categories.map(category => {
                  const categoryId = firstRecordValue(category, ['id']);
                  const active = form.categoryId === categoryId;
                  return (
                    <Pressable
                      key={categoryId}
                      style={[styles.optionPill, active && styles.activeOptionPill]}
                      onPress={() => onChange({categoryId})}>
                      <Text style={[styles.optionPillText, active && styles.activeOptionPillText]}>
                        {firstRecordValue(category, ['name']) || 'Untitled'}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </MenuFormField>
            <View style={styles.dualFieldRow}>
              <MenuFormField label="Price per unit">
                <TextInput
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor="#94A3B8"
                  style={styles.formInput}
                  value={form.price}
                  onChangeText={value => onChange({price: value})}
                />
              </MenuFormField>
              <MenuFormField label="Prep min">
                <TextInput
                  keyboardType="number-pad"
                  placeholder="15"
                  placeholderTextColor="#94A3B8"
                  style={styles.formInput}
                  value={form.prepMinutes}
                  onChangeText={value => onChange({prepMinutes: value})}
                />
              </MenuFormField>
            </View>
            <MenuFormField label="Image URL">
              <TextInput
                autoCapitalize="none"
                placeholder="https://..."
                placeholderTextColor="#94A3B8"
                style={styles.formInput}
                value={form.imageUrl}
                onChangeText={value => onChange({imageUrl: value})}
              />
            </MenuFormField>
            <MenuFormField label="Short description">
              <TextInput
                multiline
                placeholder="Guest-facing item detail"
                placeholderTextColor="#94A3B8"
                style={[styles.formInput, styles.formInputMultiline]}
                value={form.descriptionShort}
                onChangeText={value => onChange({descriptionShort: value})}
              />
            </MenuFormField>
            <View style={styles.dualFieldRow}>
              <MenuFormField label="Display order">
                <TextInput
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor="#94A3B8"
                  style={styles.formInput}
                  value={form.displayOrder}
                  onChangeText={value => onChange({displayOrder: value})}
                />
              </MenuFormField>
              <MenuFormField label="Guest web page">
                <ToggleField
                  active={form.isAvailable}
                  label={form.isAvailable ? 'Shown' : 'Hidden'}
                  onPress={() => onChange({isAvailable: !form.isAvailable})}
                />
              </MenuFormField>
            </View>
          </ScrollView>
          <View style={styles.menuFormActions}>
            <Pressable style={styles.menuFormSecondaryButton} onPress={onClose}>
              <Text style={styles.menuFormSecondaryText}>Cancel</Text>
            </Pressable>
            <Pressable
              disabled={submitting}
              style={[styles.menuFormPrimaryButton, submitting && styles.disabledActionButton]}
              onPress={onSubmit}>
              <Text style={styles.menuFormPrimaryText}>{submitting ? 'Saving...' : 'Done'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function MenuCategoryFormSheet({
  error,
  form,
  submitting,
  title,
  visible,
  onChange,
  onClose,
  onSubmit,
}: {
  error: string | null;
  form: MenuCategoryFormState;
  submitting: boolean;
  title: string;
  visible: boolean;
  onChange: (next: Partial<MenuCategoryFormState>) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.relationPickerBackdrop}>
        <View style={styles.menuFormSheet}>
          <View style={styles.quickDrawerHandle} />
          <Text style={styles.relationPickerTitle}>{title}</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            <FormError message={error} />
            <MenuFormField label="Category name">
              <TextInput
                placeholder="Main Course"
                placeholderTextColor="#94A3B8"
                style={styles.formInput}
                value={form.name}
                onChangeText={value => onChange({name: value})}
              />
            </MenuFormField>
            <View style={styles.dualFieldRow}>
              <MenuFormField label="Type">
                <TextInput
                  placeholder="food"
                  placeholderTextColor="#94A3B8"
                  style={styles.formInput}
                  value={form.type}
                  onChangeText={value => onChange({type: value})}
                />
              </MenuFormField>
              <MenuFormField label="Display order">
                <TextInput
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor="#94A3B8"
                  style={styles.formInput}
                  value={form.displayOrder}
                  onChangeText={value => onChange({displayOrder: value})}
                />
              </MenuFormField>
            </View>
            <MenuFormField label="Category status">
              <ToggleField
                active={form.isActive}
                label={form.isActive ? 'Active' : 'Hidden'}
                onPress={() => onChange({isActive: !form.isActive})}
              />
            </MenuFormField>
          </ScrollView>
          <View style={styles.menuFormActions}>
            <Pressable style={styles.menuFormSecondaryButton} onPress={onClose}>
              <Text style={styles.menuFormSecondaryText}>Cancel</Text>
            </Pressable>
            <Pressable
              disabled={submitting}
              style={[styles.menuFormPrimaryButton, submitting && styles.disabledActionButton]}
              onPress={onSubmit}>
              <Text style={styles.menuFormPrimaryText}>{submitting ? 'Saving...' : 'Done'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function MenuFormField({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <View style={styles.formField}>
      <Text style={styles.formLabel}>{label}</Text>
      {children}
    </View>
  );
}

function ToggleField({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.menuToggle, active && styles.menuToggleActive]}
      onPress={onPress}>
      <View style={[styles.menuToggleDot, active && styles.menuToggleDotActive]} />
      <Text style={[styles.menuToggleText, active && styles.menuToggleTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function FormError({message}: {message: string | null}) {
  if (!message) {
    return null;
  }
  return (
    <View style={styles.formErrorBox}>
      <Text style={styles.formErrorTitle}>Check the form</Text>
      <Text style={styles.formErrorText}>{message}</Text>
    </View>
  );
}

function menuRecordBool(record: ArcadiaRecord, key: string, fallback: boolean) {
  const value = record[key];
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value > 0;
  }
  if (value === null || value === undefined || value === '') {
    return fallback;
  }
  return ['true', '1', 'yes', 'active', 'available'].includes(String(value).toLowerCase());
}

function sortMenuRecords<T extends ArcadiaRecord>(records: T[]) {
  return [...records].sort((left, right) => {
    const leftOrder = Number(firstRecordValue(left, ['display_order'])) || 0;
    const rightOrder = Number(firstRecordValue(right, ['display_order'])) || 0;
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }
    return firstRecordValue(left, ['name']).localeCompare(firstRecordValue(right, ['name']));
  });
}

function compactPayload(payload: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined),
  );
}

function formatMenuPrice(value: string) {
  const price = Number(value);
  if (Number.isNaN(price)) {
    return value ? `${value} / unit` : 'Rs 0.00 / unit';
  }
  return `Rs ${price.toFixed(2)} / unit`;
}

type KitchenOrderDetailPayload = {
  order?: ArcadiaRecord;
  items?: ArcadiaRecord[];
};

type FolioDetailPayload = {
  folio?: ArcadiaRecord | null;
  items?: ArcadiaRecord[];
};

type KitchenOrderContext = {
  completedAt: string;
  createdAt: string;
  folio: string;
  guestName: string;
  itemCount: string;
  orderedByGuest: string;
  reservationNumber: string;
  roomNumber: string;
  source: string;
  subtotal: string;
  table: string;
  takenBy: string;
  tax: string;
  ticket: string;
  total: string;
};

type KitchenStatusOption = {
  label: string;
  value: string;
  tone?: 'danger';
};

type KitchenOrderFormState = {
  orderedByGuest: boolean;
  source: string;
  specialInstructions: string;
  status: string;
  tableId: string;
  tax: string;
};

type KitchenOrderItemFormState = {
  index: number | null;
  menuItemId: string;
  notes: string;
  quantity: string;
  unitPrice: string;
};

const kitchenStatusOptions: KitchenStatusOption[] = [
  {label: 'Received', value: 'received'},
  {label: 'Preparing', value: 'preparing'},
  {label: 'Ready', value: 'ready'},
  {label: 'Delivered', value: 'delivered'},
  {label: 'Served', value: 'served'},
  {label: 'Billed', value: 'billed'},
  {label: 'Cancelled', value: 'cancelled', tone: 'danger'},
];

const kitchenFilterLabels = ['All', ...kitchenStatusOptions.map(option => option.label)];

function normalizeKitchenStatus(value: string) {
  return value.toLowerCase().replaceAll('_', ' ').trim();
}

function humanizeKitchenValue(value: string) {
  const normalized = value.replaceAll('_', ' ').trim();
  if (!normalized) {
    return '';
  }
  return normalized
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function kitchenStatusLabel(value: string) {
  const normalized = normalizeKitchenStatus(value);
  const option = kitchenStatusOptions.find(item =>
    [item.value, item.label].some(candidate => normalizeKitchenStatus(candidate) === normalized),
  );
  return option?.label ?? humanizeKitchenValue(value);
}

function formatKitchenMoney(value: string) {
  if (!value) {
    return '';
  }
  const amount = Number(value);
  return Number.isNaN(amount) ? value : `Rs ${amount.toFixed(2)}`;
}

function formatKitchenDate(value: string) {
  if (!value) {
    return '';
  }
  return value.includes('T') ? value.replace('T', ' ').slice(0, 16) : value;
}

function formatKitchenBoolean(value: string) {
  if (!value) {
    return '';
  }
  return ['true', '1', 'yes'].includes(value.toLowerCase()) ? 'Yes' : 'No';
}

function kitchenRecordBool(record: ArcadiaRecord, key: string, fallback = false) {
  const value = record[key];
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value > 0;
  }
  if (value === null || value === undefined || value === '') {
    return fallback;
  }
  return ['true', '1', 'yes', 'active'].includes(String(value).toLowerCase());
}

function findKitchenLookup(
  records: ArcadiaRecord[],
  id: string,
  keys: string[],
) {
  if (!id) {
    return null;
  }
  return records.find(record =>
    keys.some(key => firstRecordValue(record, [key]) === id),
  ) ?? null;
}

function findReservationForOrder(
  order: ArcadiaRecord,
  reservations: ReservationView[],
) {
  const reservationId = firstRecordValue(order, [
    'reservation_id',
    'reservation_no',
    'reservation_number',
    'booking_id',
  ]);

  if (reservationId) {
    const directMatch = reservations.find(reservation => {
      const raw = reservation.raw;
      return [
        reservation.id,
        reservation.bookingId,
        firstRecordValue(raw, ['id', 'reservation_id']),
        firstRecordValue(raw, ['reservation_no', 'reservation_number', 'booking_id']),
      ].some(value => value === reservationId);
    });
    if (directMatch) {
      return directMatch;
    }
  }

  const guestId = firstRecordValue(order, ['guest_id']);
  const roomId = firstRecordValue(order, ['room_id']);
  const roomNumber = firstRecordValue(order, ['room_number', 'room', 'room_name']);

  return reservations.find(reservation => {
    const raw = reservation.raw;
    const reservationGuestId = firstRecordValue(raw, [
      'guest_id',
      'primary_guest_id',
      'guest_profile_id',
    ]);
    const reservationRoomId = firstRecordValue(raw, ['room_id']);
    const reservationRoomNumber =
      reservation.roomNumber || firstRecordValue(raw, ['room_number', 'room']);
    const guestMatches = Boolean(guestId && reservationGuestId === guestId);
    const roomMatches = Boolean(
      (roomId && reservationRoomId === roomId) ||
        (roomNumber && reservationRoomNumber === roomNumber),
    );
    return guestMatches && (roomMatches || (!roomId && !roomNumber));
  }) ?? null;
}

function kitchenItemCount(order: ArcadiaRecord, items: ArcadiaRecord[] = []) {
  const directCount = firstRecordValue(order, [
    'item_count',
    'items_count',
    'total_items',
  ]);
  if (directCount) {
    return directCount;
  }
  if (!items.length) {
    return '';
  }
  const quantity = items.reduce((total, item) => {
    const nextQuantity = Number(firstRecordValue(item, ['quantity', 'qty']));
    return total + (Number.isNaN(nextQuantity) ? 0 : nextQuantity);
  }, 0);
  return String(quantity || items.length);
}

function orderItemFormFromRecord(item: ArcadiaRecord, index: number | null): KitchenOrderItemFormState {
  return {
    index,
    menuItemId: firstRecordValue(item, ['menu_item_id']),
    notes: firstRecordValue(item, ['notes']),
    quantity: firstRecordValue(item, ['quantity', 'qty']) || '1',
    unitPrice: firstRecordValue(item, ['unit_price', 'price']),
  };
}

function orderItemPayloadFromForm(form: KitchenOrderItemFormState) {
  const quantity = Number(form.quantity);
  const unitPrice = Number(form.unitPrice);
  return compactPayload({
    menu_item_id: form.menuItemId,
    notes: form.notes.trim() || undefined,
    quantity: Number.isNaN(quantity) ? 1 : Math.max(1, Math.round(quantity)),
    unit_price: form.unitPrice.trim() && !Number.isNaN(unitPrice)
      ? unitPrice.toFixed(2)
      : undefined,
  });
}

function orderItemPayloadFromRecord(item: ArcadiaRecord) {
  return orderItemPayloadFromForm(
    orderItemFormFromRecord(item, null),
  );
}

function menuItemNameById(menuItems: MenuItemRecord[]) {
  return menuItems.reduce<Record<string, string>>((lookup, item) => {
    const itemId = firstRecordValue(item, ['id']);
    if (itemId) {
      lookup[itemId] = firstRecordValue(item, ['name']) || itemId;
    }
    return lookup;
  }, {});
}

function menuItemLabel(item: ArcadiaRecord, menuItems: MenuItemRecord[]) {
  const lookup = menuItemNameById(menuItems);
  const itemId = firstRecordValue(item, ['menu_item_id']);
  return (
    firstRecordValue(item, ['menu_item_name', 'item_name', 'name']) ||
    lookup[itemId] ||
    itemId ||
    'Menu item'
  );
}

function buildKitchenOrderContext(
  order: ArcadiaRecord,
  guests: ArcadiaRecord[],
  rooms: ArcadiaRecord[],
  reservations: ReservationView[],
  items: ArcadiaRecord[] = [],
): KitchenOrderContext {
  const guestId = firstRecordValue(order, ['guest_id']);
  const roomId = firstRecordValue(order, ['room_id']);
  const guest = findKitchenLookup(guests, guestId, ['id', 'guest_id', 'user_id']);
  const room = findKitchenLookup(rooms, roomId, ['id', 'room_id']);
  const reservation = findReservationForOrder(order, reservations);
  const guestName =
    firstRecordValue(order, ['guest_name', 'primary_guest_name', 'customer_name']) ||
    firstRecordValue(guest, ['full_name', 'name', 'guest_name', 'email', 'phone']) ||
    reservation?.guestName ||
    (guestId ? `Guest ${guestId}` : 'Walk-in');
  const roomNumber =
    firstRecordValue(order, ['room_number', 'room', 'room_name']) ||
    firstRecordValue(room, ['room_number', 'name', 'number']) ||
    reservation?.roomNumber ||
    (roomId ? `Room ${roomId}` : 'No room');
  const reservationNumber =
    firstRecordValue(order, [
      'reservation_no',
      'reservation_number',
      'booking_id',
      'reservation_id',
    ]) ||
    reservation?.bookingId ||
    reservation?.id ||
    '';

  return {
    completedAt: formatKitchenDate(firstRecordValue(order, ['completed_at'])),
    createdAt: formatKitchenDate(firstRecordValue(order, ['created_at', 'ordered_at'])),
    folio: firstRecordValue(order, ['folio_id', 'folio_number']),
    guestName,
    itemCount: kitchenItemCount(order, items),
    orderedByGuest: formatKitchenBoolean(firstRecordValue(order, ['ordered_by_guest'])),
    reservationNumber,
    roomNumber,
    source: firstRecordValue(order, ['source', 'order_source']) || 'Restaurant',
    subtotal: formatKitchenMoney(firstRecordValue(order, ['subtotal'])),
    table: firstRecordValue(order, ['table_number', 'table_name', 'table_id']),
    takenBy: firstRecordValue(order, ['taken_by', 'staff_name', 'created_by']),
    tax: formatKitchenMoney(firstRecordValue(order, ['tax', 'tax_amount'])),
    ticket: firstRecordValue(order, ['ticket_code', 'ticket_id']),
    total: formatKitchenMoney(firstRecordValue(order, ['total', 'total_amount', 'grand_total'])),
  };
}

function enrichKitchenOrderForSearch(
  order: ArcadiaRecord,
  guests: ArcadiaRecord[],
  rooms: ArcadiaRecord[],
  reservations: ReservationView[],
) {
  const context = buildKitchenOrderContext(order, guests, rooms, reservations);
  return {
    ...order,
    kitchen_guest_name: context.guestName,
    kitchen_item_count: context.itemCount,
    kitchen_reservation_number: context.reservationNumber,
    kitchen_room_number: context.roomNumber,
    kitchen_source: context.source,
    kitchen_total: context.total,
  };
}

function nextKitchenStatus(status: string) {
  const normalized = normalizeKitchenStatus(status);
  if (['received', 'pending'].includes(normalized)) {
    return kitchenStatusOptions.find(option => option.value === 'preparing') ?? null;
  }
  if (normalized === 'preparing') {
    return kitchenStatusOptions.find(option => option.value === 'ready') ?? null;
  }
  if (normalized === 'ready') {
    return kitchenStatusOptions.find(option => option.value === 'delivered') ?? null;
  }
  if (normalized === 'delivered') {
    return kitchenStatusOptions.find(option => option.value === 'served') ?? null;
  }
  return null;
}

function kitchenQuickButtonTone(status: string) {
  const normalized = normalizeKitchenStatus(status);
  if (normalized === 'preparing') {
    return styles.kitchenQuickButtonOrange;
  }
  if (['ready', 'served'].includes(normalized)) {
    return styles.kitchenQuickButtonGreen;
  }
  if (normalized === 'billed') {
    return styles.kitchenQuickButtonGray;
  }
  if (normalized === 'cancelled') {
    return styles.kitchenQuickButtonRed;
  }
  return styles.kitchenQuickButtonBlue;
}

function kitchenOrderActions(
  order: ArcadiaRecord,
  onQuickRecordAction: ActionHandler,
) {
  const currentStatus = normalizeKitchenStatus(firstRecordValue(order, ['status']));
  return kitchenStatusOptions
    .filter(option => normalizeKitchenStatus(option.value) !== currentStatus)
    .map(option => ({
      label: option.value === 'cancelled' ? 'Cancel Order' : `Move to ${option.label}`,
      onPress: () => onQuickRecordAction('orders', order, option.value),
      tone: option.tone,
    }));
}

export function KitchenScreen({
  error,
  guests,
  hotelId,
  loading,
  loadingProcesses,
  orders,
  request,
  reservations,
  rooms,
  onBack,
  onMenu,
  onOpenNotifications,
  onQuickRecordAction,
  onRefresh,
}: {
  error: string | null;
  guests: ArcadiaRecord[];
  hotelId: string;
  loading: boolean;
  loadingProcesses: string[];
  orders: ArcadiaRecord[];
  request: RequestFn;
  reservations: ReservationView[];
  rooms: ArcadiaRecord[];
  onBack: () => void;
  onMenu: () => void;
  onOpenNotifications: () => void;
  onQuickRecordAction: ActionHandler;
  onRefresh: () => void;
}) {
  const [filter, setFilter] = useState('All');
  const [query, setQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<ArcadiaRecord | null>(null);
  const [orderDetail, setOrderDetail] = useState<KitchenOrderDetailPayload | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const enrichedOrders = useMemo(
    () => orders.map(order => enrichKitchenOrderForSearch(order, guests, rooms, reservations)),
    [guests, orders, reservations, rooms],
  );
  const filteredOrders = useMemo(
    () => filterRecordsBySearch(filterRecordsByStatus(enrichedOrders, filter), query),
    [enrichedOrders, filter, query],
  );
  const {hasMore, loadMore, visibleItems} = useScrollPagination(filteredOrders);

  const openOrderDetail = useCallback(
    async (order: ArcadiaRecord) => {
      const orderId = firstRecordValue(order, ['id', 'order_id']);
      setSelectedOrder(order);
      setOrderDetail(null);
      setDetailError(null);
      if (!orderId) {
        setDetailError('This order is missing an id, so detail cannot be loaded.');
        return;
      }

      setDetailLoading(true);
      try {
        const payload = await request<KitchenOrderDetailPayload>(
          `/api/v1/hotels/${hotelId}/restaurant/orders/${orderId}`,
        );
        setOrderDetail(payload.data ?? null);
      } catch (nextError) {
        setDetailError(formatErrorDetails(nextError, 'Unable to load order detail.'));
      } finally {
        setDetailLoading(false);
      }
    },
    [hotelId, request],
  );

  const closeOrderDetail = useCallback(() => {
    setSelectedOrder(null);
    setOrderDetail(null);
    setDetailError(null);
  }, []);

  const refreshSelectedOrder = useCallback(() => {
    if (selectedOrder) {
      openOrderDetail(selectedOrder);
    }
  }, [openOrderDetail, selectedOrder]);

  const detailOrder = selectedOrder
    ? {
        ...selectedOrder,
        ...(orderDetail?.order ?? {}),
      }
    : null;

  if (detailOrder) {
    return (
      <KitchenOrderDetailView
        detailError={detailError}
        detailLoading={detailLoading}
        guests={guests}
        hotelId={hotelId}
        items={orderDetail?.items ?? []}
        loading={loading}
        loadingProcesses={loadingProcesses}
        order={detailOrder}
        request={request}
        reservations={reservations}
        rooms={rooms}
        onBack={closeOrderDetail}
        onMenu={onMenu}
        onOpenNotifications={onOpenNotifications}
        onQuickRecordAction={onQuickRecordAction}
        onRefresh={refreshSelectedOrder}
        onRefreshOrders={onRefresh}
      />
    );
  }

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
            labels={kitchenFilterLabels}
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
        const statusLabel = kitchenStatusLabel(status);
        const context = buildKitchenOrderContext(item, guests, rooms, reservations);
        const nextStatus = nextKitchenStatus(status);
        return (
          <Pressable
            style={styles.kitchenOrderCard}
            onPress={() => openOrderDetail(item)}>
            <View style={styles.rowBetween}>
              <View style={styles.kitchenCardTitleBlock}>
                <Text style={styles.ticketCode}>
                  {firstRecordValue(item, ['order_number', 'id'])}
                </Text>
                <Text numberOfLines={1} style={styles.ticketTitle}>
                  {context.guestName}
                </Text>
                <Text numberOfLines={1} style={styles.cardSubtitle}>
                  {context.roomNumber} - {context.source}
                </Text>
              </View>
              <View style={styles.ticketCardActions}>
                <StatusBadge label={statusLabel} tone={statusTone(status)} />
                <ActionMenu
                  items={kitchenOrderActions(item, onQuickRecordAction)}
                />
              </View>
            </View>
            <View style={styles.kitchenMetaGrid}>
              <KitchenMetaTile label="Room" value={context.roomNumber} />
              <KitchenMetaTile label="Reservation" value={context.reservationNumber} />
              <KitchenMetaTile label="Items" value={context.itemCount} />
              <KitchenMetaTile label="Total" value={context.total} />
            </View>
            {context.createdAt || context.takenBy ? (
              <Text style={styles.caption}>
                {context.createdAt || 'No time'} {context.takenBy ? `- ${context.takenBy}` : ''}
              </Text>
            ) : null}
            {firstRecordValue(item, ['special_instructions', 'instructions']) ? (
              <Text style={styles.caption}>
                {firstRecordValue(item, ['special_instructions', 'instructions'])}
              </Text>
            ) : null}
            <View style={styles.kitchenActionRow}>
              <Pressable
                style={[styles.kitchenSecondaryButton, styles.kitchenDetailButton]}
                onPress={() => openOrderDetail(item)}>
                <Text
                  style={[
                    styles.kitchenSecondaryButtonText,
                    styles.kitchenDetailButtonText,
                  ]}>
                  View Detail
                </Text>
              </Pressable>
              {nextStatus ? (
                <Pressable
                  style={[
                    styles.kitchenQuickButton,
                    kitchenQuickButtonTone(nextStatus.value),
                  ]}
                  onPress={() => onQuickRecordAction('orders', item, nextStatus.value)}>
                  <Text style={styles.kitchenQuickButtonText}>
                    Move to {nextStatus.label}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </Pressable>
        );
      }}
      />
    </View>
  );
}

function KitchenMetaTile({label, value}: {label: string; value: string}) {
  return (
    <View style={styles.kitchenMetaTile}>
      <Text style={styles.kitchenMetaLabel}>{label}</Text>
      <Text numberOfLines={2} style={styles.kitchenMetaValue}>
        {value || '-'}
      </Text>
    </View>
  );
}

function KitchenOrderDetailView({
  detailError,
  detailLoading,
  guests,
  hotelId,
  items,
  loading,
  loadingProcesses,
  order,
  request,
  reservations,
  rooms,
  onBack,
  onMenu,
  onOpenNotifications,
  onQuickRecordAction,
  onRefresh,
  onRefreshOrders,
}: {
  detailError: string | null;
  detailLoading: boolean;
  guests: ArcadiaRecord[];
  hotelId: string;
  items: ArcadiaRecord[];
  loading: boolean;
  loadingProcesses: string[];
  order: ArcadiaRecord;
  request: RequestFn;
  reservations: ReservationView[];
  rooms: ArcadiaRecord[];
  onBack: () => void;
  onMenu: () => void;
  onOpenNotifications: () => void;
  onQuickRecordAction: ActionHandler;
  onRefresh: () => void | Promise<void>;
  onRefreshOrders: () => void;
}) {
  const status = firstRecordValue(order, ['status']);
  const statusLabel = kitchenStatusLabel(status);
  const context = buildKitchenOrderContext(order, guests, rooms, reservations, items);
  const nextStatus = nextKitchenStatus(status);
  const instructions = firstRecordValue(order, ['special_instructions', 'instructions']);
  const folioId = firstRecordValue(order, ['folio_id']);
  const initialFolioLabel = firstRecordValue(order, ['folio_number']) || folioId;
  const orderId = firstRecordValue(order, ['id', 'order_id']);
  const [menuItems, setMenuItems] = useState<MenuItemRecord[]>([]);
  const [folioLabel, setFolioLabel] = useState(initialFolioLabel);
  const [actionError, setActionError] = useState<string | null>(null);
  const [orderForm, setOrderForm] = useState<KitchenOrderFormState>({
    orderedByGuest: false,
    source: '',
    specialInstructions: '',
    status: '',
    tableId: '',
    tax: '',
  });
  const [itemForm, setItemForm] = useState<KitchenOrderItemFormState>({
    index: null,
    menuItemId: '',
    notes: '',
    quantity: '1',
    unitPrice: '',
  });
  const [orderFormVisible, setOrderFormVisible] = useState(false);
  const [itemFormVisible, setItemFormVisible] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadMenuItems = useCallback(async () => {
    try {
      const payload = await request<MenuItemRecord[]>(
        `/api/v1/hotels/${hotelId}/menu/items`,
      );
      setMenuItems(sortMenuRecords(Array.isArray(payload.data) ? payload.data : []));
    } catch (nextError) {
      setActionError(formatErrorDetails(nextError, 'Unable to load menu items.'));
    }
  }, [hotelId, request]);

  useEffect(() => {
    loadMenuItems();
  }, [loadMenuItems]);

  useEffect(() => {
    let active = true;
    setFolioLabel(initialFolioLabel);
    if (!folioId) {
      return () => {
        active = false;
      };
    }

    request<FolioDetailPayload>(`/api/v1/hotels/${hotelId}/folios/${folioId}`)
      .then(payload => {
        if (!active) {
          return;
        }
        const folio = payload.data?.folio;
        setFolioLabel(
          firstRecordValue(folio, ['folio_number', 'number', 'name']) || initialFolioLabel,
        );
      })
      .catch(() => {
        if (active) {
          setFolioLabel(initialFolioLabel);
        }
      });

    return () => {
      active = false;
    };
  }, [folioId, hotelId, initialFolioLabel, request]);

  function openEditOrderForm() {
    setFormError(null);
    setOrderForm({
      orderedByGuest: kitchenRecordBool(order, 'ordered_by_guest', false),
      source: firstRecordValue(order, ['source', 'order_source']) || 'pos',
      specialInstructions: firstRecordValue(order, [
        'special_instructions',
        'instructions',
      ]),
      status: firstRecordValue(order, ['status']),
      tableId: firstRecordValue(order, ['table_id']),
      tax: firstRecordValue(order, ['tax', 'tax_amount']) || '0',
    });
    setOrderFormVisible(true);
  }

  function openAddItemForm() {
    const firstItem = menuItems[0];
    setFormError(null);
    setItemForm({
      index: null,
      menuItemId: firstRecordValue(firstItem, ['id']),
      notes: '',
      quantity: '1',
      unitPrice: firstRecordValue(firstItem, ['price']),
    });
    setItemFormVisible(true);
  }

  function openEditItemForm(item: ArcadiaRecord, index: number) {
    setFormError(null);
    setItemForm(orderItemFormFromRecord(item, index));
    setItemFormVisible(true);
  }

  async function refreshAfterSave() {
    await Promise.resolve(onRefresh());
    onRefreshOrders();
  }

  async function submitOrderForm() {
    if (!orderId) {
      setFormError('This order is missing an id.');
      return;
    }
    const tax = Number(orderForm.tax || 0);
    if (Number.isNaN(tax) || tax < 0) {
      setFormError('Enter a valid tax amount.');
      return;
    }

    setSubmitting(true);
    setFormError(null);
    setActionError(null);
    try {
      await request<ArcadiaRecord>(
        `/api/v1/hotels/${hotelId}/restaurant/orders/${orderId}`,
        {
          method: 'PATCH',
          body: JSON.stringify(
            compactPayload({
              ordered_by_guest: orderForm.orderedByGuest,
              source: orderForm.source.trim() || undefined,
              special_instructions:
                orderForm.specialInstructions.trim() || undefined,
              status: orderForm.status.trim() || undefined,
              table_id: orderForm.tableId.trim() || undefined,
              tax: tax.toFixed(2),
            }),
          ),
        },
      );
      setOrderFormVisible(false);
      await refreshAfterSave();
    } catch (nextError) {
      setFormError(formatErrorDetails(nextError, 'Unable to update order.'));
    } finally {
      setSubmitting(false);
    }
  }

  async function saveOrderItems(nextItems: Record<string, unknown>[]) {
    if (!orderId) {
      setActionError('This order is missing an id.');
      return;
    }
    setSubmitting(true);
    setFormError(null);
    setActionError(null);
    try {
      await request<ArcadiaRecord>(
        `/api/v1/hotels/${hotelId}/restaurant/orders/${orderId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({items: nextItems}),
        },
      );
      setItemFormVisible(false);
      await refreshAfterSave();
    } catch (nextError) {
      const message = formatErrorDetails(nextError, 'Unable to update order items.');
      if (itemFormVisible) {
        setFormError(message);
      } else {
        setActionError(message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function submitItemForm() {
    if (!itemForm.menuItemId) {
      setFormError('Choose a menu item.');
      return;
    }
    const quantity = Number(itemForm.quantity);
    if (Number.isNaN(quantity) || quantity <= 0) {
      setFormError('Enter a valid quantity.');
      return;
    }
    const unitPrice = Number(itemForm.unitPrice);
    if (itemForm.unitPrice.trim() && (Number.isNaN(unitPrice) || unitPrice < 0)) {
      setFormError('Enter a valid unit price.');
      return;
    }

    const nextItem = orderItemPayloadFromForm(itemForm);
    const nextItems = items.map(orderItemPayloadFromRecord);
    if (itemForm.index === null) {
      nextItems.push(nextItem);
    } else {
      nextItems[itemForm.index] = nextItem;
    }
    await saveOrderItems(nextItems);
  }

  async function removeOrderItem(index: number) {
    const nextItems = items
      .map(orderItemPayloadFromRecord)
      .filter((_, itemIndex) => itemIndex !== index);
    await saveOrderItems(nextItems);
  }

  return (
    <View style={styles.screen}>
      <View style={styles.staticTopAppBar}>
        <TopAppBar
          title="Kitchen Order"
          leftIcon={ChevronLeft}
          onLeftPress={onBack}
          rightIcon={Menu}
          notificationIcon={Bell}
          onRightPress={onMenu}
          onNotificationPress={onOpenNotifications}
        />
      </View>
      <LoadingProcessCard
        active={loading || detailLoading}
        floating
        label="Loading order detail"
        processes={detailLoading ? ['Loading order detail'] : loadingProcesses}
      />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.screenContent}
        refreshControl={
          <RefreshControl
            refreshing={detailLoading}
            onRefresh={() => {
              onRefresh();
            }}
          />
        }>
        <ErrorNotice
          message={detailError || actionError}
          onRetry={() => {
            onRefresh();
          }}
        />
        <View style={styles.kitchenDetailHeader}>
          <View style={styles.kitchenCardTitleBlock}>
            <Text style={styles.captionUpper}>Order</Text>
            <Text style={styles.kitchenDetailTitle}>
              {firstRecordValue(order, ['order_number', 'id'])}
            </Text>
            <Text style={styles.cardSubtitle}>
              {context.guestName} - {context.roomNumber}
            </Text>
          </View>
          <View style={styles.ticketCardActions}>
            <StatusBadge label={statusLabel} tone={statusTone(status)} />
            <ActionMenu
              items={[
                {label: 'Edit Order', onPress: openEditOrderForm},
                ...kitchenOrderActions(order, onQuickRecordAction),
              ]}
            />
          </View>
        </View>

        <View style={styles.kitchenDetailActionRow}>
          {nextStatus ? (
            <Pressable
              style={[
                styles.kitchenQuickButton,
                kitchenQuickButtonTone(nextStatus.value),
              ]}
              onPress={() => onQuickRecordAction('orders', order, nextStatus.value)}>
              <Text style={styles.kitchenQuickButtonText}>
                Move to {nextStatus.label}
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            style={[styles.kitchenSecondaryButton, styles.kitchenDetailButton]}
            onPress={openEditOrderForm}>
            <Text
              style={[
                styles.kitchenSecondaryButtonText,
                styles.kitchenDetailButtonText,
              ]}>
              Edit Order
            </Text>
          </Pressable>
        </View>

        <View style={styles.kitchenDetailCard}>
          <InfoLine label="Guest" value={context.guestName} />
          <InfoLine label="Room" value={context.roomNumber} />
          <InfoLine label="Reservation" value={context.reservationNumber || '-'} />
          <InfoLine label="Source" value={context.source} />
          <InfoLine label="Table" value={context.table || '-'} />
          <InfoLine label="Ordered by guest" value={context.orderedByGuest || '-'} />
          <InfoLine label="Taken by" value={context.takenBy || '-'} />
          <InfoLine label="Ticket" value={context.ticket || '-'} />
          <InfoLine label="Folio" value={folioLabel || '-'} />
          <InfoLine label="Created" value={context.createdAt || '-'} />
          <InfoLine label="Completed" value={context.completedAt || '-'} />
        </View>

        <View style={styles.kitchenDetailCard}>
          <InfoLine label="Subtotal" value={context.subtotal || '-'} />
          <InfoLine label="Tax" value={context.tax || '-'} />
          <InfoLine label="Total" value={context.total || '-'} />
          <InfoLine label="Total items" value={context.itemCount || String(items.length)} />
        </View>

        {instructions ? (
          <View style={styles.kitchenDetailCard}>
            <Text style={styles.captionUpper}>Instructions</Text>
            <Text style={styles.kitchenDetailText}>{instructions}</Text>
          </View>
        ) : null}

        <View style={styles.kitchenSectionHeader}>
          <SectionTitle title="Items" badge={context.itemCount || String(items.length)} />
          <Pressable style={styles.kitchenAddItemButton} onPress={openAddItemForm}>
            <Plus color="#FFFFFF" size={15} strokeWidth={2.2} />
            <Text style={styles.kitchenAddItemText}>Add Item</Text>
          </Pressable>
        </View>
        <View style={styles.kitchenDetailCard}>
          {detailLoading ? (
            <Text style={styles.caption}>Loading item rows...</Text>
          ) : items.length ? (
            items.map((item, index) => {
              const itemName = menuItemLabel(item, menuItems);
              const quantity = firstRecordValue(item, ['quantity', 'qty']) || '1';
              const unitPrice = formatKitchenMoney(firstRecordValue(item, ['unit_price', 'price']));
              const itemTotal = formatKitchenMoney(firstRecordValue(item, ['item_total', 'total']));
              return (
                <View key={`${firstRecordValue(item, ['id', 'menu_item_id'])}-${index}`} style={styles.kitchenLineItem}>
                  <View style={styles.kitchenLineItemText}>
                    <Text numberOfLines={2} style={styles.cardTitle}>
                      {itemName}
                    </Text>
                    <Text style={styles.caption}>
                      Qty {quantity}{unitPrice ? ` - ${unitPrice} each` : ''}
                    </Text>
                    {firstRecordValue(item, ['notes']) ? (
                      <Text style={styles.caption}>{firstRecordValue(item, ['notes'])}</Text>
                    ) : null}
                  </View>
                  <View style={styles.kitchenLineItemMeta}>
                    {firstRecordValue(item, ['status']) ? (
                      <StatusBadge
                        label={kitchenStatusLabel(firstRecordValue(item, ['status']))}
                        tone={statusTone(firstRecordValue(item, ['status']))}
                      />
                    ) : null}
                    <Text style={styles.kitchenLineItemTotal}>{itemTotal || '-'}</Text>
                    <ActionMenu
                      items={[
                        {label: 'Edit Item', onPress: () => openEditItemForm(item, index)},
                        {
                          label: 'Remove Item',
                          tone: 'danger',
                          onPress: () => {
                            removeOrderItem(index);
                          },
                        },
                      ]}
                    />
                  </View>
                </View>
              );
            })
          ) : (
            <EmptyState label="No item rows returned for this order." />
          )}
        </View>
      </ScrollView>
      <KitchenOrderFormSheet
        error={formError}
        form={orderForm}
        submitting={submitting}
        visible={orderFormVisible}
        onChange={next => setOrderForm(current => ({...current, ...next}))}
        onClose={() => setOrderFormVisible(false)}
        onSubmit={submitOrderForm}
      />
      <KitchenOrderItemFormSheet
        error={formError}
        form={itemForm}
        menuItems={menuItems}
        submitting={submitting}
        visible={itemFormVisible}
        onChange={next => setItemForm(current => ({...current, ...next}))}
        onClose={() => setItemFormVisible(false)}
        onSubmit={submitItemForm}
      />
    </View>
  );
}

function KitchenOrderFormSheet({
  error,
  form,
  submitting,
  visible,
  onChange,
  onClose,
  onSubmit,
}: {
  error: string | null;
  form: KitchenOrderFormState;
  submitting: boolean;
  visible: boolean;
  onChange: (next: Partial<KitchenOrderFormState>) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.relationPickerBackdrop}>
        <View style={styles.menuFormSheet}>
          <View style={styles.quickDrawerHandle} />
          <Text style={styles.relationPickerTitle}>Edit order</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            <FormError message={error} />
            <View style={styles.dualFieldRow}>
              <MenuFormField label="Source">
                <TextInput
                  autoCapitalize="none"
                  placeholder="pos"
                  placeholderTextColor="#94A3B8"
                  style={styles.formInput}
                  value={form.source}
                  onChangeText={value => onChange({source: value})}
                />
              </MenuFormField>
              <MenuFormField label="Table">
                <TextInput
                  autoCapitalize="none"
                  placeholder="Table id"
                  placeholderTextColor="#94A3B8"
                  style={styles.formInput}
                  value={form.tableId}
                  onChangeText={value => onChange({tableId: value})}
                />
              </MenuFormField>
            </View>
            <MenuFormField label="Status">
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.optionWrap}>
                {kitchenStatusOptions.map(option => {
                  const active =
                    normalizeKitchenStatus(form.status) ===
                    normalizeKitchenStatus(option.value);
                  return (
                    <Pressable
                      key={option.value}
                      style={[styles.optionPill, active && styles.activeOptionPill]}
                      onPress={() => onChange({status: option.value})}>
                      <Text
                        style={[
                          styles.optionPillText,
                          active && styles.activeOptionPillText,
                        ]}>
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </MenuFormField>
            <MenuFormField label="Tax">
              <TextInput
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor="#94A3B8"
                style={styles.formInput}
                value={form.tax}
                onChangeText={value => onChange({tax: value})}
              />
            </MenuFormField>
            <MenuFormField label="Instructions">
              <TextInput
                multiline
                placeholder="Kitchen notes"
                placeholderTextColor="#94A3B8"
                style={[styles.formInput, styles.formInputMultiline]}
                value={form.specialInstructions}
                onChangeText={value => onChange({specialInstructions: value})}
              />
            </MenuFormField>
            <MenuFormField label="Guest order">
              <ToggleField
                active={form.orderedByGuest}
                label={form.orderedByGuest ? 'Ordered by guest' : 'Staff entered'}
                onPress={() => onChange({orderedByGuest: !form.orderedByGuest})}
              />
            </MenuFormField>
          </ScrollView>
          <View style={styles.menuFormActions}>
            <Pressable style={styles.menuFormSecondaryButton} onPress={onClose}>
              <Text style={styles.menuFormSecondaryText}>Cancel</Text>
            </Pressable>
            <Pressable
              disabled={submitting}
              style={[styles.menuFormPrimaryButton, submitting && styles.disabledActionButton]}
              onPress={onSubmit}>
              <Text style={styles.menuFormPrimaryText}>{submitting ? 'Saving...' : 'Done'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function KitchenOrderItemFormSheet({
  error,
  form,
  menuItems,
  submitting,
  visible,
  onChange,
  onClose,
  onSubmit,
}: {
  error: string | null;
  form: KitchenOrderItemFormState;
  menuItems: MenuItemRecord[];
  submitting: boolean;
  visible: boolean;
  onChange: (next: Partial<KitchenOrderItemFormState>) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const selectedItem = menuItems.find(item => firstRecordValue(item, ['id']) === form.menuItemId);
  const selectedTitle =
    firstRecordValue(selectedItem, ['name']) ||
    (form.menuItemId ? `Menu item ${form.menuItemId}` : '');
  const selectedSubtitle = selectedItem
    ? [
        formatKitchenMoney(firstRecordValue(selectedItem, ['price'])),
        firstRecordValue(selectedItem, ['category_name', 'category_id']),
      ].filter(Boolean).join(' - ')
    : '';
  const [pickerOpen, setPickerOpen] = useState(false);

  function selectMenuItem(item: MenuItemRecord) {
    onChange({
      menuItemId: firstRecordValue(item, ['id']),
      unitPrice: firstRecordValue(item, ['price']) || form.unitPrice,
    });
    setPickerOpen(false);
  }

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.relationPickerBackdrop}>
        <View style={styles.menuFormSheet}>
          <View style={styles.quickDrawerHandle} />
          <Text style={styles.relationPickerTitle}>
            {form.index === null ? 'Add item' : 'Edit item'}
          </Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            <FormError message={error} />
            <MenuFormField label="Menu item">
              <Pressable
                style={styles.lookupInputButton}
                onPress={() => setPickerOpen(true)}>
                <View style={styles.lookupInputTextBlock}>
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.lookupInputText,
                      !selectedTitle && styles.lookupPlaceholderText,
                    ]}>
                    {selectedTitle || 'Search and select menu item'}
                  </Text>
                  {selectedSubtitle ? (
                    <Text numberOfLines={1} style={styles.captionTiny}>
                      {selectedSubtitle}
                    </Text>
                  ) : null}
                </View>
                <ChevronRight color="#94A3B8" size={18} strokeWidth={2.2} />
              </Pressable>
            </MenuFormField>
            <View style={styles.dualFieldRow}>
              <MenuFormField label="Quantity">
                <TextInput
                  keyboardType="number-pad"
                  placeholder="1"
                  placeholderTextColor="#94A3B8"
                  style={styles.formInput}
                  value={form.quantity}
                  onChangeText={value => onChange({quantity: value})}
                />
              </MenuFormField>
              <MenuFormField label="Unit price">
                <TextInput
                  keyboardType="decimal-pad"
                  placeholder="Menu price"
                  placeholderTextColor="#94A3B8"
                  style={styles.formInput}
                  value={form.unitPrice}
                  onChangeText={value => onChange({unitPrice: value})}
                />
              </MenuFormField>
            </View>
            <MenuFormField label="Notes">
              <TextInput
                multiline
                placeholder="Preparation notes"
                placeholderTextColor="#94A3B8"
                style={[styles.formInput, styles.formInputMultiline]}
                value={form.notes}
                onChangeText={value => onChange({notes: value})}
              />
            </MenuFormField>
          </ScrollView>
          <View style={styles.menuFormActions}>
            <Pressable style={styles.menuFormSecondaryButton} onPress={onClose}>
              <Text style={styles.menuFormSecondaryText}>Cancel</Text>
            </Pressable>
            <Pressable
              disabled={submitting}
              style={[styles.menuFormPrimaryButton, submitting && styles.disabledActionButton]}
              onPress={onSubmit}>
              <Text style={styles.menuFormPrimaryText}>{submitting ? 'Saving...' : 'Done'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
      <MenuItemRelationPicker
        menuItems={menuItems}
        selectedMenuItemId={form.menuItemId}
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={selectMenuItem}
      />
    </Modal>
  );
}

function MenuItemRelationPicker({
  menuItems,
  selectedMenuItemId,
  visible,
  onClose,
  onSelect,
}: {
  menuItems: MenuItemRecord[];
  selectedMenuItemId: string;
  visible: boolean;
  onClose: () => void;
  onSelect: (item: MenuItemRecord) => void;
}) {
  const [query, setQuery] = useState('');
  const filteredItems = useMemo(
    () => filterRecordsBySearch(menuItems, query),
    [menuItems, query],
  );
  const {hasMore, loadMore, visibleItems} = useScrollPagination(filteredItems, 24);

  useEffect(() => {
    if (!visible) {
      setQuery('');
    }
  }, [visible]);

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.relationPickerBackdrop} onPress={onClose}>
        <Pressable style={styles.relationPickerSheet}>
          <View style={styles.quickDrawerHandle} />
          <View style={styles.relationPickerHeader}>
            <Text style={styles.relationPickerTitle}>Select menu item</Text>
            <Pressable style={styles.popupCloseButton} onPress={onClose}>
              <Text style={styles.popupCloseText}>x</Text>
            </Pressable>
          </View>
          <TextInput
            autoFocus
            placeholder="Type item name, price, category..."
            placeholderTextColor="#94A3B8"
            style={styles.formInput}
            value={query}
            onChangeText={setQuery}
          />
          <ScrollView
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            showsVerticalScrollIndicator
            style={styles.relationPickerList}
            onScroll={handleScrollLoadMore(loadMore)}
            scrollEventThrottle={16}>
            {visibleItems.length ? (
              visibleItems.map((item, index) => {
                const itemId = firstRecordValue(item, ['id']);
                const active = selectedMenuItemId === itemId;
                const itemName = firstRecordValue(item, ['name']) || 'Untitled item';
                const subtitle = [
                  formatKitchenMoney(firstRecordValue(item, ['price'])),
                  firstRecordValue(item, ['category_name', 'category_id']),
                  firstRecordValue(item, ['description_short', 'description']),
                ].filter(Boolean).join(' - ');
                return (
                  <Pressable
                    key={`${itemId || itemName}-${index}`}
                    style={[
                      styles.lookupOption,
                      active && styles.activeRelationOption,
                    ]}
                    onPress={() => onSelect(item)}>
                    <Text style={styles.lookupTitle}>{itemName}</Text>
                    {subtitle ? <Text style={styles.captionTiny}>{subtitle}</Text> : null}
                  </Pressable>
                );
              })
            ) : (
              <Text style={styles.lookupEmpty}>
                {menuItems.length ? 'No matching menu items' : 'No menu items loaded yet'}
              </Text>
            )}
            <Text style={styles.lookupEmpty}>
              {hasMore ? 'Scroll for more menu items' : 'All matching menu items loaded'}
            </Text>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

type DepartmentOption = {
  id: string;
  label: string;
};

type HierarchyStaffNode = {
  id: string;
  name?: string | null;
  staff_level?: string | null;
  reports_to?: string | null;
  on_shift?: boolean | string | number | null;
  open_tickets?: number | string | null;
};

type HierarchySupervisorNode = HierarchyStaffNode & {
  attendants?: HierarchyStaffNode[];
};

type DepartmentHierarchyPayload = {
  department?: string;
  manager?: HierarchyStaffNode | null;
  supervisors?: HierarchySupervisorNode[];
  attendants?: HierarchyStaffNode[];
};

function titleFromKey(value: string) {
  return value
    .replaceAll('_', ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function toDepartmentOptions(records: ArcadiaRecord[]) {
  return records
    .map(record => {
      const id = firstRecordValue(record, ['id', 'department_id']);
      const label = firstRecordValue(record, ['name', 'department_name', 'key']) || id;
      const activeValue = firstRecordValue(record, ['is_active', 'status']).toLowerCase();
      return {
        active: activeValue ? !['false', '0', 'inactive', 'archived'].includes(activeValue) : true,
        id,
        label,
      };
    })
    .filter(option => option.id && option.label && option.active)
    .map(({id, label}) => ({id, label}));
}

function hierarchyOnShift(node: HierarchyStaffNode) {
  if (typeof node.on_shift === 'boolean') {
    return node.on_shift;
  }
  return ['true', '1', 'yes', 'on'].includes(String(node.on_shift ?? '').toLowerCase());
}

function hierarchyOpenTickets(node: HierarchyStaffNode) {
  const value = Number(node.open_tickets ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function hierarchyStaffName(node: HierarchyStaffNode) {
  return String(node.name ?? '').trim() || 'Unnamed staff';
}

function hierarchyStaffRole(node: HierarchyStaffNode, fallback: string) {
  return titleFromKey(String(node.staff_level || fallback));
}

function hierarchyStaffNodes(data: DepartmentHierarchyPayload | null) {
  const nodes: HierarchyStaffNode[] = [];
  if (!data) {
    return nodes;
  }
  if (data.manager) {
    nodes.push(data.manager);
  }
  (data.supervisors ?? []).forEach(supervisor => {
    nodes.push(supervisor);
    nodes.push(...(supervisor.attendants ?? []));
  });
  nodes.push(...(data.attendants ?? []));
  return nodes;
}

function HierarchyNodeCard({
  children,
  node,
  role,
}: {
  children?: ReactNode;
  node: HierarchyStaffNode;
  role: string;
}) {
  const name = hierarchyStaffName(node);
  const onShift = hierarchyOnShift(node);
  const openTickets = hierarchyOpenTickets(node);
  return (
    <View style={[styles.hierarchyNodeCard, role === 'manager' && styles.hierarchyManagerCard]}>
      <View style={styles.hierarchyNodeHeader}>
        <Avatar label={name.charAt(0)} size={42} />
        <View style={styles.hierarchyNodeText}>
          <Text style={styles.cardTitle}>{name}</Text>
          <Text style={styles.caption}>{hierarchyStaffRole(node, role)}</Text>
        </View>
        <View style={styles.hierarchyNodeBadges}>
          <StatusBadge label={onShift ? 'On shift' : 'Off shift'} tone={onShift ? 'green' : 'gray'} />
          <StatusBadge
            label={`${openTickets} open`}
            tone={openTickets > 0 ? 'orange' : 'green'}
          />
        </View>
      </View>
      {children}
    </View>
  );
}

export function HierarchyScreen({
  error,
  hotelId,
  loading,
  loadingProcesses,
  request,
  userDepartmentId,
  onBack,
  onMenu,
  onOpenNotifications,
  onRefresh,
}: {
  error: string | null;
  hotelId: string;
  loading: boolean;
  loadingProcesses: string[];
  request: RequestFn;
  userDepartmentId: string;
  onBack: () => void;
  onMenu: () => void;
  onOpenNotifications: () => void;
  onRefresh: () => void;
}) {
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [hierarchy, setHierarchy] = useState<DepartmentHierarchyPayload | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [localLoading, setLocalLoading] = useState(false);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState(userDepartmentId);

  const selectedDepartment = departments.find(item => item.id === selectedDepartmentId);
  const selectedDepartmentLabel =
    selectedDepartment?.label || hierarchy?.department || (selectedDepartmentId ? 'My department' : 'Department');
  const nodes = useMemo(() => hierarchyStaffNodes(hierarchy), [hierarchy]);
  const totalStaff = nodes.length;
  const onShift = nodes.filter(hierarchyOnShift).length;
  const openTickets = nodes.reduce((sum, node) => sum + hierarchyOpenTickets(node), 0);

  const loadDepartments = useCallback(async () => {
    setLocalLoading(true);
    try {
      const result = await request<ArcadiaRecord[]>(`/api/v1/hotels/${hotelId}/departments`);
      const nextDepartments = toDepartmentOptions(Array.isArray(result.data) ? result.data : []);
      setDepartments(nextDepartments);
      setSelectedDepartmentId(current => current || userDepartmentId || nextDepartments[0]?.id || '');
      setInlineError(null);
    } catch (nextError) {
      const details = formatErrorDetails(nextError, 'Departments failed');
      setInlineError(details);
      if (userDepartmentId) {
        setSelectedDepartmentId(current => current || userDepartmentId);
      }
    } finally {
      setLocalLoading(false);
    }
  }, [hotelId, request, userDepartmentId]);

  const loadHierarchy = useCallback(async () => {
    if (!selectedDepartmentId) {
      setHierarchy(null);
      return;
    }
    setLocalLoading(true);
    try {
      const result = await request<DepartmentHierarchyPayload>(
        `/api/v1/hotels/${hotelId}/departments/${selectedDepartmentId}/hierarchy`,
      );
      setHierarchy(result.data ?? null);
      setInlineError(null);
    } catch (nextError) {
      setHierarchy(null);
      setInlineError(formatErrorDetails(nextError, 'Hierarchy failed'));
    } finally {
      setLocalLoading(false);
    }
  }, [hotelId, request, selectedDepartmentId]);

  useEffect(() => {
    loadDepartments();
  }, [loadDepartments]);

  useEffect(() => {
    loadHierarchy();
  }, [loadHierarchy]);

  function refreshHierarchy() {
    onRefresh();
    loadDepartments();
    loadHierarchy();
  }

  const supervisors = hierarchy?.supervisors ?? [];
  const directAttendants = hierarchy?.attendants ?? [];
  const combinedError = [error, inlineError].filter(Boolean).join('\n') || null;

  return (
    <View style={styles.screen}>
      <View style={styles.staticTopAppBar}>
        <TopAppBar
          title="Hierarchy"
          leftIcon={ChevronLeft}
          onLeftPress={onBack}
          rightIcon={Menu}
          notificationIcon={Bell}
          onRightPress={onMenu}
          onNotificationPress={onOpenNotifications}
        />
      </View>
      <LoadingProcessCard
        active={loading || localLoading}
        floating
        label="Loading hierarchy"
        processes={loadingProcesses}
      />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.screenContent}
        refreshControl={<RefreshControl refreshing={loading || localLoading} onRefresh={refreshHierarchy} />}>
        <ErrorNotice message={combinedError} onRetry={refreshHierarchy} />
        <View style={styles.staffSummaryGrid}>
          <MetricTile label="Total Staff" value={totalStaff} tone="blue" />
          <MetricTile label="On Shift" value={onShift} tone="green" />
          <MetricTile label="Open Tickets" value={openTickets} tone="orange" />
        </View>
        {departments.length ? (
          <ChipRow
            labels={departments.map(item => item.label)}
            activeLabel={selectedDepartmentLabel}
            onSelect={label => {
              const nextDepartment = departments.find(item => item.label === label);
              if (nextDepartment) {
                setSelectedDepartmentId(nextDepartment.id);
              }
            }}
          />
        ) : null}
        <SectionTitle title={selectedDepartmentLabel} />
        {hierarchy?.manager ? (
          <HierarchyNodeCard node={hierarchy.manager} role="manager" />
        ) : null}

        {supervisors.length ? (
          <>
            <SectionTitle title="Supervisors" />
            <View style={styles.cardStack}>
              {supervisors.map(supervisor => (
                <HierarchyNodeCard key={supervisor.id} node={supervisor} role="supervisor">
                  {supervisor.attendants?.length ? (
                    <View style={styles.hierarchyChildList}>
                      {supervisor.attendants.map(attendant => (
                        <View key={attendant.id} style={styles.hierarchyChildRow}>
                          <View style={styles.hierarchyChildDot} />
                          <View style={styles.hierarchyChildText}>
                            <Text style={styles.cardSubtitle}>{hierarchyStaffName(attendant)}</Text>
                            <Text style={styles.captionTiny}>
                              {hierarchyStaffRole(attendant, 'attendant')} - {hierarchyOpenTickets(attendant)} open
                            </Text>
                          </View>
                          <StatusBadge
                            label={hierarchyOnShift(attendant) ? 'On' : 'Off'}
                            tone={hierarchyOnShift(attendant) ? 'green' : 'gray'}
                          />
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.caption}>No attendants assigned under this supervisor.</Text>
                  )}
                </HierarchyNodeCard>
              ))}
            </View>
          </>
        ) : null}

        {directAttendants.length ? (
          <>
            <SectionTitle title="Direct Attendants" />
            <View style={styles.cardStack}>
              {directAttendants.map(attendant => (
                <HierarchyNodeCard key={attendant.id} node={attendant} role="attendant" />
              ))}
            </View>
          </>
        ) : null}

        {!nodes.length && !loading && !localLoading ? (
          <EmptyState label="No hierarchy records for this department." />
        ) : null}
      </ScrollView>
    </View>
  );
}

function whatsappNumberValue(value: string) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function whatsappLookupStaff(staff: ArcadiaRecord[], id: string) {
  if (!id) {
    return null;
  }
  return (
    staff.find(member =>
      ['id', 'user_id', 'staff_id'].some(key => firstRecordValue(member, [key]) === id),
    ) ?? null
  );
}

function whatsappStaffName(staff: ArcadiaRecord[], id: string) {
  const member = whatsappLookupStaff(staff, id);
  return firstRecordValue(member, ['name', 'full_name', 'email', 'phone']) || id;
}

function whatsappConversationName(conversation: ArcadiaRecord) {
  return (
    firstRecordValue(conversation, ['guest_name', 'contact_name', 'name', 'phone', 'guest_phone']) ||
    'WhatsApp Guest'
  );
}

function enrichWhatsAppConversation(conversation: ArcadiaRecord, staff: ArcadiaRecord[]) {
  const assignedStaffId = firstRecordValue(conversation, ['assigned_staff_id', 'assigned_to']);
  const resolvedBy = firstRecordValue(conversation, ['resolved_by']);
  const assignedStaffName =
    firstRecordValue(conversation, ['assigned_staff_name', 'assignee_name']) ||
    (assignedStaffId ? whatsappStaffName(staff, assignedStaffId) : '');
  const resolvedByName =
    firstRecordValue(conversation, ['resolved_by_name']) ||
    (resolvedBy ? whatsappStaffName(staff, resolvedBy) : '');

  return {
    ...conversation,
    assigned_staff_name: assignedStaffName,
    resolved_by_name: resolvedByName,
  };
}

function filterWhatsAppConversations(
  conversations: ArcadiaRecord[],
  filter: string,
  userId: string,
) {
  if (filter === 'All') {
    return conversations;
  }
  if (filter === 'Unread') {
    return conversations.filter(conversation =>
      whatsappNumberValue(firstRecordValue(conversation, ['unread_count', 'unread'])) > 0,
    );
  }
  if (filter === 'VIP') {
    return conversations.filter(conversation =>
      ['high', 'urgent', 'critical'].includes(firstRecordValue(conversation, ['priority']).toLowerCase()),
    );
  }
  if (filter === 'Mine') {
    return conversations.filter(conversation =>
      firstRecordValue(conversation, ['assigned_staff_id', 'assigned_to']) === userId,
    );
  }
  return conversations.filter(conversation =>
    firstRecordValue(conversation, ['status']).toLowerCase() === filter.toLowerCase(),
  );
}

export function WhatsAppScreen({
  conversations,
  error,
  hotelId,
  loading,
  loadingProcesses,
  request,
  staff,
  userId,
  onBack,
  onMenu,
  onOpenChat,
  onOpenNotifications,
  onRefresh,
  onShowDialog,
}: {
  conversations: ArcadiaRecord[];
  error: string | null;
  hotelId: string;
  loading: boolean;
  loadingProcesses: string[];
  request: RequestFn;
  staff: ArcadiaRecord[];
  userId: string;
  onBack: () => void;
  onMenu: () => void;
  onOpenChat: (conversation: ArcadiaRecord) => void;
  onOpenNotifications: () => void;
  onRefresh: () => void;
  onShowDialog: (dialog: AppDialogRequest) => void;
}) {
  const [filter, setFilter] = useState('All');
  const [query, setQuery] = useState('');
  const [updatingConversationId, setUpdatingConversationId] = useState<string | null>(null);
  const enrichedConversations = useMemo(
    () => conversations.map(conversation => enrichWhatsAppConversation(conversation, staff)),
    [conversations, staff],
  );
  const filteredConversations = useMemo(
    () =>
      filterRecordsBySearch(
        filterWhatsAppConversations(enrichedConversations, filter, userId),
        query,
      ),
    [enrichedConversations, filter, query, userId],
  );
  const {hasMore, loadMore, visibleItems} = useScrollPagination(filteredConversations);
  const unreadCount = enrichedConversations.filter(conversation =>
    whatsappNumberValue(firstRecordValue(conversation, ['unread_count', 'unread'])) > 0,
  ).length;
  const openCount = enrichedConversations.filter(
    conversation => firstRecordValue(conversation, ['status']).toLowerCase() === 'open',
  ).length;
  const vipCount = enrichedConversations.filter(conversation =>
    ['high', 'urgent', 'critical'].includes(firstRecordValue(conversation, ['priority']).toLowerCase()),
  ).length;

  async function updateConversationStatus(conversation: ArcadiaRecord, status: string) {
    const conversationId = firstRecordValue(conversation, ['id', 'conversation_id']);
    if (!conversationId) {
      onShowDialog({
        message: 'The selected conversation is missing an id.',
        title: 'WhatsApp update failed',
        tone: 'error',
      });
      return;
    }
    setUpdatingConversationId(conversationId);
    try {
      await request<ArcadiaRecord>(
        `/api/v1/hotels/${hotelId}/whatsapp/conversations/${conversationId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({status}),
        },
      );
      onRefresh();
      onShowDialog({
        message: status === 'resolved' ? 'Conversation marked resolved.' : 'Conversation reopened.',
        title: 'WhatsApp updated',
        tone: 'success',
      });
    } catch (nextError) {
      const details = formatErrorDetails(nextError, 'WhatsApp update failed');
      onShowDialog({
        details,
        message: details.split('\n').find(Boolean) || 'The conversation could not be updated.',
        title: 'WhatsApp update failed',
        tone: 'error',
      });
    } finally {
      setUpdatingConversationId(null);
    }
  }

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
      <FlatList
        style={styles.screen}
        contentContainerStyle={styles.screenContent}
        data={visibleItems}
        keyExtractor={(conversation, index) =>
          `${firstRecordValue(conversation, ['id', 'conversation_id', 'phone'])}-${index}`
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.35}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} />}
        ListFooterComponent={<ListFooter hasMore={hasMore} loading={loading} />}
        ListHeaderComponent={
          <View>
            <ErrorNotice message={error} onRetry={onRefresh} />
            <SearchBox
              placeholder="Search conversations..."
              value={query}
              onChangeText={setQuery}
            />
            <View style={styles.staffSummaryGrid}>
              <MetricTile label="Open" value={openCount} tone="orange" />
              <MetricTile label="Unread" value={unreadCount} tone="red" />
              <MetricTile label="VIP" value={vipCount} tone="blue" />
            </View>
            <ChipRow
              labels={['All', 'Unread', 'Open', 'VIP', 'Mine', 'Resolved']}
              activeLabel={filter}
              onSelect={setFilter}
            />
            <Text style={styles.whatsappFilterSummary}>
              {filteredConversations.length} conversations
            </Text>
          </View>
        }
        ListEmptyComponent={
          loading ? null : <EmptyState label="No WhatsApp conversations returned from API." />
        }
        renderItem={({item: conversation}) => {
            const name = whatsappConversationName(conversation);
            const status = firstRecordValue(conversation, ['status']) || 'open';
            const priority = firstRecordValue(conversation, ['priority']) || 'normal';
            const unread = whatsappNumberValue(firstRecordValue(conversation, ['unread_count', 'unread']));
            const assignedName = firstRecordValue(conversation, ['assigned_staff_name']);
            const resolvedByName = firstRecordValue(conversation, ['resolved_by_name']);
            const conversationId = firstRecordValue(conversation, ['id', 'conversation_id']);
            const updating = updatingConversationId === conversationId;
            return (
            <Pressable
              style={styles.whatsappConversationCard}
              onPress={() => onOpenChat(conversation)}>
              <View style={styles.whatsappIcon}>
                <MessageCircle color="#FFFFFF" size={18} strokeWidth={2} />
              </View>
              <View style={styles.chatText}>
                <Text style={styles.cardTitle}>{name}</Text>
                <Text style={styles.caption}>
                  {firstRecordValue(conversation, ['last_message', 'message', 'preview']) || 'No message preview'}
                </Text>
                <View style={styles.whatsappBadgeRow}>
                  <StatusBadge label={status} tone={statusTone(status)} />
                  <StatusBadge label={priority} tone={priorityTone(priority)} />
                  {unread ? (
                    <View style={styles.unreadDot}>
                      <Text style={styles.unreadText}>{unread}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.whatsappInfoLine}>
                  {assignedName ? `Assigned to ${assignedName}` : 'Unassigned'}
                  {resolvedByName ? ` - Resolved by ${resolvedByName}` : ''}
                </Text>
              </View>
              <View style={styles.chatMeta}>
                <Text style={styles.captionTiny}>
                  {firstRecordValue(conversation, ['last_message_at', 'updated_at'])}
                </Text>
                <ActionMenu
                  items={[
                    {label: 'Open Chat', onPress: () => onOpenChat(conversation)},
                    {
                      label: updating
                        ? 'Updating...'
                        : status.toLowerCase() === 'resolved'
                          ? 'Reopen'
                          : 'Mark Resolved',
                      onPress: () =>
                        updating
                          ? undefined
                          : updateConversationStatus(
                              conversation,
                              status.toLowerCase() === 'resolved' ? 'open' : 'resolved',
                            ),
                    },
                  ]}
                />
              </View>
            </Pressable>
          );
        }}
      />
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
