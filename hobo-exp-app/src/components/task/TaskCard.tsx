import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Task } from '../../types';
import { AssignTaskModal } from './AssignTaskModal';
import { COLORS } from '../../utils/constants';

interface Props {
  task: Task;
  onPress: () => void;
  showAssignButton?: boolean;
  showResumeButton?: boolean;
  actionLabel?: string;
  actionColor?: string;
  onAssign?: () => void;
}

// Arcadia pastel priority chip
function priorityChip(priority: string): { bg: string; text: string } {
  if (priority === 'High') return { bg: '#FFDAD6', text: '#93000A' };
  if (priority === 'Important') return { bg: '#FFDDB8', text: '#684000' };
  return { bg: '#D1FAE5', text: '#064E3B' };
}

// Arcadia status chip
function stageChip(stage: string): { bg: string; text: string; label: string } {
  if (stage === 'Created')   return { bg: '#CFFAFE', text: '#164E63', label: 'New' };
  if (stage === 'Assigned')  return { bg: '#E0E7FF', text: '#312E81', label: 'Assigned' };
  if (stage === 'Executed')  return { bg: '#FFEDD5', text: '#7C2D12', label: 'On Hold' };
  if (stage === 'Completed') return { bg: '#D1FAE5', text: '#064E3B', label: 'Done' };
  return { bg: '#E7EEFF', text: '#45464D', label: stage };
}

export function TaskCard({ task, onPress, showAssignButton, showResumeButton, actionLabel, actionColor, onAssign }: Props) {
  const [assignVisible, setAssignVisible] = useState(false);

  const assignedName = task.AssignedToName ?? '';
  const pChip = priorityChip(task.Priority);
  const sChip = stageChip(task.Stage);

  return (
    <View style={styles.card}>
      {/* Stage + Priority chips row at top */}
      <View style={styles.topChips}>
        <View style={[styles.chip, { backgroundColor: sChip.bg }]}>
          <Text style={[styles.chipText, { color: sChip.text }]}>{sChip.label}</Text>
        </View>
        <View style={[styles.chip, { backgroundColor: pChip.bg }]}>
          <Text style={[styles.chipText, { color: pChip.text }]}>{task.Priority}</Text>
        </View>
        {task.DesiredDate ? (
          <View style={[styles.chip, { backgroundColor: COLORS.SURFACE_LOW }]}>
            <Text style={[styles.chipText, { color: COLORS.ON_SURFACE_VARIANT }]}>{task.DesiredDate}</Text>
          </View>
        ) : null}
      </View>

      {/* Task title */}
      <Text style={styles.title} numberOfLines={2}>
        {task.Note || task.ItemOrdered || task.GuestName || `Room ${task.RoomNo}`}
      </Text>

      {/* Meta row */}
      <View style={styles.metaRow}>
        {task.RoomNo ? (
          <View style={styles.metaItem}>
            <Text style={styles.metaIcon}>🏨</Text>
            <Text style={styles.metaText}>Room {task.RoomNo}</Text>
          </View>
        ) : null}
        {task.PaidBy ? (
          <View style={styles.metaItem}>
            <Text style={styles.metaIcon}>💳</Text>
            <Text style={styles.metaText}>{task.PaidBy}</Text>
          </View>
        ) : null}
        {assignedName ? (
          <View style={styles.metaItem}>
            <Text style={styles.metaIcon}>👤</Text>
            <Text style={styles.metaText} numberOfLines={1}>{assignedName}</Text>
          </View>
        ) : null}
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Action buttons */}
      <View style={styles.actions}>
        {showAssignButton ? (
          <>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: COLORS.PRIMARY }]}
              onPress={() => { setAssignVisible(true); onAssign?.(); }}
            >
              <Text style={styles.actionBtnText}>Assign Attendant</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.editBtn} onPress={onPress}>
              <Text style={styles.editBtnIcon}>✎</Text>
            </TouchableOpacity>
          </>
        ) : showResumeButton ? (
          <>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#855300' }]}
              onPress={onPress}
            >
              <Text style={styles.actionBtnText}>Resume</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.editBtn} onPress={onPress}>
              <Text style={styles.editBtnIcon}>✎</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: actionColor ?? COLORS.PRIMARY, flex: 1 }]}
            onPress={onPress}
          >
            <Text style={styles.actionBtnText}>{actionLabel ?? 'View Details'}</Text>
          </TouchableOpacity>
        )}
      </View>

      <AssignTaskModal
        visible={assignVisible}
        taskId={task.TaskId}
        department={task.Department}
        onClose={() => setAssignVisible(false)}
        onAssigned={() => setAssignVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.WHITE,
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.OUTLINE_VARIANT,
    elevation: 2,
    shadowColor: COLORS.ON_SURFACE,
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  topChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 50,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.ON_SURFACE,
    marginBottom: 8,
    lineHeight: 22,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 10,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaIcon: { fontSize: 11 },
  metaText: {
    fontSize: 12,
    color: COLORS.ON_SURFACE_VARIANT,
    fontWeight: '600',
    maxWidth: 100,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.OUTLINE_VARIANT,
    marginBottom: 10,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  actionBtn: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  editBtn: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.OUTLINE_VARIANT,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.SURFACE_LOW,
  },
  editBtnIcon: { fontSize: 18, color: COLORS.ON_SURFACE_VARIANT },
});
