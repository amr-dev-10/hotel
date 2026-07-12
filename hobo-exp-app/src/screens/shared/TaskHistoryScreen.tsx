import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Modal,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Task, RootStackParamList } from '../../types';
import { TasksService, DeletedTasksService } from '../../services/firebase';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type FilterOption = 'None' | 'DateRange' | 'RecentToOldest' | 'OldestToRecent' | 'Completed' | 'Cancelled';

const PRIMARY     = '#003D9B';
const PRIMARY_CT  = '#0052CC';
const SECONDARY   = '#00687A';
const WHITE       = '#FFFFFF';
const BG          = '#F9F9FF';
const SURFACE_LO  = '#F0F3FF';
const SURFACE_CT  = '#E7EEFF';
const TEXT_DARK   = '#101C2D';
const TEXT_MID    = '#434654';
const TEXT_SOFT   = '#737685';
const OUTLINE_VAR = '#C3C6D6';
const SLATE_LITE  = '#F1F5F9';
const SLATE_BORD  = '#E2E8F0';
const GREEN_BG    = '#F0FDF4';
const GREEN_BORD  = '#DCFCE7';
const GREEN_TEXT  = '#15803D';

function toMillis(value: any): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const n = Number(value);
    if (!Number.isNaN(n)) return n;
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (value?.seconds) return value.seconds * 1000;
  return 0;
}

function getTaskTimeFields(task: Task) {
  const raw = task as any;
  const assignedMs =
    toMillis(task.AssignedTime) ||
    toMillis(raw.assignedTime) ||
    toMillis(task.timestamp) ||
    toMillis(raw.Timestamp);

  const approvedMs =
    toMillis(task.ApproveTime) ||
    toMillis(raw.approveTime);

  return { assignedMs, approvedMs };
}

function formatTime(ts: any): string {
  const ms = toMillis(ts);
  if (!ms) return '—';
  const date = new Date(ms);
  if (isNaN(date.getTime())) return '—';
  let hours = date.getHours();
  const mins = date.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours}:${mins} ${ampm}`;
}

function calcDuration(task: Task): { label: string; mins: number } {
  const { assignedMs, approvedMs } = getTaskTimeFields(task);
  if (!assignedMs || !approvedMs) return { label: 'Waiting...', mins: 0 };

  const diffMs = approvedMs - assignedMs;
  if (diffMs < 0) return { label: 'Waiting...', mins: 0 };

  const totalMins = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hours > 0) return { label: `${hours}h ${mins}m`, mins: totalMins };
  return { label: `${mins} mins`, mins: totalMins };
}

function getDeptIcon(dept?: string): string {
  const d = (dept || '').toLowerCase().replace(/[\s_-]+/g, '');
  if (d.includes('engineer') || d.includes('maintenance')) return 'construct-outline';
  if (d.includes('housekeep')) return 'sparkles-outline';
  if (d.includes('food') || d.includes('beverage') || d.includes('dining')) return 'restaurant-outline';
  if (d.includes('frontdesk') || d.includes('reception')) return 'desktop-outline';
  if (d.includes('laundry')) return 'shirt-outline';
  if (d.includes('electric')) return 'flash-outline';
  return 'briefcase-outline';
}

const FILTER_OPTIONS: { key: FilterOption; label: string }[] = [
  { key: 'DateRange',      label: 'Date Range' },
  { key: 'RecentToOldest', label: 'Recent to Oldest' },
  { key: 'OldestToRecent', label: 'Oldest to Recent' },
  { key: 'Completed',      label: 'Completed' },
  { key: 'Cancelled',      label: 'Cancelled' },
];

const QUICK_FILTERS: { key: FilterOption; label: string }[] = [
  { key: 'None',           label: 'All History' },
  { key: 'Completed',      label: 'Completed' },
  { key: 'Cancelled',      label: 'Cancelled' },
  { key: 'RecentToOldest', label: 'Recent' },
  { key: 'OldestToRecent', label: 'Oldest' },
];

function toDayBoundaryMs(dateText: string, endOfDay = false): number {
  const text = dateText.trim();
  if (!text) return 0;
  const parsed = new Date(`${text}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}`);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

export function TaskHistoryScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const [completedTasks, setCompletedTasks] = useState<Task[]>([]);
  const [deletedTasks, setDeletedTasks]     = useState<Task[]>([]);
  const [searchText, setSearchText]         = useState('');
  const [activeFilter, setActiveFilter]     = useState<FilterOption>('None');
  const [showFilter, setShowFilter]         = useState(false);
  const [fromDate, setFromDate]             = useState('');
  const [toDate, setToDate]                 = useState('');

  useEffect(() => {
    const unsub = TasksService.subscribeToTasksByStage('Completed', setCompletedTasks);
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = DeletedTasksService.subscribeToDeletedTasks(setDeletedTasks);
    return unsub;
  }, []);

  const displayedTasks = useMemo(() => {
    let tasks: Task[] = [];

    if (activeFilter === 'Cancelled') {
      tasks = [...deletedTasks];
    } else {
      tasks = [...completedTasks];
    }

    if (activeFilter === 'Completed') {
      tasks = tasks.filter((t) => (t.Stage ?? '').toLowerCase() === 'completed');
    }

    if (activeFilter === 'DateRange') {
      const fromMs = toDayBoundaryMs(fromDate, false);
      const toMs = toDayBoundaryMs(toDate, true);
      if (fromMs && toMs && fromMs <= toMs) {
        tasks = tasks.filter((t) => {
          const ts = toMillis(t.timestamp) || toMillis((t as any).CreatedTime) || toMillis(t.AssignedTime);
          return ts >= fromMs && ts <= toMs;
        });
      }
    }

    if (activeFilter === 'OldestToRecent') {
      tasks = [...tasks].sort((a, b) => toMillis(a.timestamp) - toMillis(b.timestamp));
    } else {
      tasks = [...tasks].sort((a, b) => toMillis(b.timestamp) - toMillis(a.timestamp));
    }

    const q = searchText.trim().toLowerCase();
    if (q) {
      tasks = tasks.filter(
        (t) =>
          t.RoomNo?.toLowerCase().includes(q) ||
          t.GuestName?.toLowerCase().includes(q) ||
          (t.Department ?? '').toLowerCase().includes(q) ||
          (t.ItemOrdered ?? '').toLowerCase().includes(q)
      );
    }

    return tasks;
  }, [completedTasks, deletedTasks, activeFilter, searchText, fromDate, toDate]);

  // Stats
  const stats = useMemo(() => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const startMs = startOfDay.getTime();

    const todayCompleted = completedTasks.filter((t) => toMillis(t.timestamp) >= startMs);
    const completedToday = todayCompleted.length;

    const durations = completedTasks
      .map((t) => calcDuration(t).mins)
      .filter((m) => m > 0);
    const avgMins = durations.length > 0
      ? Math.round(durations.reduce((s, n) => s + n, 0) / durations.length)
      : 0;

    return { completedToday, avgMins };
  }, [completedTasks]);

  function applyFilter(key: FilterOption) {
    if (key === 'DateRange') {
      const fromMs = toDayBoundaryMs(fromDate, false);
      const toMs = toDayBoundaryMs(toDate, true);
      if (!fromMs || !toMs || fromMs > toMs) return;
    }
    setActiveFilter(key);
    setShowFilter(false);
  }

  return (
    <View style={styles.root}>
      <ScreenHeader title="History" topInset={insets.top} />
      <FlatList
        data={displayedTasks}
        keyExtractor={(item) => item.TaskId}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>

            {/* Search */}
            <View style={styles.searchBox}>
              <Ionicons name="search" size={20} color={TEXT_SOFT} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by Guest Name, Room or Service..."
                placeholderTextColor={TEXT_SOFT}
                value={searchText}
                onChangeText={setSearchText}
              />
              <TouchableOpacity onPress={() => setShowFilter(true)} style={styles.tuneBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="options-outline" size={20} color={TEXT_SOFT} />
              </TouchableOpacity>
            </View>

            {/* Quick filter chips */}
            <FlatList
              data={QUICK_FILTERS}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.key}
              contentContainerStyle={styles.quickFilterRow}
              renderItem={({ item: f }) => {
                const active = activeFilter === f.key;
                return (
                  <TouchableOpacity
                    style={[styles.qfPill, active && styles.qfPillActive]}
                    onPress={() => setActiveFilter(f.key)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.qfText, active && styles.qfTextActive]} numberOfLines={1}>
                      {f.label}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />

            {/* Stats */}
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>COMPLETED TODAY</Text>
                <View style={styles.statValueRow}>
                  <Text style={[styles.statValue, { color: PRIMARY }]}>{stats.completedToday}</Text>
                  {stats.completedToday > 0 ? (
                    <View style={styles.trendRow}>
                      <Ionicons name="trending-up" size={14} color={SECONDARY} />
                      <Text style={styles.trendText}>+{stats.completedToday}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>AVG. RESPONSE</Text>
                <View style={styles.statValueRow}>
                  <Text style={[styles.statValue, { color: TEXT_DARK }]}>{stats.avgMins || '—'}</Text>
                  {stats.avgMins > 0 ? <Text style={styles.statUnit}>min</Text> : null}
                </View>
              </View>
            </View>

            {/* Section header */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Logs</Text>
              <Text style={styles.sectionCount}>Showing {displayedTasks.length} entries</Text>
            </View>
          </>
        }
        renderItem={({ item }) => {
          const { assignedMs } = getTaskTimeFields(item);
          const duration = calcDuration(item);
          const isCancelled = activeFilter === 'Cancelled';
          const description = (item.ItemOrdered || item.Note || item.GuestName || `Room ${item.RoomNo}`).toString();
          const deptIcon = getDeptIcon(item.Department);

          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate('TaskDetails', { taskId: item.TaskId, task: item })}
              activeOpacity={0.85}
            >
              <View style={styles.cardRow}>
                <View style={styles.iconBadge}>
                  <Ionicons name={deptIcon as any} size={22} color={PRIMARY_CT} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.cardTopRow}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={styles.cardTitle} numberOfLines={1}>
                        Room {item.RoomNo}
                        <Text style={styles.cardDot}>  •  </Text>
                        <Text style={styles.cardGuest}>{item.GuestName || 'Guest'}</Text>
                      </Text>
                    </View>
                    <View style={[styles.statusPill, isCancelled ? styles.cancelledPill : styles.completedPill]}>
                      <Text style={[styles.statusText, isCancelled ? styles.cancelledText : styles.completedText]}>
                        {isCancelled ? 'Cancelled' : 'Completed'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.cardDesc} numberOfLines={2}>{description}</Text>

                  <View style={[styles.cardFooter, isCancelled && { opacity: 0.6 }]}>
                    <View style={styles.metaCell}>
                      <Ionicons name="time-outline" size={16} color={TEXT_SOFT} />
                      <View>
                        <Text style={styles.metaLabel}>TIME</Text>
                        <Text style={styles.metaValue}>{assignedMs ? formatTime(assignedMs) : '—'}</Text>
                      </View>
                    </View>
                    <View style={styles.metaCell}>
                      <Ionicons name="hourglass-outline" size={16} color={TEXT_SOFT} />
                      <View>
                        <Text style={styles.metaLabel}>DURATION</Text>
                        <Text style={styles.metaValue}>{isCancelled ? '—' : duration.label}</Text>
                      </View>
                    </View>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="archive-outline" size={40} color={OUTLINE_VAR} />
            <Text style={styles.emptyText}>No history found</Text>
          </View>
        }
      />

      {/* Filter Bottom Sheet */}
      <Modal visible={showFilter} transparent animationType="slide" onRequestClose={() => setShowFilter(false)}>
        <Pressable style={styles.backdrop} onPress={() => setShowFilter(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Apply Filter</Text>
            <Text style={styles.sheetSubtitle}>Select any filter below to apply</Text>

            {FILTER_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.filterRow, activeFilter === opt.key && styles.filterRowActive]}
                onPress={() => {
                  if (opt.key === 'DateRange') { setActiveFilter('DateRange'); return; }
                  applyFilter(opt.key);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterRowText, activeFilter === opt.key && styles.filterRowTextActive]}>
                  {opt.label}
                </Text>
                {activeFilter === opt.key ? <Ionicons name="checkmark" size={18} color={PRIMARY} /> : null}
              </TouchableOpacity>
            ))}

            {activeFilter === 'DateRange' && (
              <View style={styles.dateRangeBox}>
                <Text style={styles.dateRangeHint}>Use YYYY-MM-DD format</Text>
                <TextInput
                  style={styles.dateInput}
                  placeholder="From date (YYYY-MM-DD)"
                  placeholderTextColor={TEXT_SOFT}
                  value={fromDate}
                  onChangeText={setFromDate}
                  autoCapitalize="none"
                />
                <TextInput
                  style={styles.dateInput}
                  placeholder="To date (YYYY-MM-DD)"
                  placeholderTextColor={TEXT_SOFT}
                  value={toDate}
                  onChangeText={setToDate}
                  autoCapitalize="none"
                />
                <TouchableOpacity style={styles.applyDateBtn} onPress={() => applyFilter('DateRange')}>
                  <Text style={styles.applyDateBtnText}>Apply Date Range</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={{ height: 24 }} />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root:        { flex: 1, backgroundColor: BG },
  listContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32 },

  // Heading

  // Search
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: WHITE,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: OUTLINE_VAR,
    paddingHorizontal: 14,
    paddingVertical: 4,
    elevation: 4,
    shadowColor: '#0052CC',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    marginBottom: 14,
  },
  searchIcon:  { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: TEXT_DARK, paddingVertical: 14 },
  tuneBtn:     { padding: 6 },

  // Quick filters
  quickFilterRow: { gap: 8, paddingBottom: 4, paddingRight: 8 },
  qfPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 9999,
    backgroundColor: SURFACE_CT,
    borderWidth: 1,
    borderColor: OUTLINE_VAR,
  },
  qfPillActive: {
    backgroundColor: PRIMARY_CT,
    borderColor: PRIMARY_CT,
  },
  qfText:       { fontSize: 13, fontWeight: '600', color: TEXT_MID, letterSpacing: 0.4 },
  qfTextActive: { color: WHITE },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: WHITE,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SLATE_LITE,
    padding: 18,
    elevation: 4,
    shadowColor: '#0052CC',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  statLabel: {
    fontSize: 11,
    color: TEXT_SOFT,
    letterSpacing: 0.6,
    fontWeight: '500',
    marginBottom: 8,
  },
  statValueRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  statValue:    { fontSize: 30, fontWeight: '700', letterSpacing: -0.5, lineHeight: 36 },
  statUnit:     { fontSize: 13, color: TEXT_MID, marginBottom: 5 },
  trendRow:     { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: 6 },
  trendText:    { fontSize: 12, color: SECONDARY, fontWeight: '700' },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT_DARK,
    letterSpacing: -0.2,
  },
  sectionCount: {
    fontSize: 11,
    color: TEXT_SOFT,
    fontWeight: '500',
  },

  // Card
  card: {
    backgroundColor: WHITE,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SLATE_LITE,
    marginBottom: 12,
    padding: 16,
    elevation: 4,
    shadowColor: '#0052CC',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  cardRow:    { flexDirection: 'row', gap: 14 },
  iconBadge: {
    width: 44, height: 44,
    borderRadius: 8,
    backgroundColor: SURFACE_LO,
    justifyContent: 'center', alignItems: 'center',
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
    gap: 8,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: TEXT_DARK, letterSpacing: -0.2 },
  cardDot:   { color: TEXT_SOFT, fontWeight: '400' },
  cardGuest: { fontSize: 14, fontWeight: '400', color: TEXT_MID },
  cardDesc:  { fontSize: 13, color: TEXT_MID, lineHeight: 18, marginTop: 2, marginBottom: 12 },

  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 9999,
    borderWidth: 1,
  },
  completedPill: { backgroundColor: GREEN_BG, borderColor: GREEN_BORD },
  cancelledPill: { backgroundColor: SLATE_LITE, borderColor: SLATE_BORD },
  statusText:    { fontSize: 10, fontWeight: '700', letterSpacing: 0.4 },
  completedText: { color: GREEN_TEXT, textTransform: 'uppercase' },
  cancelledText: { color: TEXT_SOFT, textTransform: 'uppercase' },

  cardFooter: {
    flexDirection: 'row',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
    gap: 16,
  },
  metaCell: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  metaLabel: { fontSize: 9, color: TEXT_SOFT, fontWeight: '500', letterSpacing: 0.5 },
  metaValue: { fontSize: 13, color: TEXT_DARK, fontWeight: '600', marginTop: 1 },

  // Empty
  empty:     { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyText: { color: TEXT_SOFT, fontSize: 14, fontWeight: '500' },

  // Filter bottom sheet
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: WHITE,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 12,
    elevation: 20,
  },
  sheetHandle:    { width: 36, height: 4, backgroundColor: OUTLINE_VAR, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  sheetTitle:     { fontSize: 20, fontWeight: '700', color: PRIMARY, marginBottom: 4 },
  sheetSubtitle:  { fontSize: 13, color: TEXT_SOFT, marginBottom: 20 },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: SLATE_BORD,
  },
  filterRowActive: {
    backgroundColor: SURFACE_LO,
    marginHorizontal: -24,
    paddingHorizontal: 24,
  },
  filterRowText:       { fontSize: 15, color: TEXT_DARK, fontWeight: '500' },
  filterRowTextActive: { color: PRIMARY, fontWeight: '700' },

  dateRangeBox: {
    marginTop: 14,
    padding: 14,
    borderRadius: 12,
    backgroundColor: BG,
    borderWidth: 1,
    borderColor: SLATE_BORD,
  },
  dateRangeHint: { fontSize: 12, color: TEXT_SOFT, marginBottom: 10 },
  dateInput: {
    height: 46,
    borderRadius: 8,
    backgroundColor: SURFACE_LO,
    paddingHorizontal: 14,
    fontSize: 14,
    color: TEXT_DARK,
    marginBottom: 10,
  },
  applyDateBtn: {
    marginTop: 4,
    height: 46,
    borderRadius: 10,
    backgroundColor: PRIMARY_CT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyDateBtnText: { color: WHITE, fontWeight: '700', fontSize: 14, letterSpacing: 0.4 },
});
