/**
 * Attendant Dashboard — matches Royal_Android dashBoardfragmentAttendant.java
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Task, RootStackParamList } from '../../types';
import { TasksService, UsersService } from '../../services/firebase';
import { COLORS, slaForDepartment } from '../../utils/constants';
import { useAuthStore } from '../../store/useAuthStore';
import { startTaskAlert, stopTaskAlert, subscribeToTaskAlert } from '../../services/taskAlert';
import { AttendantDashboardHeader } from '../../components/common/AttendantDashboardHeader';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const TEAL = '#0052CC';
const TEAL_LIGHT = '#E7EEFF';
const WHITE = '#FFFFFF';
const BG = '#F9F9FF';
const TEXT_DARK = '#101C2D';
const TEXT_MID = '#434654';
const TEXT_SOFT = '#737685';
const BORDER = '#E2E8F0';
const ORANGE = '#F97316';
const RED = '#DC2626';
const RED_BG = '#FEE2E2';
const RED_BORDER = '#FCA5A5';

type DashTab = 'New' | 'InProgress' | 'Completed';

export function AttendantDashboardScreen() {
  const navigation = useNavigation<Nav>();
  const { employeeId, name, department, status, setStatus, profilePicUrl, hotelName } = useAuthStore();
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [nowMs, setNowMs] = useState(Date.now());
  const [alertActive, setAlertActive] = useState(false);
  const [activeTab, setActiveTab] = useState<DashTab>('New');
  const insets = useSafeAreaInsets();

  useEffect(() => subscribeToTaskAlert(setAlertActive), []);

  // Real-time listener on the current user's Firestore document.
  // Catches external status changes (e.g. admin deactivates from the
  // dashboard) and syncs them into the local Zustand store instantly.
  useEffect(() => {
    if (!employeeId) return;
    return UsersService.subscribeToUser(employeeId, (user) => {
      if (!user) return;
      // Always sync — Zustand won't re-render if value is unchanged.
      // Avoids stale-closure bugs from capturing `status` at mount time.
      setStatus(user.Status === true);
    });
  }, [employeeId]);

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Track which assigned tasks we've already seen so the ringtone only
  // fires for newly-assigned ones, not on every snapshot the listener
  // emits (e.g. when an unrelated field on an existing task changes).
  // First snapshot after login is treated as "already seen" so a fresh
  // login doesn't ring for old open tasks.
  const seenTaskIds = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!employeeId) return;
    return TasksService.subscribeToTasksForAttendant(employeeId, (tasks) => {
      // Broadened from assigned/executed only — the new three-column layout
      // also shows the attendant's recently-completed tickets.
      const visible = tasks.filter((t) => {
        const stage = (t.Stage ?? '').toString().trim().toLowerCase();
        return stage === 'assigned' || stage === 'executed' || stage === 'completed';
      });

      // ─── New-assignment ringtone ───
      // A task counts as "newly assigned to me" when its Stage=Assigned and
      // we haven't seen it in a previous snapshot. Reattempts also re-ring
      // because the manager just sent it back to the attendant.
      const currentAssignedIds = new Set<string>();
      for (const t of visible) {
        const stage = (t.Stage ?? '').toString().trim().toLowerCase();
        if (stage === 'assigned') currentAssignedIds.add(t.TaskId);
      }
      if (seenTaskIds.current === null) {
        // First snapshot — seed without ringing.
        seenTaskIds.current = currentAssignedIds;
      } else {
        let hasNew = false;
        for (const id of currentAssignedIds) {
          if (!seenTaskIds.current.has(id)) {
            hasNew = true;
            break;
          }
        }
        seenTaskIds.current = currentAssignedIds;
        if (hasNew) void startTaskAlert();
      }

      setMyTasks(sortNewestFirst(visible));
    });
  }, [employeeId]);

  // Stop the ringtone when the screen unmounts (logout, navigation away).
  useEffect(() => {
    return () => {
      void stopTaskAlert();
    };
  }, []);

  // Bucket tasks for the three columns. The semantics here follow what
  // the attendant cares about, not the raw Stage enum:
  //
  //  • New      — Assigned but not yet started (no workflowStep) +
  //               Assigned + accepted (started, warm-coloured card).
  //  • Ongoing  — En Route / At Location, plus paused tasks where the
  //               guest asked the attendant to come back later
  //               (DeliveryStatus=NotCompleted, no Reattempt).
  //  • Done     — Awaiting approval (Stage=Executed) at the top,
  //               manager-approved (Stage=Completed) at the bottom in
  //               light green.
  const buckets = React.useMemo(() => {
    const newCol: Task[] = [];
    const ongoing: Task[] = [];
    const done: Task[] = [];
    for (const t of myTasks) {
      const stage = (t.Stage ?? '').toString().trim().toLowerCase();
      const wf = (t.WorkflowStep ?? '').toString().trim().toLowerCase();
      const isPaused =
        (t.DeliveryStatus ?? '').toString().toLowerCase() === 'notcompleted' && !t.Reattempt;

      if (stage === 'completed' || stage === 'executed') {
        done.push(t);
        continue;
      }
      if (isPaused) {
        ongoing.push(t);
        continue;
      }
      if (wf === 'enroute' || wf === 'atlocation') {
        ongoing.push(t);
        continue;
      }
      // Stage=Assigned, workflow empty or 'accepted' → still a "new" task.
      // Started ones (accepted) get a warmer card colour inside the column.
      newCol.push(t);
    }
    // Within each column, push the visually-distinct items to the top:
    //   • New       — started (accepted) above untouched (Pending).
    //   • Ongoing   — paused (come-later) above truly in-progress.
    //   • Completed — awaiting approval above approved.
    const sortNew = (list: Task[]) =>
      [...list].sort((a, b) => {
        const aw = (a.WorkflowStep ?? '').toString().trim().toLowerCase();
        const bw = (b.WorkflowStep ?? '').toString().trim().toLowerCase();
        return (bw === 'accepted' ? 1 : 0) - (aw === 'accepted' ? 1 : 0);
      });
    const sortOngoing = (list: Task[]) =>
      [...list].sort((a, b) => {
        const ap =
          (a.DeliveryStatus ?? '').toString().toLowerCase() === 'notcompleted' && !a.Reattempt
            ? 1
            : 0;
        const bp =
          (b.DeliveryStatus ?? '').toString().toLowerCase() === 'notcompleted' && !b.Reattempt
            ? 1
            : 0;
        return bp - ap;
      });
    const sortDone = (list: Task[]) =>
      [...list].sort((a, b) => {
        const aPending = (a.Stage ?? '').toString().toLowerCase() === 'executed' ? 1 : 0;
        const bPending = (b.Stage ?? '').toString().toLowerCase() === 'executed' ? 1 : 0;
        return bPending - aPending;
      });
    return {
      newCol: sortNew(newCol),
      ongoing: sortOngoing(ongoing),
      done: sortDone(done),
    };
  }, [myTasks]);

  async function handleToggleStatus(val: boolean) {
    if (!employeeId || !name || !department) return;
    await UsersService.setActiveStatus(employeeId, name, department, val);
    await setStatus(val);
  }

  const initial = name?.[0]?.toUpperCase() ?? '?';

  // Inline card actions — kept here so the Column tree stays a thin
  // presentation layer.
  const handleStartTask = async (t: Task) => {
    void stopTaskAlert();
    try {
      // "Start" on the card maps to En Route. The task is already
      // auto-Accepted on assignment, so En Route is the first explicit
      // attendant action — and the per-card execution timer in the UI
      // tracks elapsed-since-EnRoute (falling back to created time).
      await TasksService.markTaskEnRoute(t.TaskId);
    } catch (e) {
      console.warn('[Dashboard] markTaskEnRoute failed:', e);
    }
  };
  const handleCompleteWithPhoto = async (t: Task) => {
    void stopTaskAlert();
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert('Permission needed', 'Camera permission is required to capture a delivery photo.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.6,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      navigation.navigate('TaskUpdate', {
        taskId: t.TaskId,
        task: t,
        initialPhotoUri: result.assets[0].uri,
      });
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not open camera');
    }
  };
  const handleCompleteWithoutPhoto = (t: Task) => {
    void stopTaskAlert();
    if (!status) { Alert.alert('Status Inactive', 'YOUR STATUS IS NOT ACTIVE'); return; }
    navigation.navigate('TaskUpdate', { taskId: t.TaskId, task: t });
  };

  const handleViewDetails = (t: Task) => {
    void stopTaskAlert();
    navigation.navigate('TaskDetails', { taskId: t.TaskId, task: t });
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <AttendantDashboardHeader
        hotelName={hotelName}
        name={name}
        profilePicUrl={profilePicUrl}
        status={status}
        onToggleStatus={handleToggleStatus}
        onAvatarPress={() => navigation.navigate('Profile')}
      />

      {/* Active-alert banner with explicit stop control. Shown only while
          the ringtone is actively playing — auto-hides when the alert
          times out, the screen unmounts, or a card is tapped. */}
      {alertActive ? (
        <View style={styles.alertBar}>
          <View style={styles.alertBarLeft}>
            <Text style={styles.alertBarIcon}>🔔</Text>
            <Text style={styles.alertBarText}>New task assigned — tap a card to view, or stop the ringtone.</Text>
          </View>
          <TouchableOpacity
            onPress={() => { void stopTaskAlert(); }}
            activeOpacity={0.85}
            style={styles.alertBarStopBtn}
          >
            <Text style={styles.alertBarStopText}>Stop</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Tab bar: New · In-Progress · Completed (with counts) */}
      <View style={styles.tabContainer}>
        {(['New', 'InProgress', 'Completed'] as DashTab[]).map((tab) => {
          const count =
            tab === 'New' ? buckets.newCol.length :
            tab === 'InProgress' ? buckets.ongoing.length :
            buckets.done.length;
          const label =
            tab === 'New' ? 'New' :
            tab === 'InProgress' ? 'In-Progress' : 'Completed';
          const isActive = activeTab === tab;
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
              activeOpacity={0.85}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {label}
                {' '}
                <Text style={[styles.tabCount, isActive && styles.tabCountActive]}>
                  ({count})
                </Text>
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Active-tab column */}
      {myTasks.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>✅</Text>
          <Text style={styles.emptyTitle}>All clear!</Text>
          <Text style={styles.emptyText}>No active tasks assigned to you</Text>
        </View>
      ) : activeTab === 'New' ? (
        <Column
          title="New"
          count={buckets.newCol.length}
          accent={TEAL}
          tasks={buckets.newCol}
          nowMs={nowMs}
          variantFor={(t) => {
            const wf = (t.WorkflowStep ?? '').toString().trim().toLowerCase();
            return wf === 'accepted' ? 'started' : 'unstarted';
          }}
          onViewDetails={handleViewDetails}
          onStart={handleStartTask}
          onCompleteWithPhoto={handleCompleteWithPhoto}
          onCompleteWithoutPhoto={handleCompleteWithoutPhoto}
          emptyText="Nothing new"
          fullWidth
        />
      ) : activeTab === 'InProgress' ? (
        <Column
          title="In-Progress"
          count={buckets.ongoing.length}
          accent={ORANGE}
          tasks={buckets.ongoing}
          nowMs={nowMs}
          variantFor={(t) => {
            const isPaused =
              (t.DeliveryStatus ?? '').toString().toLowerCase() === 'notcompleted' &&
              !t.Reattempt;
            return isPaused ? 'paused' : 'inprogress';
          }}
          onViewDetails={handleViewDetails}
          onStart={handleStartTask}
          onCompleteWithPhoto={handleCompleteWithPhoto}
          onCompleteWithoutPhoto={handleCompleteWithoutPhoto}
          emptyText="No tasks in progress"
          fullWidth
        />
      ) : (
        <Column
          title="Completed"
          count={buckets.done.length}
          accent={'#15803D'}
          tasks={buckets.done}
          nowMs={nowMs}
          variantFor={(t) => {
            const stage = (t.Stage ?? '').toString().toLowerCase();
            return stage === 'completed' ? 'approved' : 'awaitingApproval';
          }}
          onViewDetails={handleViewDetails}
          onStart={handleStartTask}
          onCompleteWithPhoto={handleCompleteWithPhoto}
          onCompleteWithoutPhoto={handleCompleteWithoutPhoto}
          emptyText="Nothing completed yet"
          fullWidth
        />
      )}
    </View>
  );
}

type CardVariant =
  | 'unstarted'
  | 'started'
  | 'inprogress'
  | 'paused'
  | 'awaitingApproval'
  | 'approved';

function Column({
  title,
  count,
  accent,
  tasks,
  nowMs,
  variantFor,
  onViewDetails,
  onStart,
  onCompleteWithPhoto,
  onCompleteWithoutPhoto,
  emptyText,
  fullWidth = false,
}: {
  title: string;
  count: number;
  accent: string;
  tasks: Task[];
  nowMs: number;
  variantFor: (t: Task) => CardVariant;
  onViewDetails: (t: Task) => void;
  onStart: (t: Task) => void;
  onCompleteWithPhoto: (t: Task) => void;
  onCompleteWithoutPhoto: (t: Task) => void;
  emptyText: string;
  fullWidth?: boolean;
}) {
  return (
    <View style={[styles.column, fullWidth && styles.columnFullWidth]}>
      <View style={styles.columnHeader}>
        <View style={[styles.columnDot, { backgroundColor: accent }]} />
        <Text style={styles.columnTitle}>{title}</Text>
        <View style={styles.columnCount}>
          <Text style={styles.columnCountText}>{count}</Text>
        </View>
      </View>
      {tasks.length === 0 ? (
        <View style={styles.columnEmpty}>
          <Text style={styles.columnEmptyText}>{emptyText}</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} style={styles.columnScroll}>
          {tasks.map((t) => (
            <TaskCard
              key={t.TaskId}
              task={t}
              nowMs={nowMs}
              variant={variantFor(t)}
              onViewDetails={() => onViewDetails(t)}
              onStart={() => onStart(t)}
              onCompleteWithPhoto={() => onCompleteWithPhoto(t)}
              onCompleteWithoutPhoto={() => onCompleteWithoutPhoto(t)}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

// Per-variant card colours. Keeping this inline so the bucketing logic
// above and the visual treatment stay in lockstep.
const VARIANT_STYLES: Record<CardVariant, { bg: string; border: string; accent: string }> = {
  unstarted: { bg: '#FFFFFF', border: BORDER, accent: TEAL },
  started: { bg: '#FFF7ED', border: '#FED7AA', accent: ORANGE },     // warm: started but not en route
  inprogress: { bg: '#FFFFFF', border: BORDER, accent: TEAL },
  paused: { bg: '#FEF3C7', border: '#FCD34D', accent: '#B45309' },  // come-later
  awaitingApproval: { bg: '#FFFFFF', border: BORDER, accent: '#1E3A8A' },
  approved: { bg: '#ECFDF5', border: '#A7F3D0', accent: '#15803D' },  // light green
};

function TaskCard({
  task, nowMs, onViewDetails, onStart, onCompleteWithPhoto, onCompleteWithoutPhoto, variant = 'unstarted',
}: {
  task: Task;
  nowMs: number;
  onViewDetails: () => void;
  onStart: () => void;
  onCompleteWithPhoto: () => void;
  onCompleteWithoutPhoto: () => void;
  variant?: CardVariant;
}) {
  const roomDisplay = task.UpdatedRoomNo ? `${task.RoomNo} → ${task.UpdatedRoomNo}` : task.RoomNo || '--';
  const dept = (task.Department || '').toString();
  const priority = (task.Priority || 'Routine').toString();
  const title = (task.ItemOrdered || task.Note || task.GuestName || `Room ${task.RoomNo}`).toString();

  const workflow = (task.WorkflowStep ?? '').toString().trim().toLowerCase();
  const isStarted = workflow === 'enroute' || workflow === 'atlocation';
  const isCompleted = (task.Stage ?? '').toString().trim().toLowerCase() === 'completed';
  const isExecuted = (task.Stage ?? '').toString().trim().toLowerCase() === 'executed';
  const isPaused = (task.DeliveryStatus ?? '').toString().toLowerCase() === 'notcompleted' && !task.Reattempt;

  // Journey indicator (Accepted → En Route → At Location → Done) — shown
  // only on the New column where the attendant hasn't started executing
  // yet, so they can see where the task is in its lifecycle. Once started,
  // the inline action buttons replace it.
  const isNewColumn = variant === 'unstarted' || variant === 'started';
  const journeySteps = ['Accepted', 'En Route', 'At Location', 'Done'];
  const journeyIndex =
    workflow === 'enroute' ? 1 :
      workflow === 'atlocation' ? 2 :
        isCompleted || isExecuted ? 3 :
          workflow === 'accepted' ? 0 : 0;

  const pChip = priorityChipColors(priority);

  // Live elapsed timer since the ticket was created (falls back to
  // CreatedTime → AssignedTime → RoutingOfferedAt as the most reasonable
  // creation-anchor we have on the doc).
  const createdMs = Number(task.CreatedTime ?? task.AssignedTime ?? task.RoutingOfferedAt ?? 0);
  const elapsedMs = createdMs > 0 ? Math.max(0, nowMs - createdMs) : 0;

  // Per-department SLA — housekeeping 10m, F&B/IRD 20m, others 15m.
  // Card flips to red once we're past it, regardless of stage.
  const slaMs = slaForDepartment(dept);
  const overSla = elapsedMs > slaMs && !isCompleted;

  const v = VARIANT_STYLES[variant];
  const cardBg = overSla ? RED_BG : v.bg;
  const cardBorder = overSla ? RED_BORDER : v.border;
  const accentColor = overSla ? RED : v.accent;

  return (
    <View style={[cStyles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
      {/* Left accent bar — colour reflects variant or red-on-overdue */}
      <View style={[cStyles.accentBar, { backgroundColor: accentColor }]} />

      <View style={cStyles.cardInner}>
        {/* Top row: Room number + Department + Priority */}
        <View style={cStyles.topRow}>
          <Text style={cStyles.roomNoBig}>🏠 {roomDisplay}</Text>
          {dept ? (
            <View style={cStyles.deptChip}>
              <Text style={cStyles.deptChipText}>{dept}</Text>
            </View>
          ) : null}
          {priority.toLowerCase() !== 'routine' ? (
            <View style={[cStyles.priorityChip, { backgroundColor: pChip.bg }]}>
              <Text style={[cStyles.priorityChipText, { color: pChip.text }]}>{priority}</Text>
            </View>
          ) : null}
        </View>

        {/* Title (tap to open full details). Stays here so attendants can
            still read the request line on the card. */}
        <TouchableOpacity onPress={onViewDetails} activeOpacity={0.8}>
          <Text style={cStyles.title} numberOfLines={2}>{title}</Text>
        </TouchableOpacity>

        {/* Live elapsed-time row + SLA target. Red when over SLA. */}
        <View style={cStyles.timerRow}>
          <View style={cStyles.timerBlock}>
            <Text style={cStyles.timerLabel}>Elapsed</Text>
            <Text style={[cStyles.timerValue, overSla && cStyles.timerValueRed]}>
              {formatElapsed(elapsedMs)}
            </Text>
          </View>
          <View style={cStyles.timerBlock}>
            <Text style={cStyles.timerLabel}>SLA Target</Text>
            <Text style={[cStyles.timerValue, overSla && cStyles.timerValueRed]}>
              {formatStaticMinutes(slaMs)}
            </Text>
          </View>
        </View>

        {isPaused ? (
          <View style={cStyles.pausedRow}>
            <Text style={cStyles.pausedText}>
              On hold — {(task.NotDeliveredReason1 || 'guest unavailable').toString()}
            </Text>
          </View>
        ) : null}

        <View style={cStyles.divider} />

        {/* Inline actions:
              • Not started  → single "Start" button (sets WorkflowStep=EnRoute).
              • Started      → Complete (with photo) + Complete (without photo) [disabled].
              • Executed     → "Awaiting Approval" pill.
              • Completed    → "View Details". */}
        {isCompleted ? (
          <TouchableOpacity style={[cStyles.actionBtn, cStyles.viewBtn]} onPress={onViewDetails} activeOpacity={0.85}>
            <Text style={cStyles.actionBtnText}>View Details</Text>
          </TouchableOpacity>
        ) : isExecuted ? (
          <View style={[cStyles.actionBtn, cStyles.awaitingBtn]}>
            <Text style={cStyles.actionBtnText}>Awaiting Approval…</Text>
          </View>
        ) : !isStarted ? (
          <TouchableOpacity style={cStyles.actionBtn} onPress={onStart} activeOpacity={0.85}>
            <Text style={cStyles.actionBtnText}>Start</Text>
          </TouchableOpacity>
        ) : (
          <View style={cStyles.actionRow}>
            <TouchableOpacity
              style={[cStyles.smallActionBtn, cStyles.completePhotoBtn]}
              onPress={onCompleteWithPhoto}
              activeOpacity={0.85}
            >
              <Text style={cStyles.smallActionIcon}>📷</Text>
              <Text style={cStyles.smallActionText} numberOfLines={1} adjustsFontSizeToFit>
                Complete
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[cStyles.smallActionBtn, cStyles.noPhotoBtn]}
              onPress={onCompleteWithoutPhoto}
              activeOpacity={0.85}
            >
              <Text style={cStyles.smallActionText} numberOfLines={1} adjustsFontSizeToFit>
                No Photo
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

// hh:mm:ss when over an hour, else mm:ss. Used for the live elapsed timer
// — re-rendered every second by the parent's nowMs tick.
function formatElapsed(ms: number): string {
  const safe = Math.max(0, ms);
  const totalSec = Math.floor(safe / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

function formatStaticMinutes(ms: number): string {
  return `${Math.round(ms / 60000)} min`;
}

function priorityChipColors(priority: string): { bg: string; text: string } {
  const p = priority.toLowerCase();
  if (p === 'high' || p === 'high priority') return { bg: '#FFDAD6', text: '#93000A' };
  if (p === 'important') return { bg: '#FEF3C7', text: '#92400E' };
  return { bg: '#D1FAE5', text: '#065F46' };
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */

// Canonical map handles stored typos/variants (e.g. "engeneering" → "engineering")
const DEPT_CANON: Record<string, string> = {
  engineering: 'engineering',
  engeneering: 'engineering',
  engeenering: 'engineering',
  enginiring: 'engineering',
  engineersupport: 'engineering',
  technicalsupport: 'engineering',
  maintenance: 'engineering',
  maintainance: 'engineering',
  technical: 'engineering',
  housekeeping: 'housekeeping',
  house_keeping: 'housekeeping',
  foodandbeverages: 'foodandbeverages',
  foodandbeverage: 'foodandbeverages',
  food_and_beverages: 'foodandbeverages',
  food_and_beverage: 'foodandbeverages',
  inroomdining: 'foodandbeverages',
  inroom_dining: 'foodandbeverages',
  fnb: 'foodandbeverages',
  roomservice: 'foodandbeverages',
  foodbeveragesupport: 'foodandbeverages',
  foodandbeveragesupport: 'foodandbeverages',
  frontdesk: 'frontdesk',
  front_desk: 'frontdesk',
  emergencyservices: 'frontdesk',
  emergencyresponse: 'frontdesk',
  handlegeneralinquiries: 'frontdesk',
  safety: 'frontdesk',
};
function canonDept(d: string): string {
  return DEPT_CANON[d] ?? d;
}
function deptMatches(taskDept: string, myDept: string): boolean {
  return canonDept(taskDept) === canonDept(myDept);
}

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

/* ─── Styles ──────────────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },


  listContent: { padding: 16, paddingTop: 8, paddingBottom: 40, flexGrow: 1 },

  sectionTitle: { fontSize: 15, fontWeight: '700', color: TEXT_DARK, marginBottom: 10 },

  pendingScroll: { flexShrink: 1, maxHeight: 420 },
  pendingScrollContent: { padding: 16, paddingBottom: 4 },

  activeSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  activeDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: ORANGE,
  },

  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60, gap: 6 },
  emptyEmoji: { fontSize: 36 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: TEXT_DARK },
  emptyText: { color: TEXT_SOFT, fontSize: 13 },

  // Active-alert banner
  alertBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderBottomWidth: 1,
    borderBottomColor: '#FCD34D',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  alertBarLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  alertBarIcon: { fontSize: 18 },
  alertBarText: { flex: 1, color: '#78350F', fontSize: 13, fontWeight: '700' },
  alertBarStopBtn: {
    backgroundColor: '#B45309',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  alertBarStopText: { color: WHITE, fontSize: 13, fontWeight: '800', letterSpacing: 0.3 },

  // Tab bar
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#EEF1F7',
    borderRadius: 999,
    padding: 4,
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: {
    backgroundColor: WHITE,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  tabText: { fontSize: 13, fontWeight: '600', color: TEXT_MID, letterSpacing: 0.4 },
  tabTextActive: { color: TEAL, fontWeight: '700' },
  tabCount: { fontSize: 12, fontWeight: '700', color: TEXT_SOFT },
  tabCountActive: { color: TEAL },

  // Three-column board (legacy / horizontal layout when stacking columns)
  boardContent: { paddingHorizontal: 12, paddingVertical: 12, gap: 12 },
  column: {
    width: 320,
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 6,
  },
  columnFullWidth: {
    width: undefined,
    flex: 1,
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 12,
  },
  columnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
    paddingBottom: 10,
  },
  columnDot: { width: 10, height: 10, borderRadius: 5 },
  columnTitle: { fontSize: 14, fontWeight: '800', color: TEXT_DARK, letterSpacing: 0.2 },
  columnCount: {
    backgroundColor: WHITE,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 'auto',
  },
  columnCountText: { fontSize: 11, fontWeight: '700', color: TEXT_MID },
  columnScroll: { paddingTop: 2 },
  columnEmpty: { paddingVertical: 24, alignItems: 'center' },
  columnEmptyText: { color: TEXT_SOFT, fontSize: 12 },
});

/* Active task card styles */
const cStyles = StyleSheet.create({
  card: {
    backgroundColor: WHITE,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 12,
    flexDirection: 'row',
    overflow: 'hidden',
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  accentBar: {
    width: 5,
    backgroundColor: TEAL,
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
  },
  cardInner: { flex: 1, padding: 12 },
  chipsRow: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  roomNumberChip: {
    backgroundColor: '#EFF6FF',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  roomNumberText: { fontSize: 11, color: '#1D4ED8', fontWeight: '600' },
  deptChip: {
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  deptChipText: { fontSize: 11, color: TEXT_MID, fontWeight: '600' },
  priorityChip: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  priorityChipText: { fontSize: 11, fontWeight: '700' },
  timeChip: {
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  timeChipText: { fontSize: 11, color: TEXT_SOFT, fontWeight: '500' },
  title: { fontSize: 15, fontWeight: '700', color: TEXT_DARK, lineHeight: 22, marginBottom: 10 },

  progressWrap: { marginBottom: 8 },
  progressLine: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  progressDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: BORDER,
    borderWidth: 2,
    borderColor: BORDER,
  },
  progressDotActive: {
    backgroundColor: TEAL,
    borderColor: TEAL,
  },
  progressSegment: {
    flex: 1, height: 2,
    backgroundColor: BORDER,
  },
  progressSegmentActive: {
    backgroundColor: TEAL,
  },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel: { fontSize: 9, color: TEXT_SOFT, fontWeight: '500' },

  slaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  slaIcon: { fontSize: 11, color: ORANGE },
  slaText: { fontSize: 11, color: ORANGE, fontWeight: '600' },
  slaWarnText: { fontSize: 11, color: TEAL, fontWeight: '600' },

  divider: { height: 1, backgroundColor: BORDER, marginVertical: 10 },
  actionBtn: {
    backgroundColor: TEAL,
    borderRadius: 50,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  viewBtn: { backgroundColor: TEXT_SOFT },
  awaitingBtn: { backgroundColor: '#1E3A8A' },
  actionBtnText: { color: WHITE, fontSize: 14, fontWeight: '700' },
  actionBtnIcon: { fontSize: 14 },

  // New card layout
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' },
  roomNoBig: { fontSize: 16, fontWeight: '800', color: TEXT_DARK, letterSpacing: 0.2 },

  // Journey strip (New column only)
  journeyWrap: { marginBottom: 8 },
  journeyLine: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  journeyDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: BORDER,
    borderWidth: 2,
    borderColor: BORDER,
  },
  journeyDotActive: { backgroundColor: TEAL, borderColor: TEAL },
  journeySegment: { flex: 1, height: 2, backgroundColor: BORDER },
  journeySegmentActive: { backgroundColor: TEAL },
  journeyLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  journeyLabel: { fontSize: 9, color: TEXT_SOFT, fontWeight: '500' },
  timerRow: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  timerBlock: { flex: 1 },
  timerLabel: { fontSize: 10, fontWeight: '700', color: TEXT_SOFT, letterSpacing: 0.4, textTransform: 'uppercase' },
  timerValue: { fontSize: 18, fontWeight: '800', color: TEXT_DARK, marginTop: 2, fontVariant: ['tabular-nums'] },
  timerValueRed: { color: RED },
  pausedRow: {
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 8,
  },
  pausedText: { fontSize: 11, color: '#78350F', fontWeight: '700' },

  // Inline action buttons after Start
  actionRow: { flexDirection: 'row', gap: 8 },
  smallActionBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 8,
  },
  completePhotoBtn: { backgroundColor: TEAL },
  noPhotoBtn: { backgroundColor: '#64748B' },
  disabledBtn: { backgroundColor: '#E2E8F0' },
  smallActionIcon: { fontSize: 13 },
  smallActionText: { color: WHITE, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  disabledText: { color: '#94A3B8' },
});
