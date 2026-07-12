/**
 * Blocked Rooms — read-only view of rooms taken out of service for
 * maintenance. Scheduling/clearing is done from the Arcadia dashboard
 * (Rooms tab); this screen just surfaces the current + upcoming blocks so
 * staff on the floor know which rooms not to use or assign work into.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../utils/constants';
import { useAuthStore } from '../../store/useAuthStore';
import {
  subscribeToRooms,
  roomMaintenanceBlocks,
  isRoomOutOfOrderIndefinitely,
  todayYmd,
  RoomDoc,
  MaintenanceBlock,
} from '../../services/roomsService';

type Row =
  | { kind: 'header'; title: string; count: number }
  | { kind: 'room'; room: RoomDoc; active: ActiveBlock | null; upcoming: MaintenanceBlock[] };

type ActiveBlock = {
  legacy: boolean;
  reason: string;
  from: string | null;
  to: string | null;
};

function fmtRange(from?: string | null, to?: string | null): string {
  if (!from && !to) return 'No end date';
  if (from && to) return from === to ? from : `${from} → ${to}`;
  return from || to || '';
}

function daysUntil(ymd?: string | null): string {
  if (!ymd) return '';
  const today = new Date(todayYmd() + 'T00:00:00');
  const target = new Date(ymd + 'T00:00:00');
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (diff <= 0) return '';
  if (diff === 1) return 'tomorrow';
  return `in ${diff} days`;
}

export function BlockedRoomsScreen() {
  const insets = useSafeAreaInsets();
  const hotelId = useAuthStore((s) => s.hotelId);
  const [rooms, setRooms] = useState<RoomDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hotelId) {
      setRooms([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = subscribeToRooms(hotelId, (list) => {
      setRooms(list);
      setLoading(false);
    });
    return unsub;
  }, [hotelId]);

  const { rows, totalBlocked } = useMemo(() => {
    const today = todayYmd();
    const outNow: Row[] = [];
    const scheduled: Row[] = [];
    for (const room of rooms) {
      const blocks = roomMaintenanceBlocks(room);
      const legacy = isRoomOutOfOrderIndefinitely(room);
      const currentBlock = blocks.find((b) => b.from <= today && today <= b.to) || null;
      const upcoming = blocks.filter((b) => b.from > today);

      const active: ActiveBlock | null = legacy
        ? { legacy: true, reason: room.maintenance?.reason || '', from: null, to: null }
        : currentBlock
        ? { legacy: false, reason: currentBlock.reason || '', from: currentBlock.from, to: currentBlock.to }
        : null;

      if (active) outNow.push({ kind: 'room', room, active, upcoming });
      else if (upcoming.length > 0) scheduled.push({ kind: 'room', room, active: null, upcoming });
    }
    const result: Row[] = [];
    if (outNow.length) {
      result.push({ kind: 'header', title: 'Out of service now', count: outNow.length });
      result.push(...outNow);
    }
    if (scheduled.length) {
      result.push({ kind: 'header', title: 'Scheduled maintenance', count: scheduled.length });
      result.push(...scheduled);
    }
    return { rows: result, totalBlocked: outNow.length + scheduled.length };
  }, [rooms]);

  const renderRow = ({ item }: { item: Row }) => {
    if (item.kind === 'header') {
      return (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>{item.title}</Text>
          <View style={styles.sectionCount}>
            <Text style={styles.sectionCountText}>{item.count}</Text>
          </View>
        </View>
      );
    }
    const { room, active, upcoming } = item;
    const accent = active ? COLORS.SECONDARY : COLORS.PRIMARY;
    return (
      <View style={[styles.card, { borderLeftColor: accent }]}>
        <View style={styles.cardTopRow}>
          <View style={styles.roomNoWrap}>
            <Ionicons name="bed-outline" size={16} color={accent} />
            <Text style={styles.roomNo}>Room {room.roomNo}</Text>
          </View>
          {active ? (
            <View style={[styles.statusPill, { backgroundColor: '#FFE7C2' }]}>
              <Text style={[styles.statusPillText, { color: '#684000' }]}>OUT OF SERVICE</Text>
            </View>
          ) : (
            <View style={[styles.statusPill, { backgroundColor: COLORS.SURFACE_CONTAINER }]}>
              <Text style={[styles.statusPillText, { color: COLORS.PRIMARY }]}>SCHEDULED</Text>
            </View>
          )}
        </View>

        {(room.roomType || room.floor) && (
          <Text style={styles.roomMeta}>
            {[room.roomType, room.floor ? `Floor ${room.floor}` : null].filter(Boolean).join(' · ')}
          </Text>
        )}

        {active && (
          <View style={styles.blockLine}>
            <Ionicons name="build-outline" size={13} color={COLORS.SECONDARY} />
            <Text style={styles.blockLineText}>
              {active.legacy ? 'Out of order — no end date' : `Blocked ${fmtRange(active.from, active.to)}`}
              {active.reason ? ` · ${active.reason}` : ''}
            </Text>
          </View>
        )}

        {upcoming.map((b) => (
          <View key={b.id} style={styles.blockLine}>
            <Ionicons name="calendar-outline" size={13} color={COLORS.GREY} />
            <Text style={styles.blockLineText}>
              {fmtRange(b.from, b.to)}
              {(() => {
                const d = daysUntil(b.from);
                return d ? ` (${d})` : '';
              })()}
              {b.reason ? ` · ${b.reason}` : ''}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Blocked Rooms</Text>
        <Text style={styles.headerSub}>
          Rooms out of service for maintenance. Scheduled from the dashboard.
        </Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.PRIMARY} />
        </View>
      ) : totalBlocked === 0 ? (
        <View style={styles.center}>
          <Ionicons name="checkmark-circle-outline" size={56} color={COLORS.SUCCESS} />
          <Text style={styles.emptyTitle}>All rooms in service</Text>
          <Text style={styles.emptySub}>No maintenance blocks scheduled.</Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r, i) => (r.kind === 'header' ? `h:${r.title}` : `r:${r.room.id}:${i}`)}
          renderItem={renderRow}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BACKGROUND },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
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

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    marginBottom: 8,
  },
  sectionHeaderText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: COLORS.TEXT_SECONDARY,
  },
  sectionCount: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    backgroundColor: COLORS.SURFACE_CONTAINER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionCountText: { fontSize: 11, fontWeight: '700', color: COLORS.PRIMARY },

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
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  roomNoWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  roomNo: { fontSize: 16, fontWeight: '800', color: COLORS.TEXT_PRIMARY },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  statusPillText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },
  roomMeta: { fontSize: 12, color: COLORS.GREY, marginTop: 4 },
  blockLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 8 },
  blockLineText: { flex: 1, fontSize: 13, color: COLORS.TEXT_SECONDARY, lineHeight: 18 },
});
