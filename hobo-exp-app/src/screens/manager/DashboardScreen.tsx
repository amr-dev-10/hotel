/**
 * Manager Dashboard — matches Royal_Android DashBoardFragmentManager.java
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Switch,
  Modal,
  Pressable,
  FlatList,
  TextInput,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Task, RootStackParamList, Department } from '../../types';
import { TasksService, UsersService, NotificationsService, ClaimNotification } from '../../services/backend';
import { COLORS, slaForDepartment } from '../../utils/constants';
import { fetchHotelDepartments, getDepartmentOptions } from '../../services/departmentService';
import { useAuthStore } from '../../store/useAuthStore';
import { ProfileDetails } from '../../types';
import { AssignTaskModal } from '../../components/task/AssignTaskModal';
import { UserAvatar } from '../../components/common/UserAvatar';
import { ManagerDashboardHeader } from '../../components/common/ManagerDashboardHeader';
import { stopTaskAlert, subscribeToTaskAlert } from '../../services/taskAlert';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type DashTab = 'New' | 'InProgress' | 'Completed';

const PRIMARY = '#003D9B';
const PRIMARY_CT = '#0052CC';
const TEAL = '#0C9488';
const TEAL_LIGHT = '#E6F7F6';
const SECONDARY = '#00687A';
const WHITE = '#FFFFFF';
const BG = '#F9F9FF';
const SURFACE_LO = '#F0F3FF';
const SURFACE_CT = '#DEE9FF';
const SURFACE_HI = '#D7E3FB';
const TEXT_DARK = '#101C2D';
const TEXT_MID = '#434654';
const TEXT_SOFT = '#737685';
const BORDER = '#E2E8F0';
const OUTLINE_VAR = '#C3C6D6';
const GREEN_DOT = '#10B981';
const GREY_DOT = '#D1D5DB';
const PINK_BG = '#FFDAD6';
const PINK_TEXT = '#93000A';
const SECONDARY_FX = '#ADECFF';
const SECONDARY_C = '#00D9FE';

export function ManagerDashboardScreen() {
  const navigation = useNavigation<Nav>();
  const { name, profilePicUrl, status, employeeId, department: userDept, hotelId, setStatus, jobRole, isHotelOwner } = useAuthStore();
  const normalizeRole = (r?: string) => (r ?? '').toString().trim().toLowerCase();
  // Normalize a department value the same way everywhere so 'Food_and_beverages',
  // 'food and beverages' etc. all compare equal.
  const normDept = (v: any) => (v == null ? '' : String(v).trim().toLowerCase().replace(/[\s_-]+/g, '_'));
  // Owners see every department; a department manager/front desk is locked to
  // their own department only.
  const isOwner = !!isHotelOwner;

  const [deptOptions, setDeptOptions] = useState<{ key: string; label: string }[]>([{ key: 'ALL', label: 'All Departments' }]);
  useEffect(() => {
    if (hotelId) {
      fetchHotelDepartments(hotelId).then((list) => {
        const all = getDepartmentOptions(list, isOwner); // 'All Departments' only for owners
        if (isOwner) {
          setDeptOptions(all);
        } else {
          // Lock a department manager to just their own department.
          const mine = all.filter((o) => normDept(o.key) === normDept(userDept));
          setDeptOptions(mine.length > 0 ? mine : [{ key: (userDept as string) ?? 'ALL', label: (userDept as string) ?? 'My Department' }]);
        }
      });
    }
  }, [hotelId, isOwner, userDept]);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [employees, setEmployees] = useState<ProfileDetails[]>([]);
  const [activeTab, setActiveTab] = useState<DashTab>('New');
  const [filterDept, setFilterDept] = useState<Department>((userDept as Department) ?? 'ALL');
  const [showDept, setShowDept] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());
  const [claimAlert, setClaimAlert] = useState<ClaimNotification | null>(null);
  const [alertActive, setAlertActive] = useState(false);
  const seenNotifIds = React.useRef<Set<string>>(new Set());
  const insets = useSafeAreaInsets();

  // Mirror the global escalation-ringtone state so the manager gets a
  // visible "Stop" control while it's playing — the escalation alarm is
  // fired from MainTabNavigator/escalationService, not this screen.
  useEffect(() => subscribeToTaskAlert(setAlertActive), []);

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => { return TasksService.subscribeToAllTasks(setTasks); }, []);
  useEffect(() => { return UsersService.subscribeToAllEmployees(setEmployees); }, []);

  // Live listener on this user's backend profile so admin-initiated
  // status changes are reflected immediately in the toggle.
  useEffect(() => {
    if (!employeeId) return;
    return UsersService.subscribeToUser(employeeId, (user) => {
      if (!user) return;
      setStatus(user.Status === true);
    });
  }, [employeeId]);

  // (SLA-escalation sweep + escalation alerts now run in MainTabNavigator so
  // they stay active across all manager/owner tabs, not just this screen.)

  useEffect(() => {
    const isFirstLoad = { current: true };
    return NotificationsService.subscribeToClaimNotifications((notifications) => {
      if (isFirstLoad.current) {
        notifications.forEach((n) => seenNotifIds.current.add(n.id));
        isFirstLoad.current = false;
        return;
      }
      const unseen = notifications.find((n) => !seenNotifIds.current.has(n.id));
      if (unseen) {
        seenNotifIds.current.add(unseen.id);
        setClaimAlert(unseen);
        if (employeeId) {
          void NotificationsService.markRead(unseen.id, employeeId).catch(() => undefined);
        }
      }
    });
  }, [employeeId]);

  async function handleToggleStatus(val: boolean) {
    if (!employeeId || !name || !userDept) return;
    await UsersService.setActiveStatus(employeeId, name, userDept, val);
    await setStatus(val);
  }

  function stageOf(t: Task) {
    return (t.Stage ?? '').toString().trim().toLowerCase();
  }
  function byDept(list: Task[]) {
    // Department manager / front desk: hard-locked to their own department,
    // regardless of the (hidden) filter — so they never see other departments.
    if (!isOwner) {
      const mine = normDept(userDept);
      if (!mine) return list; // department unknown — can't filter, show all
      return list.filter((t) => normDept(t.Department) === mine);
    }
    // Owner: honour the dropdown selection.
    if (filterDept === 'ALL') return list;
    return list.filter((t) => normDept(t.Department) === normDept(filterDept));
  }

  // All three tabs are department-filtered (previously only "New" was).
  const newTasks = sortNewestFirst(byDept(
    tasks.filter((t) => { const s = stageOf(t); return s === 'created' || s === 'assigned' || s === '' || s === 'new'; })
  ));
  const inProgressTasks = sortNewestFirst(byDept(tasks.filter((t) => stageOf(t) === 'executed')));
  const completedTasks = sortNewestFirst(byDept(tasks.filter((t) => stageOf(t) === 'completed')));

  const tabTasks: Record<DashTab, Task[]> = {
    New: newTasks, InProgress: inProgressTasks, Completed: completedTasks,
  };

  const deptLabel = isOwner
    ? (deptOptions.find((d) => normDept(d.key) === normDept(filterDept))?.label ?? 'All Departments')
    : (deptOptions[0]?.label ?? (userDept as string) ?? 'My Department');
  const initial = name?.[0]?.toUpperCase() ?? 'M';

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>

      <ManagerDashboardHeader
        name={name}
        profilePicUrl={profilePicUrl}
        onAvatarPress={() => navigation.navigate('Profile')}
      />

      {/* ── Claim alert banner ── */}
      {claimAlert ? (
        <View style={styles.claimBanner}>
          <View style={styles.claimBannerLeft}>
            <Text style={styles.claimBannerIcon}>🔔</Text>
            <View>
              <Text style={styles.claimBannerTitle}>Ticket Claimed</Text>
              <Text style={styles.claimBannerBody} numberOfLines={1}>
                {claimAlert.attendantName} claimed
                {claimAlert.itemOrdered ? ` "${claimAlert.itemOrdered}"` : ' a ticket'}
                {claimAlert.roomNo ? ` · Room ${claimAlert.roomNo}` : ''}
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => setClaimAlert(null)} style={styles.claimBannerClose}>
            <Text style={styles.claimBannerCloseText}>✕</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* ── Escalation ringtone banner with explicit Stop control. Shown
          only while the alarm is actively playing; tapping Stop silences it
          and — since there is no periodic re-ring — it won't return for the
          same ticket. ── */}
      {alertActive ? (
        <View style={styles.alertBar}>
          <View style={styles.alertBarLeft}>
            <Text style={styles.alertBarIcon}>🔔</Text>
            <Text style={styles.alertBarText}>Ticket escalation alert — review the task, or stop the ringtone.</Text>
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

      <FlatList
        data={tabTasks[activeTab]}
        keyExtractor={(item) => item.TaskId}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 24 }]}
        ListHeaderComponent={
          <>
            {/* ── Welcome / Availability ── */}
            <View style={styles.welcomeRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.eyebrow}>DASHBOARD</Text>
                <Text style={styles.welcomeName} numberOfLines={1}>Hello, {(name ?? 'Manager').split(' ')[0]}</Text>
              </View>
              <View style={styles.availWrap}>
                <Text style={styles.availLabel}>AVAILABILITY</Text>
                <View style={styles.availRow}>
                  <Switch
                    value={!!status}
                    onValueChange={handleToggleStatus}
                    trackColor={{ false: '#D1D5DB', true: PRIMARY_CT }}
                    thumbColor={WHITE}
                    ios_backgroundColor='#D1D5DB'
                  />
                  <Text style={[styles.availStatus, { color: status ? PRIMARY_CT : TEXT_SOFT }]}>
                    {status ? 'Active' : 'Inactive'}
                  </Text>
                </View>
              </View>
            </View>

            {/* ── Team on Duty ── */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Team on Duty</Text>
            </View>

            <FlatList
              data={employees}
              horizontal
              keyExtractor={(item) => item.EmployeeId}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.teamList}
              ListEmptyComponent={<Text style={styles.avatarEmptyText}>No team members</Text>}
              renderItem={({ item: emp }) => {
                const isActive = !!emp.Status;
                return (
                  <View style={styles.teamItem}>
                    <View style={styles.teamAvatarWrap}>
                      <View style={[styles.teamAvatarRing, !isActive && { opacity: 0.6 }]}>
                        <UserAvatar profileImage={emp.ProfileImage} name={emp.Name} size={60} />
                      </View>
                      <View style={[styles.teamStatusDot, { backgroundColor: isActive ? GREEN_DOT : GREY_DOT }]} />
                    </View>
                    <Text style={[styles.teamName, !isActive && { color: TEXT_SOFT }]} numberOfLines={1}>
                      {emp.Name ?? ''}
                    </Text>
                  </View>
                );
              }}
            />

            {/* ── Tab row ── */}
            <View style={styles.tabContainer}>
              {(['New', 'InProgress', 'Completed'] as DashTab[]).map((tab) => (
                <TouchableOpacity
                  key={tab}
                  style={[styles.tab, activeTab === tab && styles.tabActive]}
                  onPress={() => setActiveTab(tab)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                    {tab === 'New' ? 'New' : tab === 'InProgress' ? 'In-Progress' : 'Completed'}
                    {' '}
                    <Text style={[styles.tabCount, activeTab === tab && styles.tabCountActive]}>
                      ({tabTasks[tab].length})
                    </Text>
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* ── Department filter ── Owners can switch departments; a department
                manager is locked to their own (shown read-only). ── */}
            <View style={styles.deptWrap}>
              <Text style={styles.deptLabel}>Department</Text>
              <TouchableOpacity
                style={styles.deptDropdown}
                onPress={isOwner ? () => setShowDept(true) : undefined}
                activeOpacity={isOwner ? 0.85 : 1}
                disabled={!isOwner}
              >
                <Text style={styles.deptDropdownText}>{deptLabel}</Text>
                {isOwner ? <Text style={styles.deptArrow}>▾</Text> : <Ionicons name="lock-closed" size={13} color={TEXT_SOFT} />}
              </TouchableOpacity>
            </View>

            {/* ── Tasks section header ── */}
            <View style={[styles.sectionHeader, { marginTop: 16 }]}>
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionTitle}>
                  {activeTab === 'New' ? 'Urgent Tasks' : activeTab === 'InProgress' ? 'In-Progress' : 'Completed'}
                </Text>
                {tabTasks[activeTab].length > 0 ? (
                  <View style={styles.countPill}>
                    <Text style={styles.countPillText}>{tabTasks[activeTab].length} {activeTab === 'New' ? 'NEW' : ''}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </>
        }
        renderItem={({ item }) => (
          <DashCard
            task={item}
            tab={activeTab}
            nowMs={nowMs}
            onPress={() => navigation.navigate('TaskDetails', { taskId: item.TaskId, task: item })}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>📋</Text>
            <Text style={styles.emptyText}>No tasks in this category</Text>
          </View>
        }
      />

      {/* ── Department picker modal ── */}
      <Modal visible={showDept} transparent animationType="slide" onRequestClose={() => setShowDept(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowDept(false)}>
          <Pressable style={styles.deptSheet} onPress={() => { }}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Filter by Department</Text>
            {deptOptions.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.deptOption, filterDept === opt.key && styles.deptOptionActive]}
                onPress={() => { setFilterDept(opt.key as Department); setShowDept(false); }}
              >
                <Text style={[styles.deptOptionText, filterDept === opt.key && styles.deptOptionTextActive]}>
                  {opt.label}
                </Text>
                {filterDept === opt.key ? <Text style={styles.deptCheck}>✓</Text> : null}
              </TouchableOpacity>
            ))}
            <View style={{ height: 20 }} />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

/* ─── Task Card ── */
function DashCard({ task, tab, nowMs, onPress }: { task: Task; tab: DashTab; nowMs: number; onPress: () => void }) {
  const [assignVisible, setAssignVisible] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [editedRoomNo, setEditedRoomNo] = useState(task.UpdatedRoomNo || task.RoomNo || '');
  const [savingEdit, setSavingEdit] = useState(false);

  const raw = task as any;
  const str = (v: any) => (v == null ? '' : String(v).trim());

  const assignedName = str(task.AssignedToName);
  const roomValue = str(task.UpdatedRoomNo || task.RoomNo || raw.roomNo || '');
  const priorityValue = str(task.Priority || raw.priority || 'Routine');
  const dept = str(task.Department || raw.department || '');
  const deliveryStatus = str(task.DeliveryStatus || raw.deliveryStatus).toLowerCase();
  const hasReattempt = !!(task.Reattempt || raw.Reattempt || raw.reattempt);
  const assignedTime = task.AssignedTime || raw.assignedTime || raw.timestamp || task.timestamp;
  const workflow = str(task.WorkflowStep || raw.workflowStep).toLowerCase();
  const trackingStep = workflow === 'accepted' || workflow === 'enroute' || workflow === 'atlocation';
  const timerStartMs = Number(task.TimerStartTime || raw.timerStartTime || 0);
  const slaMs = slaForDepartment(dept);
  const remainingMs = timerStartMs > 0 ? Math.max(0, slaMs - (nowMs - timerStartMs)) : 0;
  const showSla = stageOf(task) === 'assigned' && trackingStep && timerStartMs > 0;
  const isPaused = deliveryStatus === 'notcompleted' && !hasReattempt;
  const isDelivered = deliveryStatus === 'completed' || deliveryStatus === 'delivered';
  const title = str(task.ItemOrdered || task.Note || task.GuestName || `Room ${task.RoomNo}`);
  const pChip = priorityChipColors(priorityValue);
  const timeLabel = relativeTime(assignedTime, nowMs);

  async function handleSaveRoomEdit() {
    const next = editedRoomNo.trim();
    if (!next) { Alert.alert('Required', 'Room number cannot be empty'); return; }
    setSavingEdit(true);
    try {
      await TasksService.updateTask(task.TaskId, { UpdatedRoomNo: next });
      setEditVisible(false);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to update');
    } finally {
      setSavingEdit(false);
    }
  }

  const deptIconName = getDeptIcon(dept);

  // Subtitle line under the title
  const subtitleParts: string[] = [];
  if (dept) subtitleParts.push(dept.replace(/_/g, ' '));
  if (timeLabel) subtitleParts.push(timeLabel === 'Just now' ? 'Just now' : `${timeLabel} ago`);
  const subtitle = subtitleParts.join(' • ');

  // Priority pill label/colors
  const priorityLabel = (() => {
    const p = priorityValue.toLowerCase();
    if (p === 'high' || p === 'urgent') return 'HIGH PRIORITY';
    if (p === 'important' || p === 'medium') return 'NORMAL';
    return 'LOW';
  })();

  function renderRightAction() {
    if (tab === 'Completed') {
      return (
        <TouchableOpacity style={styles.primaryActionBtn} onPress={onPress} activeOpacity={0.85}>
          <Text style={styles.primaryActionText}>View</Text>
        </TouchableOpacity>
      );
    }
    if (tab === 'InProgress') {
      if (isPaused && !hasReattempt) {
        return (
          <TouchableOpacity style={[styles.primaryActionBtn, { backgroundColor: '#F97316' }]} onPress={onPress} activeOpacity={0.85}>
            <Text style={styles.primaryActionText}>Resume</Text>
          </TouchableOpacity>
        );
      }
      if ((isPaused && hasReattempt) || isDelivered) {
        return (
          <TouchableOpacity style={styles.primaryActionBtn} onPress={onPress} activeOpacity={0.85}>
            <Text style={styles.primaryActionText}>Approve</Text>
          </TouchableOpacity>
        );
      }
    }
    if (assignedName) {
      return (
        <TouchableOpacity style={styles.primaryActionBtn} onPress={() => setAssignVisible(true)} activeOpacity={0.85}>
          <Text style={styles.primaryActionText}>Re-assign</Text>
        </TouchableOpacity>
      );
    }
    return (
      <TouchableOpacity style={styles.primaryActionBtn} onPress={() => setAssignVisible(true)} activeOpacity={0.85}>
        <Text style={styles.primaryActionText}>Assign Now</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.card, isPaused && tab === 'InProgress' && styles.cardPaused]}>
      {/* Top row — icon badge + title/sub on left, priority pill on right */}
      <View style={styles.cardTopRow}>
        <View style={styles.cardTitleRow}>
          <View style={styles.iconBadge}>
            <Ionicons name={deptIconName as any} size={22} color={PRIMARY_CT} />
          </View>
          <View style={{ flex: 1 }}>
            <TouchableOpacity onPress={onPress} activeOpacity={0.75}>
              <Text style={styles.cardTitle} numberOfLines={2}>
                {title}{roomValue && !title.toLowerCase().includes('room') ? ` in Room ${roomValue}` : ''}
              </Text>
            </TouchableOpacity>
            {subtitle ? (
              <Text style={styles.cardSubtitle} numberOfLines={1}>{subtitle}</Text>
            ) : null}
            <Text style={styles.cardAssignedTo} numberOfLines={1}>
              {assignedName ? `Assigned to: ${assignedName}` : 'Unassigned'}
            </Text>
          </View>
        </View>
        <View style={[styles.priorityPill, { backgroundColor: pChip.bg }]}>
          <Text style={[styles.priorityPillText, { color: pChip.text }]} numberOfLines={1}>
            {priorityLabel}
          </Text>
        </View>
      </View>

      {/* Status chips row */}
      {(isPaused || showSla) ? (
        <View style={styles.statusChipsRow}>
          {isPaused ? (
            <View style={styles.pausedChip}>
              <Text style={styles.pausedChipText}>On Hold</Text>
            </View>
          ) : null}
          {showSla ? (
            <View style={[styles.slaChip, task.SlaAlertSent && styles.slaChipError]}>
              <Text style={[styles.slaChipText, task.SlaAlertSent && styles.slaChipTextError]}>
                {task.SlaAlertSent ? 'SLA Exceeded' : `SLA ${formatCountdown(remainingMs)}`}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Footer — divider, then assigned-avatar (or unassigned warn) + Details/Action */}
      <View style={styles.cardFooter}>
        {assignedName ? (
          <View style={styles.assignedAvatarStack}>
            <View style={styles.assignedAvatarMain}>
              <Ionicons name="person" size={14} color="#fff" />
            </View>
            <View style={styles.assignedAvatarPlus}>
              <Text style={styles.assignedAvatarPlusText}>+1</Text>
            </View>
          </View>
        ) : (
          <View style={styles.unassignedBadge}>
            <Ionicons name="warning-outline" size={14} color={PINK_TEXT} />
            <Text style={styles.unassignedText}>Unassigned</Text>
          </View>
        )}

        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.editIconBtn}
            onPress={() => { setEditedRoomNo(task.UpdatedRoomNo || task.RoomNo || ''); setEditVisible(true); }}
            activeOpacity={0.7}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Ionicons name="create-outline" size={18} color={TEXT_MID} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.detailsBtn} onPress={onPress} activeOpacity={0.7}>
            <Text style={styles.detailsBtnText}>Details</Text>
          </TouchableOpacity>
          {renderRightAction()}
        </View>
      </View>

      <AssignTaskModal
        visible={assignVisible}
        taskId={task.TaskId}
        department={task.Department}
        onClose={() => setAssignVisible(false)}
        onAssigned={() => setAssignVisible(false)}
      />

      <Modal visible={editVisible} transparent animationType="slide" onRequestClose={() => setEditVisible(false)}>
        <Pressable style={styles.editModalBackdrop} onPress={() => setEditVisible(false)}>
          <Pressable style={styles.editSheet} onPress={() => { }}>
            <View style={styles.sheetHandle} />
            <Text style={styles.editModalTitle}>Edit Room Number</Text>
            <TextInput
              style={styles.editInput}
              value={editedRoomNo}
              onChangeText={setEditedRoomNo}
              placeholder="Room Number"
              placeholderTextColor={TEXT_SOFT}
              keyboardType="number-pad"
            />
            <View style={styles.editModalActions}>
              <TouchableOpacity style={[styles.editActionBtn, styles.editCancelBtn]} onPress={() => setEditVisible(false)} disabled={savingEdit}>
                <Text style={styles.editCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.editActionBtn, styles.editSaveBtn, savingEdit && styles.editSaveBtnDisabled]} onPress={handleSaveRoomEdit} disabled={savingEdit}>
                <Text style={styles.editSaveText}>{savingEdit ? 'Saving...' : 'Update'}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

/* ─── Helpers ── */
function getDeptIcon(dept: string): string {
  const d = (dept || '').toLowerCase().replace(/[\s_-]+/g, '');
  if (d.includes('engineer') || d.includes('maintenance')) return 'construct-outline';
  if (d.includes('housekeep')) return 'sparkles-outline';
  if (d.includes('food') || d.includes('beverage') || d.includes('dining')) return 'restaurant-outline';
  if (d.includes('frontdesk') || d.includes('reception')) return 'desktop-outline';
  if (d.includes('laundry')) return 'shirt-outline';
  if (d.includes('electric')) return 'flash-outline';
  return 'briefcase-outline';
}
function stageOf(t: Task) { return (t.Stage ?? '').toString().trim().toLowerCase(); }
function taskTime(t: Task) { return Number(t.RoutingOfferedAt ?? t.CreatedTime ?? t.timestamp ?? 0); }
const SLA_MS_SORT = 15 * 60 * 1000;
function isTaskEscalated(t: Task, now: number): boolean {
  const stage = stageOf(t);
  if (['completed', 'delivered', 'cancelled', 'closed'].includes(stage)) return false;
  if (t.Escalated || (t.EscalationLevel && t.EscalationLevel > 0)) return true;
  const started = Number(t.TimerStartTime || 0);
  if (started && now - started > SLA_MS_SORT) return true;
  const assigned = Number(t.AssignedTime || 0);
  const hasTimer = Number(t.TimerStartTime || t.AcceptedTime || 0);
  if (!hasTimer && assigned && now - assigned > SLA_MS_SORT) return true;
  return false;
}
function sortNewestFirst(list: Task[]) {
  const now = Date.now();
  return [...list].sort((a, b) => {
    const aEsc = isTaskEscalated(a, now) ? 1 : 0;
    const bEsc = isTaskEscalated(b, now) ? 1 : 0;
    if (bEsc !== aEsc) return bEsc - aEsc;
    return taskTime(b) - taskTime(a);
  });
}
function priorityChipColors(priority: string): { bg: string; text: string } {
  const p = priority.toLowerCase();
  if (p === 'high' || p === 'high priority' || p === 'urgent') return { bg: PINK_BG, text: PINK_TEXT };
  if (p === 'important' || p === 'medium') return { bg: SECONDARY_FX, text: '#005B6B' };
  return { bg: '#A9FF8F', text: '#1A8100' };
}
function relativeTime(raw: any, nowMs: number): string {
  const ms = Number(raw);
  if (!Number.isFinite(ms) || ms <= 0) return '';
  const delta = Math.max(0, nowMs - ms);
  const days = Math.floor(delta / 86400000);
  const hours = Math.floor(delta / 3600000);
  const mins = Math.floor(delta / 60000);
  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  if (mins > 0) return `${mins} mins`;
  return 'Just now';
}
function formatCountdown(ms: number) {
  const safe = Math.max(0, ms);
  const mins = Math.floor(safe / 60000);
  const secs = Math.floor((safe % 60000) / 1000);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/* ─── Styles ── */
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  // TopAppBar
  topBarIconBtn: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
  },

  claimBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#1F2937',
    marginHorizontal: 16, marginTop: 10, marginBottom: 4,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    elevation: 4,
  },
  claimBannerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 },
  claimBannerIcon: { fontSize: 20 },
  claimBannerTitle: { fontSize: 11, fontWeight: '800', color: '#F9FAFB', textTransform: 'uppercase', letterSpacing: 0.8 },
  claimBannerBody: { fontSize: 12, color: '#9CA3AF', fontWeight: '500', marginTop: 2 },
  claimBannerClose: { paddingLeft: 10 },
  claimBannerCloseText: { color: '#9CA3AF', fontSize: 16, fontWeight: '700' },

  // Escalation ringtone alert bar (with Stop)
  alertBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: PINK_BG,
    marginHorizontal: 16, marginTop: 10, marginBottom: 4,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    elevation: 4,
  },
  alertBarLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 },
  alertBarIcon: { fontSize: 20 },
  alertBarText: { flex: 1, fontSize: 12, color: PINK_TEXT, fontWeight: '600', lineHeight: 16 },
  alertBarStopBtn: {
    backgroundColor: PINK_TEXT, borderRadius: 8,
    paddingHorizontal: 16, paddingVertical: 8, marginLeft: 10,
  },
  alertBarStopText: { color: WHITE, fontSize: 13, fontWeight: '800', letterSpacing: 0.3 },

  // Welcome row
  welcomeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 16,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '600',
    color: PRIMARY_CT,
    letterSpacing: 1.6,
    marginBottom: 4,
  },
  welcomeName: {
    fontSize: 26,
    fontWeight: '700',
    color: TEXT_DARK,
    letterSpacing: -0.5,
  },
  availWrap: { alignItems: 'flex-end', gap: 6 },
  availLabel: {
    fontSize: 11,
    color: TEXT_SOFT,
    letterSpacing: 0.6,
    fontWeight: '500',
  },
  availRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  availStatus: {
    fontSize: 13,
    fontWeight: '700',
  },

  // Section header (Team on Duty / Urgent Tasks)
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 12,
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT_DARK,
    letterSpacing: -0.2,
  },
  sectionLink: {
    fontSize: 13,
    fontWeight: '600',
    color: PRIMARY,
  },
  countPill: {
    backgroundColor: PINK_BG,
    borderRadius: 9999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  countPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: PINK_TEXT,
    letterSpacing: 0.4,
  },
  tuneBtn: { padding: 4 },

  // Team list
  teamList: {
    paddingHorizontal: 20,
    paddingBottom: 4,
    gap: 16,
  },
  teamItem: { alignItems: 'center', width: 64 },
  teamAvatarWrap: { position: 'relative', marginBottom: 6 },
  teamAvatarRing: {
    width: 60, height: 60, borderRadius: 16,
    backgroundColor: WHITE,
    overflow: 'hidden',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: WHITE,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  teamStatusDot: {
    position: 'absolute', bottom: -2, right: -2,
    width: 14, height: 14, borderRadius: 7,
    borderWidth: 2, borderColor: WHITE,
  },
  teamName: {
    fontSize: 12,
    color: TEXT_MID,
    fontWeight: '500',
    textAlign: 'center',
    width: 64,
  },
  avatarEmptyText: { fontSize: 12, color: TEXT_SOFT, paddingHorizontal: 20, paddingVertical: 8 },

  // Tab row — soft-blue tray with white active pill
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 4,
    backgroundColor: SURFACE_LO,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1, height: 36, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  tabActive: {
    backgroundColor: WHITE,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  tabText: { fontSize: 13, fontWeight: '600', color: TEXT_MID, letterSpacing: 0.4 },
  tabTextActive: { color: PRIMARY, fontWeight: '700' },
  tabCount:        { fontSize: 12, fontWeight: '700', color: TEXT_SOFT },
  tabCountActive:  { color: PRIMARY },

  // Department filter
  deptWrap: { marginHorizontal: 20, marginTop: 12, marginBottom: 4 },
  deptLabel: { fontSize: 12, fontWeight: '600', color: TEXT_MID, marginBottom: 6 },
  deptDropdown: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: WHITE, borderRadius: 10,
    borderWidth: 1, borderColor: BORDER,
    paddingHorizontal: 14, height: 46,
  },
  deptDropdownText: { fontSize: 14, color: TEXT_DARK, fontWeight: '500' },
  deptArrow: { fontSize: 14, color: TEXT_SOFT },

  listContent: { paddingHorizontal: 20, paddingTop: 4 },

  // Card — compact white card with icon + title
  card: {
    backgroundColor: WHITE,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    padding: 16,
    marginBottom: 12,
    elevation: 4,
    shadowColor: '#0052CC',
    shadowOpacity: 0.06,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
  },
  cardPaused: { backgroundColor: '#FFFBEB' },

  // Top row
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 12,
  },
  cardTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  iconBadge: {
    width: 44, height: 44,
    borderRadius: 8,
    backgroundColor: 'rgba(0,82,204,0.10)',
    justifyContent: 'center', alignItems: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT_DARK,
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  cardSubtitle: {
    fontSize: 13,
    color: TEXT_MID,
    marginTop: 2,
    lineHeight: 18,
  },
  cardAssignedTo: {
    fontSize: 12,
    color: PRIMARY,
    fontWeight: '600',
    marginTop: 3,
  },

  priorityPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
    alignSelf: 'flex-start',
  },
  priorityPillText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
  },

  // Status chips row (paused / SLA)
  statusChipsRow: {
    flexDirection: 'row', gap: 6, marginBottom: 8,
  },
  pausedChip: { backgroundColor: '#FEF3C7', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  pausedChipText: { fontSize: 11, color: '#92400E', fontWeight: '600' },
  slaChip: { backgroundColor: SURFACE_CT, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  slaChipText: { fontSize: 11, color: PRIMARY, fontWeight: '600' },
  slaChipError: { backgroundColor: PINK_BG },
  slaChipTextError: { color: PINK_TEXT },

  // Footer
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
    gap: 8,
  },
  cardActions: { flexDirection: 'row', gap: 4, alignItems: 'center' },

  // Avatar stack
  assignedAvatarStack: { flexDirection: 'row', alignItems: 'center' },
  assignedAvatarMain: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: SECONDARY,
    borderWidth: 2, borderColor: WHITE,
    justifyContent: 'center', alignItems: 'center',
  },
  assignedAvatarPlus: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#F1F5F9',
    borderWidth: 2, borderColor: WHITE,
    justifyContent: 'center', alignItems: 'center',
    marginLeft: -8,
  },
  assignedAvatarPlusText: { fontSize: 10, fontWeight: '700', color: '#64748B' },

  // Unassigned warning
  unassignedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  unassignedText: {
    fontSize: 12,
    color: PINK_TEXT,
    fontWeight: '600',
  },

  // Buttons
  editIconBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  detailsBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  detailsBtnText: {
    fontSize: 13,
    color: PRIMARY,
    fontWeight: '600',
  },
  primaryActionBtn: {
    backgroundColor: PRIMARY_CT,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  primaryActionText: {
    fontSize: 13,
    color: WHITE,
    fontWeight: '600',
  },

  empty: { paddingVertical: 60, alignItems: 'center', gap: 8 },
  emptyEmoji: { fontSize: 32 },
  emptyText: { color: TEXT_SOFT, fontSize: 14, fontWeight: '500' },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  deptSheet: {
    backgroundColor: WHITE,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 10,
    elevation: 20,
  },
  sheetHandle: {
    width: 36, height: 4, backgroundColor: BORDER,
    borderRadius: 2, alignSelf: 'center', marginBottom: 16,
  },
  sheetTitle: { fontSize: 16, fontWeight: '700', color: TEXT_DARK, marginBottom: 8 },
  deptOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: BORDER },
  deptOptionActive: { backgroundColor: SURFACE_LO, marginHorizontal: -4, paddingHorizontal: 4, borderRadius: 8 },
  deptOptionText: { fontSize: 14, color: TEXT_DARK },
  deptOptionTextActive: { color: PRIMARY, fontWeight: '700' },
  deptCheck: { color: PRIMARY, fontSize: 16, fontWeight: '700' },

  editModalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  editSheet: {
    backgroundColor: WHITE,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32,
  },
  editModalTitle: { fontSize: 16, fontWeight: '700', color: TEXT_DARK, marginBottom: 12 },
  editInput: { borderWidth: 1, borderColor: BORDER, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: TEXT_DARK, backgroundColor: BG },
  editModalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 14 },
  editActionBtn: { borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12 },
  editCancelBtn: { backgroundColor: '#F3F4F6' },
  editCancelText: { fontSize: 13, fontWeight: '600', color: TEXT_SOFT },
  editSaveBtn: { backgroundColor: PRIMARY_CT },
  editSaveBtnDisabled: { opacity: 0.55 },
  editSaveText: { fontSize: 13, fontWeight: '700', color: WHITE },
});
