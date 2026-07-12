/**
 * Attendant Tasks Screen — matches Royal_Android taskforAttentdent.java
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Task, RootStackParamList } from '../../types';
import { TasksService } from '../../services/firebase';
import { COLORS } from '../../utils/constants';
import { useAuthStore } from '../../store/useAuthStore';
import { AppTopBar } from '../../components/common/AppTopBar';
import { ScreenHeader } from '../../components/common/ScreenHeader';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type AttendantTab = 'OnGoing' | 'Completed';

const TEAL = '#0052CC';
const PRIMARY = '#003D9B';
const WHITE = '#FFFFFF';
const BG = '#F9F9FF';
const TEXT_DARK = '#101C2D';
const TEXT_SOFT = '#737685';
const BORDER = '#E2E8F0';
const ORANGE = '#F97316';

export function AttendantTasksScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { employeeId, name, status } = useAuthStore();
  const [allMyTasks, setAllMyTasks] = useState<Task[]>([]);
  const [activeTab, setActiveTab] = useState<AttendantTab>('OnGoing');

  useEffect(() => {
    if (!employeeId) return;
    return TasksService.subscribeToTasksForAttendant(employeeId, setAllMyTasks);
  }, [employeeId]);

  const myName = (name ?? '').trim().toLowerCase();

  // Ongoing now includes:
  //   • Stage=Assigned + workflow EnRoute/AtLocation (actively being worked)
  //   • Stage=Executed (waiting on manager approval)
  //   • Paused tasks where guest asked to come later (DeliveryStatus=NotCompleted, no Reattempt)
  // The card row applies a distinct yellow background to paused entries.
  const onGoingTasks = allMyTasks.filter((t) => {
    if ((t.AssignedToName ?? '').trim().toLowerCase() !== myName) return false;
    const stage = (t.Stage ?? '').trim().toLowerCase();
    const wf = (t.WorkflowStep ?? '').toString().trim().toLowerCase();
    const isPaused =
      (t.DeliveryStatus ?? '').toString().toLowerCase() === 'notcompleted' && !t.Reattempt;
    if (stage === 'executed') return true;
    if (stage === 'assigned' && (wf === 'enroute' || wf === 'atlocation')) return true;
    if (isPaused) return true;
    return false;
  });

  const completedTasks = allMyTasks.filter(
    (t) =>
      (t.Stage ?? '').trim().toLowerCase() === 'completed' &&
      (t.AssignedToName ?? '').trim().toLowerCase() === myName
  );

  const tabData: Record<AttendantTab, Task[]> = {
    OnGoing: onGoingTasks,
    Completed: completedTasks,
  };

  async function handleVerifyWithPhoto(task: Task) {
    if (!status) { Alert.alert('Status Inactive', 'YOUR STATUS IS NOT ACTIVE'); return; }
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('Permission needed', 'Camera permission is required to verify order.');
      return;
    }
    const shot = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.6 });
    if (shot.canceled || !shot.assets?.[0]?.uri) return;
    navigation.navigate('TaskUpdate', { taskId: task.TaskId, task, initialPhotoUri: shot.assets[0].uri });
  }

  function handleVerifyWithoutPhoto(task: Task) {
    if (!status) { Alert.alert('Status Inactive', 'YOUR STATUS IS NOT ACTIVE'); return; }
    navigation.navigate('TaskUpdate', { taskId: task.TaskId, task });
  }

  function handleViewDetails(task: Task) {
    navigation.navigate('TaskDetails', { taskId: task.TaskId, task });
  }

  return (
    <View style={styles.root}>
      <ScreenHeader title="Tasks" topInset={insets.top} />
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={styles.tabBtn}
          onPress={() => setActiveTab('OnGoing')}
          activeOpacity={0.85}
        >
          <Text style={[styles.tabText, activeTab === 'OnGoing' && styles.tabTextActive]}>
            Ongoing
          </Text>
          {activeTab === 'OnGoing' && <View style={styles.tabUnderline} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'Completed' && styles.tabBtnCompleted]}
          onPress={() => setActiveTab('Completed')}
          activeOpacity={0.85}
        >
          <Text style={[styles.tabText, activeTab === 'Completed' && styles.tabTextCompleted]}>
            Completed
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={tabData[activeTab]}
        keyExtractor={(item) => item.TaskId}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {activeTab === 'OnGoing' ? 'No ongoing tasks' : 'No completed tasks'}
            </Text>
          </View>
        }
        renderItem={({ item }) =>
          activeTab === 'OnGoing' ? (
            <TaskCard
              task={item}
              onCardPress={() => handleViewDetails(item)}
              onCompleteTask={() => handleVerifyWithPhoto(item)}
              onVerifyWithoutPhoto={() => handleVerifyWithoutPhoto(item)}
            />
          ) : (
            <TaskCard
              task={item}
              isCompleted
              onCardPress={() => handleViewDetails(item)}
              onAction={() => handleViewDetails(item)}
            />
          )
        }
      />
    </View>
  );
}

/* ─── Task Card ── */
function TaskCard({
  task,
  isCompleted = false,
  onCardPress,
  onCompleteTask,
  onVerifyWithoutPhoto,
  onAction,
}: {
  task: Task;
  isCompleted?: boolean;
  onCardPress: () => void;
  onCompleteTask?: () => void;
  onVerifyWithoutPhoto?: () => void;
  onAction?: () => void;
}) {
  const title = (task.ItemOrdered || task.Note || task.GuestName || `Room ${task.RoomNo}`).toString();
  const roomNo = (task.UpdatedRoomNo || task.RoomNo || '--').toString();
  const dept = (task.Department || '').toString();
  const priority = (task.Priority || 'Routine').toString();
  const isPaused = (task.DeliveryStatus ?? '').toLowerCase() === 'notcompleted' && !task.Reattempt;
  const timeLabel = relativeTime(task.AssignedTime);
  const workflow = (task.WorkflowStep ?? '').toString().trim().toLowerCase();
  const slaExceeded = !!task.SlaAlertSent;

  const steps = ['Accepted', 'En Route', 'At Location', 'Done'];
  const stepIndex = workflow === 'accepted' ? 0 : workflow === 'enroute' ? 1 : workflow === 'atlocation' ? 2 : isCompleted ? 3 : 0;

  const pChip = priorityChipColors(priority);

  return (
    <View style={[styles.card, isPaused && styles.cardPaused]}>
      <View style={styles.accentBar} />

      <View style={styles.cardInner}>
        {/* Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          <View style={styles.roomChip}>
            <Text style={styles.roomChipIcon}>🏠</Text>
            <Text style={styles.roomChipText}>{roomNo}</Text>
          </View>
          {dept ? (
            <View style={styles.deptChip}>
              <Text style={styles.deptChipText}>{dept}</Text>
            </View>
          ) : null}
          {timeLabel ? (
            <View style={styles.timeChip}>
              <Text style={styles.timeChipText}>{timeLabel}</Text>
            </View>
          ) : null}
          {isPaused ? (
            <View style={styles.pausedChip}>
              <Text style={styles.pausedChipText}>On Hold</Text>
            </View>
          ) : null}
        </ScrollView>

        {/* Title */}
        <TouchableOpacity onPress={onCardPress} activeOpacity={0.75}>
          <Text style={styles.cardTitle} numberOfLines={2}>{title}</Text>
        </TouchableOpacity>

        {/* SLA warning */}
        {slaExceeded && !isCompleted && (
          <View style={styles.slaRow}>
            <Text style={styles.slaIcon}>⚠</Text>
            <Text style={styles.slaText}>SLA exceeded</Text>
          </View>
        )}

        {/* Action button */}
        {isCompleted ? (
          <TouchableOpacity style={styles.actionBtn} onPress={onAction} activeOpacity={0.85}>
            <Text style={styles.actionBtnText}>View Details</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.completeBtn} onPress={onCompleteTask} activeOpacity={0.85}>
            <Text style={styles.completeBtnIcon}>📷</Text>
            <Text style={styles.completeBtnText}>Complete Task →</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

/* ─── Helpers ── */
function relativeTime(raw: any): string {
  const ms = Number(raw);
  if (!Number.isFinite(ms) || ms <= 0) return '';
  const delta = Math.max(0, Date.now() - ms);
  const days = Math.floor(delta / 86400000);
  const hours = Math.floor(delta / 3600000);
  const mins = Math.floor(delta / 60000);
  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours} hours`;
  if (mins > 0) return `${mins} mins`;
  return 'Just now';
}
function priorityChipColors(priority: string): { bg: string; text: string } {
  const p = priority.toLowerCase();
  if (p === 'high' || p === 'high priority') return { bg: '#FEE2E2', text: '#9F1239' };
  if (p === 'important') return { bg: '#FEF3C7', text: '#92400E' };
  return { bg: '#D1FAE5', text: '#065F46' };
}

/* ─── Styles ── */
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: WHITE },

  pageTitle: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '800',
    color: TEXT_DARK,
    paddingVertical: 16,
    backgroundColor: WHITE,
  },

  // Tab row — matches image: "Ongoing" teal text with underline, "Completed" grey pill
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    gap: 0,
  },
  tabBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    alignItems: 'center',
    position: 'relative',
  },
  tabBtnCompleted: {
    backgroundColor: '#E5E7EB',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  tabText: { fontSize: 15, fontWeight: '600', color: TEXT_SOFT },
  tabTextActive: { color: TEAL, fontWeight: '700' },
  tabTextCompleted: { color: TEXT_SOFT, fontWeight: '600' },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 20,
    right: 20,
    height: 2,
    backgroundColor: TEAL,
    borderRadius: 1,
  },

  listContent: { paddingHorizontal: 16, paddingBottom: 32, flexGrow: 1 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  emptyText: { color: TEXT_SOFT, fontSize: 15 },

  // Card
  card: {
    flexDirection: 'row',
    backgroundColor: WHITE,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  cardPaused: { borderColor: '#FCD34D', backgroundColor: '#FFFBEB' },
  accentBar: { width: 5, backgroundColor: TEAL },
  cardInner: { flex: 1, padding: 12 },

  chipsRow: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  roomChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: TEAL, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, gap: 4 },
  roomChipIcon: { fontSize: 11 },
  roomChipText: { fontSize: 11, color: WHITE, fontWeight: '700' },
  deptChip: { backgroundColor: '#F3F4F6', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  deptChipText: { fontSize: 11, color: TEXT_SOFT, fontWeight: '600' },
  timeChip: { backgroundColor: '#F3F4F6', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  timeChipText: { fontSize: 11, color: TEXT_SOFT, fontWeight: '500' },
  pausedChip: { backgroundColor: '#FEF3C7', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  pausedChipText: { fontSize: 11, color: '#92400E', fontWeight: '600' },

  cardTitle: { fontSize: 16, fontWeight: '700', color: TEXT_DARK, lineHeight: 22, marginBottom: 12 },

  // Progress tracker
  progressWrap: { marginBottom: 8 },
  progressTrack: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  progressDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: BORDER },
  progressDotActive: { backgroundColor: TEAL },
  progressSegment: { flex: 1, height: 2, backgroundColor: BORDER },
  progressSegmentActive: { backgroundColor: TEAL },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel: { fontSize: 9, color: TEXT_SOFT, fontWeight: '500' },

  // SLA
  slaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  slaIcon: { fontSize: 11, color: ORANGE },
  slaText: { fontSize: 11, color: ORANGE, fontWeight: '600' },

  // Buttons
  completeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: TEAL,
    borderRadius: 50,
    height: 48,
    gap: 8,
    marginTop: 4,
  },
  completeBtnIcon: { fontSize: 16 },
  completeBtnText: { color: WHITE, fontSize: 15, fontWeight: '700' },

  actionBtn: {
    backgroundColor: TEXT_SOFT,
    borderRadius: 50,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  actionBtnText: { color: WHITE, fontSize: 15, fontWeight: '700' },
});
