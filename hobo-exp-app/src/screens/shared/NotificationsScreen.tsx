/**
 * Alerts — escalation notifications for managers and hotel owners.
 *
 * A task that runs past its department time frame produces a "manager"-level
 * escalation; once it runs past double that time it becomes an "admin"-level
 * escalation. Department managers see escalations for their department; hotel
 * owners see the admin-level (doubled-time) escalations across all departments.
 * Source of truth: {hotelId}/Notifications/Escalations (shared with the web
 * dashboard).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../utils/constants';
import { RootStackParamList, EscalationNotification, Task } from '../../types';
import { useAuthStore } from '../../store/useAuthStore';
import { subscribeToEscalations } from '../../services/escalationService';
import { TasksService } from '../../services/firebase';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function formatDept(raw?: string) {
  return (raw ?? '').toString().replace(/[_-]+/g, ' ').trim() || '—';
}

function minutesAgo(ts?: number | null): string {
  if (!ts) return '';
  const diff = Math.floor((Date.now() - Number(ts)) / 60000);
  if (diff < 1) return 'just now';
  if (diff === 1) return '1 minute ago';
  return `${diff} minutes ago`;
}

function overdueBy(startedAt?: number, limitMinutes?: number): string | null {
  if (!startedAt || !limitMinutes) return null;
  const overdueMins = Math.floor((Date.now() - Number(startedAt)) / 60000) - limitMinutes;
  if (overdueMins <= 0) return null;
  return overdueMins === 1 ? '1 min overdue' : `${overdueMins} min overdue`;
}

export function NotificationsScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { hotelId, department, isHotelOwner, jobRole } = useAuthStore();
  const normalizedRole = (jobRole ?? '').toString().trim().toLowerCase().replace(/[\s_-]+/g, '');
  const isManager =
    normalizedRole === 'manager' || normalizedRole === 'frontdesk' || !!isHotelOwner;

  const [items, setItems] = useState<EscalationNotification[]>([]);
  const [taskMap, setTaskMap] = useState<Record<string, Task>>({});
  const [loading, setLoading] = useState(true);
  const [, setTick] = useState(0);
  const [opening, setOpening] = useState(false);

  // Live ticket data, keyed by TaskId — escalation records don't carry the
  // assignee or created time, so we join them in to show those on the card.
  useEffect(() => {
    if (!hotelId || !isManager) {
      setTaskMap({});
      return;
    }
    return TasksService.subscribeToAllTasks((list) => {
      const map: Record<string, Task> = {};
      for (const t of list) map[t.TaskId] = t;
      setTaskMap(map);
    });
  }, [hotelId, isManager]);

  // Re-render every 30s so "x min ago" / "overdue by" stay fresh.
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30 * 1000);
    return () => clearInterval(id);
  }, []);

  const opts = useMemo(
    () => ({ isOwner: !!isHotelOwner, department }),
    [isHotelOwner, department],
  );

  useEffect(() => {
    if (!hotelId || !isManager) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = subscribeToEscalations(hotelId, opts, (list) => {
      setItems(list);
      setLoading(false);
    });
    return unsub;
  }, [hotelId, isManager, opts]);

  const openTicket = useCallback(
    async (ticketId: string) => {
      if (opening) return;
      setOpening(true);
      try {
        const task = await TasksService.getTask(ticketId);
        if (!task) {
          Alert.alert('Ticket unavailable', 'This ticket may have been completed or removed.');
          return;
        }
        navigation.navigate('TaskDetails', { taskId: ticketId, task });
      } catch {
        Alert.alert('Error', 'Could not open this ticket. Please try again.');
      } finally {
        setOpening(false);
      }
    },
    [navigation, opening],
  );

  if (!isManager) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <Ionicons name="notifications-off-outline" size={48} color={COLORS.GREY} />
        <Text style={styles.emptyTitle}>No alerts here</Text>
        <Text style={styles.emptySub}>Escalation alerts are for managers and owners only.</Text>
      </View>
    );
  }

  const renderItem = ({ item }: { item: EscalationNotification }) => {
    const isAdmin = item.level === 'admin';
    const accent = isAdmin ? COLORS.ERROR : COLORS.SECONDARY;
    const overdue = overdueBy(item.ticketStartedAt, item.timeLimitMinutes);
    const escalatedTs = isAdmin ? item.adminEscalatedAt : item.managerEscalatedAt;

    // Joined ticket data (assignee, created time, reassignment history).
    const task = taskMap[item.ticketId];
    const assignee = (task?.AssignedToName ?? '').toString().trim();
    const createdMs = Number(
      task?.CreatedTime ?? task?.timestamp ?? task?.TimerStartTime ??
      task?.AssignedTime ?? item.ticketStartedAt ?? 0,
    );
    const reassignCount = Array.isArray(task?.AssignmentHistory) ? task!.AssignmentHistory!.length : 0;
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => openTicket(item.ticketId)}
        style={[styles.card, { borderLeftColor: accent }]}
      >
        <View style={styles.cardHeaderRow}>
          <View style={[styles.levelPill, { backgroundColor: isAdmin ? '#FFDAD6' : '#FFE7C2' }]}>
            <Ionicons
              name={isAdmin ? 'alert-circle' : 'time'}
              size={13}
              color={isAdmin ? COLORS.ERROR : COLORS.SECONDARY}
            />
            <Text style={[styles.levelPillText, { color: isAdmin ? '#93000A' : '#684000' }]}>
              {isAdmin ? 'Critical · Owner' : 'Overdue · Manager'}
            </Text>
          </View>
          {!!overdue && (
            <Text style={[styles.overdueText, { color: accent }]}>{overdue}</Text>
          )}
        </View>

        <Text style={styles.itemText} numberOfLines={2}>
          {item.itemOrdered || 'Request'}
        </Text>
        <Text style={styles.subText}>
          {item.guestName ? `${item.guestName} · ` : ''}Room {item.roomNo || '—'}
        </Text>

        <View style={styles.detailRow}>
          <Ionicons name="person-outline" size={13} color={COLORS.TEXT_SECONDARY} />
          <Text style={styles.detailText}>
            {assignee ? `Assigned to ${assignee}` : 'Unassigned'}
            {reassignCount > 0 ? `  ·  reassigned ${reassignCount}×` : ''}
          </Text>
        </View>
        {createdMs > 0 ? (
          <View style={styles.detailRow}>
            <Ionicons name="calendar-outline" size={13} color={COLORS.TEXT_SECONDARY} />
            <Text style={styles.detailText}>Created {minutesAgo(createdMs)}</Text>
          </View>
        ) : null}

        <View style={styles.metaRow}>
          <View style={styles.metaChip}>
            <Ionicons name="briefcase-outline" size={12} color={COLORS.TEXT_SECONDARY} />
            <Text style={styles.metaChipText}>{formatDept(item.department)}</Text>
          </View>
          {!!item.timeLimitMinutes && (
            <View style={styles.metaChip}>
              <Ionicons name="timer-outline" size={12} color={COLORS.TEXT_SECONDARY} />
              <Text style={styles.metaChipText}>{item.timeLimitMinutes} min limit</Text>
            </View>
          )}
          {!!item.stage && (
            <View style={styles.metaChip}>
              <Ionicons name="flag-outline" size={12} color={COLORS.TEXT_SECONDARY} />
              <Text style={styles.metaChipText}>{item.stage}</Text>
            </View>
          )}
        </View>

        <View style={styles.cardFooterRow}>
          <Text style={styles.escalatedText}>Escalated {minutesAgo(escalatedTs)}</Text>
          <View style={styles.viewBtn}>
            <Text style={styles.viewBtnText}>View ticket</Text>
            <Ionicons name="chevron-forward" size={14} color={COLORS.PRIMARY} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Alerts</Text>
        <Text style={styles.headerSub}>
          {isHotelOwner
            ? 'Critical overdue tickets across all departments.'
            : `Overdue tickets in ${formatDept(department ?? '')}.`}
        </Text>
      </View>

      {loading ? (
        <View style={[styles.center, { flex: 1 }]}>
          <ActivityIndicator size="large" color={COLORS.PRIMARY} />
        </View>
      ) : items.length === 0 ? (
        <View style={[styles.center, { flex: 1 }]}>
          <Ionicons name="checkmark-circle-outline" size={56} color={COLORS.SUCCESS} />
          <Text style={styles.emptyTitle}>All tasks on time</Text>
          <Text style={styles.emptySub}>No escalations to show.</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => `${it.ticketId}:${it.level}`}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
          refreshControl={<RefreshControl refreshing={false} onRefresh={() => setTick((n) => n + 1)} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BACKGROUND },
  center: { alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 12,
    backgroundColor: COLORS.WHITE,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.OUTLINE_VARIANT,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.TEXT_PRIMARY, letterSpacing: -0.3 },
  headerSub: { fontSize: 13, color: COLORS.TEXT_SECONDARY, marginTop: 2 },

  emptyTitle: { fontSize: 16, fontWeight: '700', color: COLORS.TEXT_PRIMARY, marginTop: 4 },
  emptySub: { fontSize: 13, color: COLORS.GREY },

  card: {
    backgroundColor: COLORS.WHITE,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: COLORS.OUTLINE_VARIANT,
    elevation: 1,
    shadowColor: '#111C2D',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  levelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  levelPillText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
  overdueText: { fontSize: 12, fontWeight: '800' },

  itemText: { fontSize: 15, fontWeight: '700', color: COLORS.TEXT_PRIMARY, marginTop: 10 },
  subText: { fontSize: 13, color: COLORS.TEXT_SECONDARY, marginTop: 2 },

  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  detailText: { fontSize: 12, color: COLORS.TEXT_SECONDARY, fontWeight: '600', flex: 1 },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: COLORS.SURFACE_LOW,
  },
  metaChipText: { fontSize: 11, fontWeight: '600', color: COLORS.TEXT_SECONDARY },

  cardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  escalatedText: { fontSize: 11, color: COLORS.GREY },
  viewBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  viewBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.PRIMARY },
});
