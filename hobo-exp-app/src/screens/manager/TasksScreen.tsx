/**
 * Manager Tasks Screen — matches Royal_Android task.java + fragment_task.xml
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Pressable,
  TextInput,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Task, RootStackParamList } from '../../types';
import { TasksService } from '../../services/backend';
import { useAuthStore } from '../../store/useAuthStore';
import { TransferTaskModal } from '../../components/task/TransferTaskModal';
import { COLORS } from '../../utils/constants';
import { AssignTaskModal } from '../../components/task/AssignTaskModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '../../components/common/ScreenHeader';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type TaskTab = 'InCompleted' | 'Complaints' | 'Resolved';

const TEAL      = '#0052CC';
const PRIMARY   = '#003D9B';
const WHITE     = '#FFFFFF';
const BG        = '#F9F9FF';
const TEXT_DARK = '#101C2D';
const TEXT_SOFT = '#737685';
const BORDER    = '#E2E8F0';
const PINK_BG   = '#FFDAD6';
const PINK_TEXT = '#93000A';

const TAB_LABELS: Record<TaskTab, string> = {
  InCompleted: 'In-Completed',
  Complaints:  'Complaints',
  Resolved:    'Resolved',
};

export function ManagerTasksScreen() {
  const navigation = useNavigation<Nav>();
  const [tasks, setTasks] = useState<Task[]>([]);
  const department = useAuthStore((s) => s.department);
  const jobRole = useAuthStore((s) => s.jobRole);
  const isHotelOwner = useAuthStore((s) => s.isHotelOwner);
  const [activeTab, setActiveTab] = useState<TaskTab>('InCompleted');
  const insets = useSafeAreaInsets();

  useEffect(() => {
    return TasksService.subscribeToAllTasks(setTasks);
  }, []);

  function stageOf(t: Task) {
    return (t.Stage ?? '').toString().trim().toLowerCase();
  }
  function ticketTypeOf(t: Task) {
    return ((t as any).TicketType ?? '').toString().trim().toLowerCase();
  }

  // If user is Manager, only show tickets belonging to their department (or ALL)
  const normalize = (v: any) => (v == null ? '' : String(v).trim().toLowerCase().replace(/[\s_-]+/g, '_'));
  const normalizeRole = (r?: string) => (r ?? '').toString().trim().toLowerCase();
  const isVisibleToManager = (t: Task) => {
    // Owner sees everything
    if (isHotelOwner) return true;
    // Manager sees only their department
    if (normalizeRole(jobRole) === 'manager' || normalize(jobRole) === 'frontdesk' || normalize(jobRole) === 'front_desk') {
      const ticketDept = normalize((t as any).Department ?? t.Department ?? 'ALL');
      if (!ticketDept || ticketDept === 'all' || ticketDept === 'ALL') return true;
      const myDept = normalize(department ?? '');
      return myDept === ticketDept;
    }
    // Other roles: hide from manager view
    return false;
  };

  const inCompletedTasks = tasks.filter((t) => {
    if (!isVisibleToManager(t)) return false;
    const s = stageOf(t);
    return s === 'created' || s === 'assigned' || s === '' || s === 'new';
  });

  const complaintsTasks = tasks.filter((t) => {
    if (!isVisibleToManager(t)) return false;
    const s = stageOf(t);
    return (
      ticketTypeOf(t) === 'complaints' &&
      (s === 'created' || s === 'assigned' || s === '' || s === 'new')
    );
  });

  const resolvedTasks = tasks.filter((t) =>
    isVisibleToManager(t) && ticketTypeOf(t) === 'complaints' && stageOf(t) === 'completed'
  );

  const tabData: Record<TaskTab, Task[]> = {
    InCompleted: sortNewestFirst(inCompletedTasks),
    Complaints:  sortNewestFirst(complaintsTasks),
    Resolved:    sortNewestFirst(resolvedTasks),
  };

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      <ScreenHeader title="Tasks" topInset={insets.top} />

      {/* Tab row */}
      <View style={styles.tabContainer}>
        {(['InCompleted', 'Complaints', 'Resolved'] as TaskTab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
            activeOpacity={0.85}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {TAB_LABELS[tab]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={tabData[activeTab]}
        keyExtractor={(item) => item.TaskId}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No tasks</Text>
          </View>
        }
        renderItem={({ item }) => (
          <ManagerTaskCard
            task={item}
            onViewDetails={() =>
              navigation.navigate('TaskDetails', { taskId: item.TaskId, task: item })
            }
          />
        )}
      />
    </View>
  );
}

function ManagerTaskCard({ task, onViewDetails }: { task: Task; onViewDetails: () => void }) {
  const [assignVisible, setAssignVisible] = useState(false);
  const [transferVisible, setTransferVisible] = useState(false);
  const [editVisible,   setEditVisible]   = useState(false);
  const [editedRoom,    setEditedRoom]    = useState(task.UpdatedRoomNo || task.RoomNo || '');
  const [saving,        setSaving]        = useState(false);

  const raw = task as any;
  const s   = (v: any) => (v == null ? '' : String(v).trim());

  const assignedName = s(task.AssignedToName);
  const roomDisplay  = task.UpdatedRoomNo
    ? `${task.RoomNo} → ${task.UpdatedRoomNo}`
    : s(task.RoomNo || raw.roomNo) || '--';
  const paidBy   = s(task.PaidBy  || raw.paidBy  || 'Paid');
  const priority = s(task.Priority || raw.priority || 'Routine');
  const dept     = s(task.Department || raw.department || '');
  const isPaused =
    s(task.DeliveryStatus || raw.deliveryStatus).toLowerCase() === 'notcompleted' &&
    !(task.Reattempt || raw.Reattempt);

  const timeLabel = relativeTime(task.AssignedTime || raw.assignedTime || task.timestamp);
  const pChip = priorityChipColors(priority);
  const title = s(task.ItemOrdered || task.Note || task.GuestName) || `Room ${task.RoomNo}`;

  async function saveRoomEdit() {
    const next = editedRoom.trim();
    if (!next) { Alert.alert('Required', 'Room number cannot be empty'); return; }
    setSaving(true);
    try {
      await TasksService.updateTask(task.TaskId, { UpdatedRoomNo: next });
      setEditVisible(false);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Update failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={[styles.card, isPaused && styles.cardPaused]}>
      {/* Left teal accent bar */}
      <View style={styles.accentBar} />

      <View style={styles.cardInner}>
        {/* Chips row */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          <View style={styles.roomChip}>
            <Text style={styles.roomChipText}>🏠 {roomDisplay}</Text>
          </View>
          {dept ? (
            <View style={styles.deptChip}>
              <Text style={styles.deptChipText}>{dept}</Text>
            </View>
          ) : null}
          <View style={[styles.priorityChip, { backgroundColor: pChip.bg }]}>
            <Text style={[styles.priorityChipText, { color: pChip.text }]}>{priority}</Text>
          </View>
          {timeLabel ? (
            <View style={styles.timeChip}>
              <Text style={styles.timeChipText}>{timeLabel}</Text>
            </View>
          ) : null}
          {isPaused ? (
            <View style={styles.pausedChip}>
              <Text style={styles.pausedChipText}>Paused</Text>
            </View>
          ) : null}
        </ScrollView>

        {/* Title */}
        <TouchableOpacity onPress={onViewDetails} activeOpacity={0.75}>
          <Text style={styles.cardTitle} numberOfLines={2}>{title}</Text>
        </TouchableOpacity>

        {/* Assigned to */}
        {assignedName ? (
          <Text style={styles.assignedTo}>Assigned to : {assignedName} · {s((task as any).WorkflowStep || '')}</Text>
        ) : (
          <Text style={styles.unassigned}>Unassigned</Text>
        )}

        <View style={styles.divider} />

        {/* Action row */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.assignBtn, assignedName && styles.reassignBtn]}
            onPress={() => setAssignVisible(true)}
            activeOpacity={0.85}
          >
            <Text style={styles.assignBtnText}>{assignedName ? 'Re-assign' : 'Assign Attendant'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.transferBtn]}
            onPress={() => setTransferVisible(true)}
            activeOpacity={0.85}
          >
            <Text style={styles.transferBtnText}>Transfer</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => { setEditedRoom(task.UpdatedRoomNo || task.RoomNo || ''); setEditVisible(true); }}
            activeOpacity={0.8}
          >
            <Text style={styles.editBtnText}>✎</Text>
          </TouchableOpacity>
        </View>
      </View>

      <AssignTaskModal
        visible={assignVisible}
        taskId={task.TaskId}
        department={task.Department}
        onClose={() => setAssignVisible(false)}
        onAssigned={() => setAssignVisible(false)}
      />

      <TransferTaskModal
        visible={transferVisible}
        taskId={task.TaskId}
        currentDepartment={task.Department}
        currentAssignedId={task.AssignedToID}
        onClose={() => setTransferVisible(false)}
        onTransferred={() => setTransferVisible(false)}
      />

      <Modal visible={editVisible} transparent animationType="fade" onRequestClose={() => setEditVisible(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setEditVisible(false)}>
          <Pressable style={styles.editModal} onPress={() => {}}>
            <Text style={styles.editModalTitle}>Update Room Number</Text>
            <TextInput
              style={styles.editInput}
              value={editedRoom}
              onChangeText={setEditedRoom}
              placeholder="Room Number"
              placeholderTextColor="#A0A5B3"
              keyboardType="number-pad"
            />
            <View style={styles.editModalActions}>
              <TouchableOpacity style={[styles.editBtn2, styles.cancelBtn]} onPress={() => setEditVisible(false)} disabled={saving}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.editBtn2, styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={saveRoomEdit} disabled={saving}>
                <Text style={styles.saveText}>{saving ? 'Saving…' : 'Update'}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */
function taskTime(t: Task): number {
  return Number(t.RoutingOfferedAt ?? t.CreatedTime ?? t.timestamp ?? 0);
}
const SLA_MS_SORT = 15 * 60 * 1000;
function isTaskEscalated(t: Task, now: number): boolean {
  const stage = (t.Stage ?? '').toString().trim().toLowerCase();
  if (['completed', 'delivered', 'cancelled', 'closed'].includes(stage)) return false;
  if (t.Escalated || (t.EscalationLevel && t.EscalationLevel > 0)) return true;
  const started = Number(t.TimerStartTime || 0);
  if (started && now - started > SLA_MS_SORT) return true;
  const assigned = Number(t.AssignedTime || 0);
  const hasTimer = Number(t.TimerStartTime || t.AcceptedTime || 0);
  if (!hasTimer && assigned && now - assigned > SLA_MS_SORT) return true;
  return false;
}
function sortNewestFirst(list: Task[]): Task[] {
  const now = Date.now();
  return [...list].sort((a, b) => {
    const aEsc = isTaskEscalated(a, now) ? 1 : 0;
    const bEsc = isTaskEscalated(b, now) ? 1 : 0;
    if (bEsc !== aEsc) return bEsc - aEsc;
    return taskTime(b) - taskTime(a);
  });
}
function relativeTime(raw: any): string {
  const ms = Number(raw);
  if (!Number.isFinite(ms) || ms <= 0) return '';
  const delta = Math.max(0, Date.now() - ms);
  const days  = Math.floor(delta / 86400000);
  const hours = Math.floor(delta / 3600000);
  const mins  = Math.floor(delta / 60000);
  if (days > 0)  return `${days}d`;
  if (hours > 0) return `${hours}h`;
  if (mins > 0)  return `${mins} mins`;
  return 'Just now';
}
function priorityChipColors(priority: string): { bg: string; text: string } {
  const p = priority.toLowerCase();
  if (p === 'high' || p === 'high priority') return { bg: PINK_BG, text: PINK_TEXT };
  if (p === 'important') return { bg: '#FEF3C7', text: '#92400E' };
  return { bg: '#D1FAE5', text: '#065F46' };
}

/* ─── Styles ─────────────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },


  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 4,
    backgroundColor: '#F0F3FF',
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: {
    backgroundColor: WHITE,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  tabText: { fontSize: 12, fontWeight: '600', color: TEXT_SOFT },
  tabTextActive: { color: TEAL, fontWeight: '700' },

  listContent: { padding: 16, paddingTop: 10, paddingBottom: 32, flexGrow: 1 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  emptyText: { color: TEXT_SOFT, fontSize: 15 },

  card: {
    flexDirection: 'row',
    backgroundColor: WHITE,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 10,
    overflow: 'hidden',
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  cardPaused: { borderColor: '#FCD34D', backgroundColor: '#FFFBEB' },
  accentBar: { width: 5, backgroundColor: TEAL },
  cardInner: { flex: 1, padding: 12 },

  chipsRow: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  roomChip: { backgroundColor: '#EFF6FF', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  roomChipText: { fontSize: 11, color: '#1D4ED8', fontWeight: '600' },
  deptChip: { backgroundColor: '#F3F4F6', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  deptChipText: { fontSize: 11, color: '#374151', fontWeight: '600' },
  priorityChip: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  priorityChipText: { fontSize: 11, fontWeight: '700' },
  timeChip: { backgroundColor: '#F3F4F6', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  timeChipText: { fontSize: 11, color: TEXT_SOFT, fontWeight: '500' },
  pausedChip: { backgroundColor: '#FEF3C7', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  pausedChipText: { fontSize: 11, color: '#92400E', fontWeight: '600' },

  cardTitle: { fontSize: 15, fontWeight: '700', color: TEXT_DARK, lineHeight: 22, marginBottom: 3 },
  assignedTo: { fontSize: 12, color: TEXT_SOFT, marginBottom: 2 },
  unassigned: { fontSize: 12, color: TEXT_SOFT, marginBottom: 2 },

  divider: { height: 1, backgroundColor: BORDER, marginVertical: 10 },

  actionRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  assignBtn: {
    flex: 1, height: 44, borderRadius: 50,
    backgroundColor: TEAL,
    justifyContent: 'center', alignItems: 'center',
  },
  reassignBtn: { backgroundColor: '#6B7280' },
  assignBtnText: { color: WHITE, fontSize: 14, fontWeight: '700' },

  editBtn: {
    width: 44, height: 44, borderRadius: 50,
    borderWidth: 2, borderColor: TEAL,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: WHITE,
  },
  editBtnText: { fontSize: 18, color: TEAL },

  transferBtn: {
    marginLeft: 8,
    backgroundColor: '#2563EB',
    borderRadius: 50,
    paddingHorizontal: 12,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  transferBtnText: { color: WHITE, fontSize: 13, fontWeight: '700' },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', paddingHorizontal: 24 },
  editModal: { backgroundColor: WHITE, borderRadius: 14, padding: 16 },
  editModalTitle: { fontSize: 16, fontWeight: '700', color: TEXT_DARK, marginBottom: 12 },
  editInput: {
    borderWidth: 1, borderColor: BORDER, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 15, color: TEXT_DARK, backgroundColor: WHITE,
  },
  editModalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 14 },
  editBtn2: { borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10 },
  cancelBtn: { backgroundColor: '#F3F4F6' },
  cancelText: { fontSize: 13, fontWeight: '600', color: '#586075' },
  saveBtn: { backgroundColor: TEAL },
  saveBtnDisabled: { opacity: 0.65 },
  saveText: { fontSize: 13, fontWeight: '700', color: WHITE },
});
