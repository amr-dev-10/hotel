import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Image,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, Task } from '../../types';
import { TasksService } from '../../services/backend';
import { LoadingOverlay } from '../../components/common/LoadingOverlay';
import { COLORS, slaForDepartment, TASK_STAGES } from '../../utils/constants';
import { useAuthStore } from '../../store/useAuthStore';

type Props = NativeStackScreenProps<RootStackParamList, 'TaskDetails'>;

// ─── Step photo modal ─────────────────────────────────────────────────────────
// Shown before each workflow step. User can add photos (optional) then proceed,
// or skip photos and proceed directly. On cancel nothing happens.
interface StepPhotoModalProps {
  visible: boolean;
  stepLabel: string;
  stepHint: string;
  uploading: boolean;
  photos: string[];
  onAddPhoto: () => void;
  onRemovePhoto: (index: number) => void;
  onProceed: () => void;
  onCancel: () => void;
}

function StepPhotoModal({
  visible, stepLabel, stepHint, uploading,
  photos, onAddPhoto, onRemovePhoto, onProceed, onCancel,
}: StepPhotoModalProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={photoModal.backdrop}>
        <View style={photoModal.sheet}>
          <View style={photoModal.handle} />

          {/* Header */}
          <View style={photoModal.header}>
            <Text style={photoModal.title}>{stepLabel}</Text>
            <Text style={photoModal.hint}>{stepHint}</Text>
          </View>

          {/* Photos grid */}
          <View style={photoModal.grid}>
            {photos.map((uri, i) => (
              <View key={i} style={photoModal.thumbWrap}>
                <Image source={{ uri }} style={photoModal.thumb} />
                <TouchableOpacity
                  style={photoModal.removeBtn}
                  onPress={() => onRemovePhoto(i)}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Text style={photoModal.removeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}

            {/* Add photo tile */}
            <TouchableOpacity style={photoModal.addTile} onPress={onAddPhoto} disabled={uploading}>
              <Text style={photoModal.addTileIcon}>📷</Text>
              <Text style={photoModal.addTileText}>Add Photo</Text>
            </TouchableOpacity>
          </View>

          {/* Actions */}
          <View style={photoModal.actions}>
            <TouchableOpacity style={photoModal.cancelBtn} onPress={onCancel} disabled={uploading}>
              <Text style={photoModal.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[photoModal.proceedBtn, uploading && photoModal.proceedBtnDisabled]}
              onPress={onProceed}
              disabled={uploading}
            >
              {uploading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={photoModal.proceedBtnText}>
                  {photos.length > 0 ? 'Save & Continue' : 'Continue Without Photo'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Step photo strip (manager view) ─────────────────────────────────────────
function StepPhotoStrip({
  label, photos, onView,
}: {
  label: string; photos: string[]; onView: (idx: number) => void;
}) {
  if (!photos || photos.length === 0) return null;
  return (
    <View style={strip.wrap}>
      <Text style={strip.label}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={strip.scroll}>
        {photos.map((uri, i) => (
          <TouchableOpacity key={i} onPress={() => onView(i)} activeOpacity={0.85}>
            <Image source={{ uri }} style={strip.thumb} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export function TaskDetailsScreen({ navigation, route }: Props) {
  const { taskId } = route.params;
  const { jobRole, employeeId, name, status } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [task, setTask] = useState<Task>(route.params.task);
  const [showAddNote, setShowAddNote] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [timerNow, setTimerNow] = useState(Date.now());

  // Step photo modal state
  type PendingStep = 'enroute' | 'atlocation' | null;
  const [pendingStep, setPendingStep] = useState<PendingStep>(null);
  const [stepPhotos, setStepPhotos] = useState<string[]>([]);
  const [stepUploading, setStepUploading] = useState(false);

  useEffect(() => {
    const unsub = TasksService.subscribeToTask(taskId, (t) => { if (t) setTask(t); });
    return unsub;
  }, [taskId]);

  useEffect(() => {
    const timer = setInterval(() => setTimerNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const workflow = (task.WorkflowStep ?? '').toLowerCase();
    const isTimerStep = workflow === 'accepted' || workflow === 'enroute' || workflow === 'atlocation';
    const timerStart = Number(task.TimerStartTime ?? '0');
    if (
      task.Stage === TASK_STAGES.ASSIGNED &&
      isTimerStep && timerStart > 0 &&
      !task.SlaAlertSent && timerNow - timerStart >= slaForDepartment(task.Department)
    ) {
      void TasksService.markTaskSlaExceeded(task.TaskId).catch(() => undefined);
    }
  }, [task, timerNow]);

  // ── Step photo helpers ───────────────────────────────────────────────────
  async function openCamera(): Promise<string | null> {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('Permission needed', 'Camera permission is required.');
      return null;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.6,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return null;
    return result.assets[0].uri;
  }

  async function handleAddStepPhoto() {
    const uri = await openCamera();
    if (uri) setStepPhotos((prev) => [...prev, uri]);
  }

  function startStep(step: PendingStep) {
    if (!status) { Alert.alert('Inactive', 'Your status is not active.'); return; }
    setStepPhotos([]);
    setPendingStep(step);
  }

  async function commitStep() {
    if (!pendingStep) return;
    setStepUploading(true);
    try {
      if (pendingStep === 'enroute') {
        await TasksService.markTaskEnRouteWithPhotos(task.TaskId, stepPhotos);
      } else {
        await TasksService.markTaskAtLocationWithPhotos(task.TaskId, stepPhotos);
      }
      setPendingStep(null);
      setStepPhotos([]);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not update step');
    } finally {
      setStepUploading(false);
    }
  }

  function cancelStep() {
    setPendingStep(null);
    setStepPhotos([]);
  }

  // ── Task actions ─────────────────────────────────────────────────────────
  async function handleApprove() {
    if (!task.ApprovalAppliedTime && !task.NotDeliveredTime) {
      Alert.alert('Not Executed Yet', 'The attendant has not submitted the task yet.');
      return;
    }
    const deliveryStatus = (task.DeliveryStatus ?? '').toString().toLowerCase();
    if (deliveryStatus === 'notcompleted') {
      Alert.alert(
        'Cannot Approve',
        'This task was marked as Not Delivered by the attendant. Please use Re-attempt or Cancel instead.'
      );
      return;
    }
    setLoading(true);
    try {
      await TasksService.updateTask(task.TaskId, {
        WorkflowStep: 'Done',
        Stage: TASK_STAGES.COMPLETED,
        ApproveById: employeeId ?? '',
        ApproveByName: name ?? '',
        ApproveTime: String(Date.now()),
      });
      Alert.alert('Success', 'Task approved!');
      navigation.goBack();
    } catch { Alert.alert('Error', 'Could not approve task'); }
    finally { setLoading(false); }
  }

  async function handleResume() {
    if (!task.AssignedToID || !task.AssignedToName) {
      Alert.alert('Error', 'Task must be assigned before resuming.');
      return;
    }
    setLoading(true);
    try {
      const now = String(Date.now());
      await TasksService.updateTask(task.TaskId, {
        WorkflowStep: 'Accepted',
        Stage: TASK_STAGES.ASSIGNED,
        Reattempt: now,
        TimerStartTime: now,
        ReattemptSetById: employeeId ?? '',
        ReattemptSetByName: name ?? '',
      });
      Alert.alert('Success', 'Task sent back for re-attempt!');
      navigation.goBack();
    } catch { Alert.alert('Error', 'Could not resume task'); }
    finally { setLoading(false); }
  }

  async function handleDelete() {
    Alert.alert('Delete Task', 'Are you sure you want to delete this task?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          setLoading(true);
          try { await TasksService.deleteTask(task.TaskId, task); navigation.goBack(); }
          catch { Alert.alert('Error', 'Could not delete task'); }
          finally { setLoading(false); }
        },
      },
    ]);
  }

  async function handleMarkExecuted() {
    if (!status) { Alert.alert('Inactive', 'Your status is not active.'); return; }
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('Permission needed', 'Camera permission is required to verify order.');
      return;
    }
    const shot = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.6,
    });
    if (shot.canceled || !shot.assets?.[0]?.uri) return;
    navigation.navigate('TaskUpdate', { taskId: task.TaskId, task, initialPhotoUri: shot.assets[0].uri });
  }

  async function handleSaveNote() {
    if (!noteText.trim()) return;
    setSavingNote(true);
    try {
      await TasksService.updateTask(task.TaskId, { NoteForManager: noteText.trim() });
      Alert.alert('Success', 'Note added!');
      setNoteText(''); setShowAddNote(false);
    } catch { Alert.alert('Error', 'Could not save note'); }
    finally { setSavingNote(false); }
  }

  // ── Derived state ────────────────────────────────────────────────────────
  const normalizedRole = (jobRole ?? '').toString().trim().toLowerCase().replace(/[\s_-]+/g, '');
  const isManager = normalizedRole === 'manager' || normalizedRole === 'frontdesk';
  const isAssignedAttendant = task.AssignedToID === employeeId;
  const isNotDelivered = task.DeliveryStatus === 'NotCompleted';
  const isDelivered = task.DeliveryStatus === 'Completed';
  const hasReattempt = !!task.Reattempt;
  const imageList = task.TaskImagesUnDelivered?.length
    ? task.TaskImagesUnDelivered
    : task.TaskImages?.length ? task.TaskImages : [];
  const heroImage = imageList.length > 0 ? imageList[0] : null;
  const orderTitle = task.ItemOrdered || task.Note || 'Waiting...';
  const workflow = (task.WorkflowStep ?? '').toString().trim().toLowerCase();
  const canMarkEnRoute = isAssignedAttendant && task.Stage === TASK_STAGES.ASSIGNED && (workflow === '' || workflow === 'accepted');
  const canMarkArrived = isAssignedAttendant && task.Stage === TASK_STAGES.ASSIGNED && workflow === 'enroute';
  const canVerifyOrder = isAssignedAttendant && task.Stage === TASK_STAGES.ASSIGNED && workflow === 'atlocation';
  const isSlaTrackingStep = task.Stage === TASK_STAGES.ASSIGNED && (workflow === 'accepted' || workflow === 'enroute' || workflow === 'atlocation');
  const timerStartMs = Number(task.TimerStartTime ?? '0');
  const elapsedMs = timerStartMs > 0 ? Math.max(0, timerNow - timerStartMs) : 0;
  const slaMs = slaForDepartment(task.Department);
  const slaMinutes = Math.round(slaMs / 60000);
  const remainingMs = timerStartMs > 0 ? Math.max(0, slaMs - elapsedMs) : 0;
  const stepIndex = workflowStepIndex(workflow, task.Stage);
  const slaStatusText = task.SlaAlertSent
    ? `SLA Exceeded (${slaMinutes} min limit)`
    : isSlaTrackingStep && timerStartMs > 0
    ? `SLA: ${formatElapsed(elapsedMs)} elapsed / ${slaMinutes} min limit`
    : cleanValue(task.ApproveByName);

  const stageChip = getStageChip(task.Stage);
  const pChip = getPriorityChip(task.Priority || '');

  // Step modal config
  const stepConfig: Record<NonNullable<PendingStep>, { label: string; hint: string }> = {
    enroute: {
      label: 'Mark En Route',
      hint: 'Optionally take a photo before heading out. You can skip this.',
    },
    atlocation: {
      label: 'Mark Arrived',
      hint: 'Optionally take a photo on arrival at the room. You can skip this.',
    },
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* Hero image */}
      {heroImage ? (
        <TouchableOpacity
          onPress={() => navigation.navigate('ImageViewer', { images: imageList, initialIndex: 0 })}
          activeOpacity={0.9}
          style={styles.heroWrap}
        >
          <Image source={{ uri: heroImage }} style={styles.heroImage} />
          <View style={styles.heroOverlay}>
            <Text style={styles.heroOverlayText}>Tap to view photos</Text>
          </View>
        </TouchableOpacity>
      ) : null}

      {/* Title card */}
      <View style={styles.titleCard}>
        <View style={styles.titleChips}>
          <View style={[styles.stageChip, { backgroundColor: stageChip.bg }]}>
            <Text style={[styles.stageChipText, { color: stageChip.text }]}>{stageChip.label}</Text>
          </View>
          {(() => {
            const priorityLabel = (task.Priority || 'Routine').toString();
            // Attendants don't need to see "Routine" — it's the default and adds noise.
            // Managers still see every priority chip, matching the manager dashboard.
            if (!isManager && priorityLabel.toLowerCase() === 'routine') return null;
            return (
              <View style={[styles.stageChip, { backgroundColor: pChip.bg }]}>
                <Text style={[styles.stageChipText, { color: pChip.text }]}>{priorityLabel}</Text>
              </View>
            );
          })()}
        </View>
        <Text style={styles.orderTitle}>{orderTitle.toUpperCase()}</Text>
        {task.GuestName ? <Text style={styles.guestName}>Guest: {task.GuestName}</Text> : null}
      </View>

      {/* Workflow steps (attendant only) */}
      {!isManager ? (
        <View style={styles.workflowCard}>
          <Text style={styles.sectionLabel}>Execution Flow</Text>
          <View style={styles.workflowRow}>
            {['Accepted', 'En Route', 'At Location', 'Done'].map((label, idx) => {
              const done = idx <= stepIndex;
              const active = idx === stepIndex;
              return (
                <View key={label} style={styles.workflowStep}>
                  <View style={[
                    styles.workflowDot,
                    done && styles.workflowDotDone,
                    active && styles.workflowDotActive,
                  ]} />
                  <Text style={[styles.workflowLabel, done && styles.workflowLabelDone]}>{label}</Text>
                </View>
              );
            })}
          </View>
          {isSlaTrackingStep && timerStartMs > 0 ? (
            <View style={[styles.slaBanner, task.SlaAlertSent ? styles.slaBannerError : styles.slaBannerOk]}>
              <Text style={[styles.slaBannerText, task.SlaAlertSent ? styles.slaBannerTextError : styles.slaBannerTextOk]}>
                {task.SlaAlertSent ? '⚠ SLA Exceeded' : `⏱ ${formatCountdown(remainingMs)} remaining`}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Task info card */}
      <View style={styles.infoCard}>
        <Text style={styles.sectionLabel}>Task Details</Text>
        {renderRow('Task #', (task as any).RandomTaskId || task.TaskId)}
        {renderRow('Room No', task.UpdatedRoomNo ? `${task.RoomNo} → ${task.UpdatedRoomNo}` : task.RoomNo || '—')}
        {renderRow('Created At', formatDateTime(task.CreatedTime ?? task.timestamp ?? task.TimerStartTime ?? task.AssignedTime))}
        {renderRow('Assigned To', task.AssignedToName || 'Unassigned')}
        {renderRow('Created By', task.TaskAdderName || '—')}
        {renderRow('Desired Date', cleanValue(task.DesiredDate))}
        {renderRow('Desired Time', cleanValue(task.DesiredTime))}
        {renderRow('Paid By', cleanValue(task.PaidBy) === '—' ? 'None' : cleanValue(task.PaidBy))}
        {task.Note ? renderRow('Note', task.Note) : null}
      </View>

      {/* Timeline card — manager sees step photos here */}
      <View style={styles.timelineCard}>
        <Text style={styles.sectionLabel}>Timeline</Text>
        {renderRow('Assigned At', formatDateTime(task.AssignedTime))}
        {renderRow('Accepted At', formatDateTime(task.AcceptedTime))}

        {/* En Route row + photos */}
        {renderRow('En Route At', formatDateTime(task.EnRouteTime))}
        {task.EnRoutePhotos && task.EnRoutePhotos.length > 0 ? (
          <StepPhotoStrip
            label="En Route Photos"
            photos={task.EnRoutePhotos}
            onView={(idx) => navigation.navigate('ImageViewer', { images: task.EnRoutePhotos!, initialIndex: idx })}
          />
        ) : null}

        {/* Arrived row + photos */}
        {renderRow('Arrived At', formatDateTime(task.AtLocationTime))}
        {task.AtLocationPhotos && task.AtLocationPhotos.length > 0 ? (
          <StepPhotoStrip
            label="Arrival Photos"
            photos={task.AtLocationPhotos}
            onView={(idx) => navigation.navigate('ImageViewer', { images: task.AtLocationPhotos!, initialIndex: idx })}
          />
        ) : null}

        {renderRow('Approval Requested', formatDateTime(task.ApprovalAppliedTime))}
        {renderRow('Approved At', formatDateTime(task.ApproveTime))}
        {renderRow('SLA / Approved By', slaStatusText)}
      </View>

      {/* Assignment history — who the ticket passed through before the current
          assignee. Only present on tickets reassigned/transferred after this
          tracking shipped. */}
      {Array.isArray(task.AssignmentHistory) && task.AssignmentHistory.length > 0 ? (
        <View style={styles.infoCard}>
          <Text style={styles.sectionLabel}>Assignment History</Text>
          {task.AssignmentHistory.map((h, idx) => (
            <View style={rowStyles.row} key={`${h.EmployeeId || 'u'}-${idx}`}>
              <Text style={rowStyles.label}>
                {`${idx + 1}. ${h.Name || 'Unknown'}`}
                {h.Department ? `  ·  ${h.Department.replace(/[_-]+/g, ' ')}` : ''}
              </Text>
              <Text style={rowStyles.value}>
                {reasonLabel(h.Reason)}
                {h.ReplacedAt ? `\n${formatDateTime(h.ReplacedAt)}` : ''}
              </Text>
            </View>
          ))}
          {renderRow('Current', task.AssignedToName || 'Unassigned')}
        </View>
      ) : null}

      {/* Q&A */}
      {(task.Question1 || task.Answer1) ? (
        <View style={styles.infoCard}>
          <Text style={styles.sectionLabel}>Q&A</Text>
          {task.Question1 ? renderRow('Q1', task.Question1) : null}
          {task.Answer1 ? renderRow('A1', task.Answer1) : null}
          {task.Question2 ? renderRow('Q2', task.Question2) : null}
          {task.Answer2 ? renderRow('A2', task.Answer2) : null}
        </View>
      ) : null}

      {/* Add-ons */}
      {task.AddOns && task.AddOns.length > 0 ? (
        <View style={styles.infoCard}>
          <Text style={styles.sectionLabel}>Add-ons</Text>
          <View style={styles.addonsWrap}>
            {task.AddOns.map((addon, i) => (
              <View key={i} style={styles.addonChip}>
                <Text style={styles.addonChipText}>
                  {addon.name}{addon.quantity ? ` ×${addon.quantity}` : ''}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* Delivery status */}
      {task.DeliveryStatus ? (
        <View style={styles.infoCard}>
          <Text style={styles.sectionLabel}>Delivery Status</Text>
          <View style={[styles.deliveryBadge, isDelivered ? styles.deliveredBadge : styles.notDeliveredBadge]}>
            <Text style={[styles.deliveryBadgeText, isDelivered ? styles.deliveredText : styles.notDeliveredText]}>
              {isDelivered ? 'Delivered' : 'Not Delivered'}
            </Text>
          </View>
          {isNotDelivered && !hasReattempt ? (
            <View style={styles.holdBanner}>
              <Text style={styles.holdBannerText}>
                On Hold — {task.NotDeliveredReason2 || task.NotDeliveredReason1 || 'Not Delivered'}
              </Text>
            </View>
          ) : null}
          {hasReattempt ? (
            <View style={styles.reattemptBanner}>
              <Text style={styles.reattemptText}>Re-attempt by {task.ReattemptSetByName}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Notes */}
      {task.NoteForManager ? (
        <View style={styles.noteCard}>
          <Text style={styles.sectionLabel}>Note for Manager</Text>
          <Text style={styles.noteText}>{task.NoteForManager}</Text>
        </View>
      ) : null}

      {/* Delivery photos (final) */}
      {task.TaskImages && task.TaskImages.length > 0 ? (
        <View style={styles.infoCard}>
          <Text style={styles.sectionLabel}>Delivery Photos</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoRow}>
            {task.TaskImages.map((img, i) => (
              <TouchableOpacity key={i} onPress={() => navigation.navigate('ImageViewer', { images: task.TaskImages!, initialIndex: i })}>
                <Image source={{ uri: img }} style={styles.thumb} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {task.TaskImagesUnDelivered && task.TaskImagesUnDelivered.length > 0 ? (
        <View style={styles.infoCard}>
          <Text style={styles.sectionLabel}>Non-Delivery Photos</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoRow}>
            {task.TaskImagesUnDelivered.map((img, i) => (
              <TouchableOpacity key={i} onPress={() => navigation.navigate('ImageViewer', { images: task.TaskImagesUnDelivered!, initialIndex: i })}>
                <Image source={{ uri: img }} style={styles.thumb} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {/* Action bar */}
      {task.Stage !== TASK_STAGES.COMPLETED ? (
        <View style={styles.actionBar}>
          {isManager ? (
            <>
              {task.AssignedToName && isDelivered ? (
                <TouchableOpacity style={[styles.actionBtn, styles.approveBtn]} onPress={handleApprove}>
                  <Text style={styles.actionBtnText}>Approve Task</Text>
                </TouchableOpacity>
              ) : null}
              {isNotDelivered && !hasReattempt ? (
                <TouchableOpacity style={[styles.actionBtn, styles.resumeBtn]} onPress={handleResume}>
                  <Text style={styles.actionBtnText}>Resume Task</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity style={[styles.actionBtn, styles.deleteBtn]} onPress={handleDelete}>
                <Text style={styles.actionBtnText}>Delete Task</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {/* Step buttons — each opens the photo modal first */}
              {canMarkEnRoute ? (
                <TouchableOpacity style={[styles.actionBtn, styles.stepBtn]} onPress={() => startStep('enroute')}>
                  <Text style={styles.actionBtnText}>Mark En Route</Text>
                </TouchableOpacity>
              ) : null}
              {canMarkArrived ? (
                <TouchableOpacity style={[styles.actionBtn, styles.stepBtn]} onPress={() => startStep('atlocation')}>
                  <Text style={styles.actionBtnText}>Mark Arrived</Text>
                </TouchableOpacity>
              ) : null}
              {canVerifyOrder ? (
                <TouchableOpacity style={[styles.actionBtn, styles.verifyBtn]} onPress={handleMarkExecuted}>
                  <Text style={styles.actionBtnText}>Verify Order</Text>
                </TouchableOpacity>
              ) : null}
              {isAssignedAttendant && task.Stage === TASK_STAGES.ASSIGNED ? (
                <TouchableOpacity style={[styles.actionBtn, styles.noteBtn]} onPress={() => setShowAddNote(true)}>
                  <Text style={styles.actionBtnText}>Add Note for Manager</Text>
                </TouchableOpacity>
              ) : null}
            </>
          )}
        </View>
      ) : null}

      {/* Step photo modal */}
      {pendingStep ? (
        <StepPhotoModal
          visible
          stepLabel={stepConfig[pendingStep].label}
          stepHint={stepConfig[pendingStep].hint}
          uploading={stepUploading}
          photos={stepPhotos}
          onAddPhoto={handleAddStepPhoto}
          onRemovePhoto={(i) => setStepPhotos((prev) => prev.filter((_, idx) => idx !== i))}
          onProceed={commitStep}
          onCancel={cancelStep}
        />
      ) : null}

      {/* Add Note modal */}
      <Modal visible={showAddNote} transparent animationType="slide" onRequestClose={() => setShowAddNote(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalBox}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Add Note for Manager</Text>
            <TextInput
              style={styles.noteInput}
              placeholder="Write your note here..."
              placeholderTextColor={COLORS.OUTLINE}
              value={noteText}
              onChangeText={setNoteText}
              multiline
              numberOfLines={4}
              autoFocus
            />
            <TouchableOpacity
              style={[styles.modalBtn, (!noteText.trim() || savingNote) && styles.modalBtnDisabled]}
              onPress={handleSaveNote}
              disabled={!noteText.trim() || savingNote}
            >
              <Text style={styles.modalBtnText}>{savingNote ? 'Saving...' : 'Save Note'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => { setNoteText(''); setShowAddNote(false); }}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <LoadingOverlay visible={loading} />
    </ScrollView>
  );
}

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
function cleanValue(value: any): string {
  if (value === null || value === undefined) return '—';
  const text = String(value).trim();
  if (!text || text.toLowerCase() === 'null' || text.toLowerCase() === 'undefined') return '—';
  return text;
}
function formatDateTime(value: any): string {
  const text = cleanValue(value);
  if (text === '—') return text;
  let d: Date | null = null;
  const num = Number(text);
  if (!Number.isNaN(num) && num > 0) {
    const candidate = new Date(num);
    if (!Number.isNaN(candidate.getTime())) d = candidate;
  }
  if (!d) {
    const candidate = new Date(text);
    if (!Number.isNaN(candidate.getTime())) d = candidate;
  }
  if (!d) return text;
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  const day = String(d.getDate()).padStart(2, '0');
  const month = d.toLocaleString('en-US', { month: 'short' });
  const year = d.getFullYear();
  return `${time} (${day} ${month} ${year})`;
}
function renderRow(label: string, value: string) {
  return (
    <View style={rowStyles.row} key={label}>
      <Text style={rowStyles.label}>{label}</Text>
      <Text style={rowStyles.value}>{value}</Text>
    </View>
  );
}
function reasonLabel(reason?: string): string {
  switch (reason) {
    case 'reassigned': return 'Reassigned';
    case 'transferred': return 'Transferred';
    case 'inactive': return 'Released (inactive)';
    default: return 'Removed';
  }
}
function formatElapsed(ms: number) {
  const totalMins = Math.floor(ms / 60000);
  const mins = totalMins % 60;
  const hrs = Math.floor(totalMins / 60);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}
function formatCountdown(ms: number) {
  const safe = Math.max(0, ms);
  const mins = Math.floor(safe / 60000);
  const secs = Math.floor((safe % 60000) / 1000);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
function workflowStepIndex(workflow: string, stage: string) {
  const wf = workflow.toLowerCase(); const st = stage.toLowerCase();
  if (st === 'executed' || wf === 'done') return 3;
  if (wf === 'atlocation') return 2;
  if (wf === 'enroute') return 1;
  return 0;
}
function getStageChip(stage: string): { bg: string; text: string; label: string } {
  if (stage === 'Created')   return { bg: '#CFFAFE', text: '#164E63', label: 'New' };
  if (stage === 'Assigned')  return { bg: '#E0E7FF', text: '#312E81', label: 'Assigned' };
  if (stage === 'Executed')  return { bg: '#FFEDD5', text: '#7C2D12', label: 'On Hold' };
  if (stage === 'Completed') return { bg: '#D1FAE5', text: '#064E3B', label: 'Completed' };
  return { bg: COLORS.SURFACE_HIGH, text: COLORS.ON_SURFACE_VARIANT, label: stage };
}
function getPriorityChip(priority: string): { bg: string; text: string } {
  if (priority === 'High')      return { bg: '#FFDAD6', text: '#93000A' };
  if (priority === 'Important') return { bg: '#FFDDB8', text: '#684000' };
  return { bg: '#D1FAE5', text: '#064E3B' };
}

/* ─── Row styles ──────────────────────────────────────────────────────────── */
const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.OUTLINE_VARIANT,
  },
  label: { fontSize: 12, color: COLORS.ON_SURFACE_VARIANT, fontWeight: '600', flex: 1 },
  value: { fontSize: 13, color: COLORS.ON_SURFACE, fontWeight: '500', flex: 2, textAlign: 'right' },
});

/* ─── Step photo strip styles ─────────────────────────────────────────────── */
const strip = StyleSheet.create({
  wrap: { marginTop: 10, marginBottom: 2 },
  label: {
    fontSize: 11, fontWeight: '700', color: COLORS.PRIMARY,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6,
  },
  scroll: {},
  thumb: {
    width: 72, height: 72, borderRadius: 8,
    marginRight: 8,
    borderWidth: 1, borderColor: COLORS.OUTLINE_VARIANT,
  },
});

/* ─── Step photo modal styles ─────────────────────────────────────────────── */
const photoModal = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(17,28,45,0.5)', justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.WHITE,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 36,
  },
  handle: {
    width: 36, height: 4, backgroundColor: COLORS.OUTLINE_VARIANT,
    borderRadius: 2, alignSelf: 'center', marginBottom: 16,
  },
  header: { marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '800', color: COLORS.ON_SURFACE, marginBottom: 4 },
  hint: { fontSize: 13, color: COLORS.ON_SURFACE_VARIANT },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },

  thumbWrap: { position: 'relative' },
  thumb: { width: 80, height: 80, borderRadius: 10 },
  removeBtn: {
    position: 'absolute', top: -6, right: -6,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: COLORS.ERROR,
    justifyContent: 'center', alignItems: 'center',
  },
  removeBtnText: { color: '#fff', fontSize: 10, fontWeight: '800' },

  addTile: {
    width: 80, height: 80, borderRadius: 10,
    borderWidth: 1.5, borderColor: COLORS.PRIMARY, borderStyle: 'dashed',
    justifyContent: 'center', alignItems: 'center', gap: 4,
    backgroundColor: '#F0FDFC',
  },
  addTileIcon: { fontSize: 22 },
  addTileText: { fontSize: 10, color: COLORS.PRIMARY, fontWeight: '700' },

  actions: { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 1, borderRadius: 10, paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.OUTLINE_VARIANT,
    backgroundColor: COLORS.SURFACE_LOW,
  },
  cancelBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.ON_SURFACE_VARIANT },
  proceedBtn: {
    flex: 2, borderRadius: 10, paddingVertical: 14,
    alignItems: 'center', backgroundColor: COLORS.PRIMARY,
  },
  proceedBtnDisabled: { opacity: 0.6 },
  proceedBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});

/* ─── Screen styles ───────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.SURFACE },
  content: { padding: 16, paddingBottom: 40 },

  heroWrap: { borderRadius: 12, overflow: 'hidden', marginBottom: 14 },
  heroImage: { width: '100%', height: 180, backgroundColor: COLORS.SURFACE_HIGH },
  heroOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingVertical: 8, backgroundColor: 'rgba(17,28,45,0.5)', alignItems: 'center',
  },
  heroOverlayText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  titleCard: {
    backgroundColor: COLORS.WHITE, borderRadius: 12, padding: 16,
    marginBottom: 12, borderWidth: 1, borderColor: COLORS.OUTLINE_VARIANT,
  },
  titleChips: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  stageChip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 50 },
  stageChipText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  orderTitle: { fontSize: 18, fontWeight: '800', color: COLORS.ON_SURFACE, marginBottom: 4 },
  guestName: { fontSize: 13, color: COLORS.ON_SURFACE_VARIANT, fontWeight: '500' },

  workflowCard: {
    backgroundColor: COLORS.WHITE, borderRadius: 12, padding: 14,
    marginBottom: 12, borderWidth: 1, borderColor: COLORS.OUTLINE_VARIANT,
  },
  workflowRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  workflowStep: { flex: 1, alignItems: 'center' },
  workflowDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.OUTLINE_VARIANT, marginBottom: 5 },
  workflowDotDone: { backgroundColor: COLORS.SUCCESS },
  workflowDotActive: { borderWidth: 2.5, borderColor: COLORS.PRIMARY, backgroundColor: '#CCFBF5' },
  workflowLabel: { fontSize: 10, color: COLORS.OUTLINE, textAlign: 'center', fontWeight: '600' },
  workflowLabelDone: { color: COLORS.PRIMARY },
  slaBanner: { marginTop: 10, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  slaBannerOk: { backgroundColor: '#D1FAE5' },
  slaBannerError: { backgroundColor: '#FFDAD6' },
  slaBannerText: { fontSize: 12, fontWeight: '700' },
  slaBannerTextOk: { color: '#064E3B' },
  slaBannerTextError: { color: '#93000A' },

  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: COLORS.PRIMARY,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8,
  },
  infoCard: {
    backgroundColor: COLORS.WHITE, borderRadius: 12, padding: 14,
    marginBottom: 12, borderWidth: 1, borderColor: COLORS.OUTLINE_VARIANT,
  },
  timelineCard: {
    backgroundColor: '#F0FDFC', borderRadius: 12, padding: 14,
    marginBottom: 12, borderWidth: 1, borderColor: COLORS.PRIMARY_LIGHT,
  },
  noteCard: {
    backgroundColor: COLORS.WHITE, borderRadius: 12, padding: 14,
    marginBottom: 12, borderWidth: 1, borderColor: COLORS.OUTLINE_VARIANT,
  },
  noteText: { fontSize: 14, color: COLORS.ON_SURFACE, lineHeight: 22 },

  addonsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  addonChip: { backgroundColor: '#CCFBF5', borderRadius: 50, paddingHorizontal: 12, paddingVertical: 5 },
  addonChipText: { color: COLORS.PRIMARY, fontSize: 12, fontWeight: '600' },

  deliveryBadge: { alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 50, marginBottom: 10 },
  deliveredBadge: { backgroundColor: '#D1FAE5' },
  notDeliveredBadge: { backgroundColor: '#FFDAD6' },
  deliveryBadgeText: { fontSize: 13, fontWeight: '700' },
  deliveredText: { color: '#064E3B' },
  notDeliveredText: { color: '#93000A' },

  holdBanner: { backgroundColor: '#FFDAD6', borderRadius: 8, padding: 10, marginTop: 4 },
  holdBannerText: { fontSize: 13, color: '#93000A', fontWeight: '600' },
  reattemptBanner: { backgroundColor: '#FFEDD5', borderRadius: 8, padding: 10, marginTop: 4 },
  reattemptText: { fontSize: 13, color: '#7C2D12', fontWeight: '600' },

  photoRow: { marginTop: 6 },
  thumb: { width: 90, height: 90, borderRadius: 10, marginRight: 8 },

  actionBar: { marginTop: 16, gap: 10 },
  actionBtn: { borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  approveBtn: { backgroundColor: COLORS.SUCCESS },
  resumeBtn: { backgroundColor: COLORS.WARNING },
  verifyBtn: { backgroundColor: COLORS.PRIMARY },
  stepBtn: { backgroundColor: '#0284C7' },
  noteBtn: { backgroundColor: '#7C3AED' },
  deleteBtn: { backgroundColor: COLORS.ERROR },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(17,28,45,0.45)', justifyContent: 'flex-end' },
  modalBox: {
    backgroundColor: COLORS.WHITE, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
  },
  modalHandle: {
    width: 36, height: 4, backgroundColor: COLORS.OUTLINE_VARIANT,
    borderRadius: 2, alignSelf: 'center', marginBottom: 16,
  },
  modalTitle: { fontSize: 17, fontWeight: '800', color: COLORS.ON_SURFACE, marginBottom: 14 },
  noteInput: {
    borderWidth: 1, borderColor: COLORS.OUTLINE_VARIANT, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: COLORS.ON_SURFACE,
    minHeight: 100, textAlignVertical: 'top', backgroundColor: COLORS.SURFACE_LOW,
  },
  modalBtn: {
    backgroundColor: COLORS.PRIMARY, borderRadius: 10, paddingVertical: 14,
    alignItems: 'center', marginTop: 14, marginBottom: 8,
  },
  modalBtnDisabled: { backgroundColor: COLORS.OUTLINE_VARIANT },
  modalBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  modalCancelBtn: { paddingVertical: 10, alignItems: 'center' },
  modalCancelText: { color: COLORS.PRIMARY, fontWeight: '700', fontSize: 14 },
});
