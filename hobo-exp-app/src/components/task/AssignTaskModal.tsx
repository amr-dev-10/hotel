/**
 * AssignTaskModal — manager assigns a task to an online attendant of the same department.
 * - Only attendants whose Status==true (online) are shown
 * - Filtered by task department (ALL shows everyone)
 * - Shows green online dot, task count badge, sorted by least busy first
 * - Live backend listener so online status stays fresh while modal is open
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
} from 'react-native';
import { TasksService, UsersService } from '../../services/backend';
import { COLORS } from '../../utils/constants';
import { LoadingOverlay } from '../common/LoadingOverlay';
import { useAuthStore } from '../../store/useAuthStore';

interface Props {
  visible: boolean;
  taskId: string;
  department?: string;
  onClose: () => void;
  onAssigned: () => void;
}

export function AssignTaskModal({ visible, taskId, department, onClose, onAssigned }: Props) {
  const [employees, setEmployees] = useState<any[]>([]);
  const [taskCounts, setTaskCounts] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const unsubRef = useRef<(() => void) | null>(null);
  const { employeeId, name, jobRole } = useAuthStore();
  const normalizedRole = (jobRole ?? '').toLowerCase().replace(/[\s_-]+/g, '');
  const isManager = normalizedRole === 'manager' || normalizedRole === 'frontdesk';

  const asText = (v: any) => (v === null || v === undefined ? '' : String(v).trim());
  const normalize = (v: any) => asText(v).toLowerCase().replace(/[\s_-]+/g, '');

  useEffect(() => {
    if (!visible) {
      unsubRef.current?.();
      unsubRef.current = null;
      setEmployees([]);
      setSelected(null);
      return;
    }

    const deptNorm = normalize(department);
    const isAllDept = !department || deptNorm === 'all';

    // Fetch task counts once on open
    const unsubTasks = TasksService.subscribeToAllTasks((tasks) => {
      const counts: Record<string, number> = {};
      tasks.forEach((t) => {
        const stage = (t?.Stage ?? '').toLowerCase();
        const assignedId = t?.AssignedToID ?? '';
        if (assignedId && (stage === 'created' || stage === 'assigned' || stage === 'executed')) {
          counts[assignedId] = (counts[assignedId] ?? 0) + 1;
        }
      });
      setTaskCounts(counts);
    });

    // Real-time listener on users — only online attendants, same dept
    unsubRef.current = UsersService.subscribeToAllEmployees((allUsers: any[]) => {
      const filtered = allUsers.filter((u) => {
        // Must be an attendant
        const role = normalize(u.Jobrole ?? u.JobRole ?? u.jobrole ?? '');
        if (role !== 'attendent' && role !== 'attendant') return false;

        // Must be online (Status === true)
        const status = u.Status ?? u.status;
        const isOnline = typeof status === 'boolean' ? status : normalize(status) === 'true';
        if (!isOnline) return false;

        // Must match department (unless task is ALL)
        if (!isAllDept) {
          const userDept = normalize(u.Department ?? u.department ?? '');
          if (userDept !== deptNorm) return false;
        }

        return true;
      });

      // Sort by least tasks first, then alphabetically
      filtered.sort((a, b) => {
        const ca = taskCounts[a.EmployeeId] ?? 0;
        const cb = taskCounts[b.EmployeeId] ?? 0;
        if (ca !== cb) return ca - cb;
        return asText(a.Name).localeCompare(asText(b.Name));
      });

      setEmployees(filtered);
    });

    setSelected(null);

    return () => {
      unsubTasks();
      unsubRef.current?.();
      unsubRef.current = null;
    };
  }, [visible, department]);

  // Re-sort when task counts load
  useEffect(() => {
    if (employees.length === 0) return;
    setEmployees((prev) =>
      [...prev].sort((a, b) => {
        const ca = taskCounts[a.EmployeeId] ?? 0;
        const cb = taskCounts[b.EmployeeId] ?? 0;
        if (ca !== cb) return ca - cb;
        return asText(a.Name).localeCompare(asText(b.Name));
      })
    );
  }, [taskCounts]);

  async function handleAssign() {
    if (!selected) {
      Alert.alert('Select', 'Please select an attendant');
      return;
    }
    setLoading(true);
    try {
      await TasksService.assignTaskByManager(taskId, selected.EmployeeId, selected.Name);
      onAssigned();
      onClose();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not assign task');
    } finally {
      setLoading(false);
    }
  }

  async function handleAssignToSelf() {
    if (!employeeId || !name) {
      Alert.alert('Error', 'Could not resolve your user details');
      return;
    }
    setLoading(true);
    try {
      await TasksService.assignTaskByManager(taskId, employeeId, name);
      onAssigned();
      onClose();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not assign task');
    } finally {
      setLoading(false);
    }
  }

  const deptLabel = department && department !== 'ALL'
    ? department.replace(/_/g, ' ')
    : null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Assign Task</Text>
          <Text style={styles.subtitle}>
            {deptLabel ? `Online attendants · ${deptLabel}` : 'Online attendants'}
          </Text>

          {isManager && employeeId && name ? (
            <TouchableOpacity
              style={styles.assignToSelfBtn}
              onPress={handleAssignToSelf}
              activeOpacity={0.85}
            >
              <Text style={styles.assignToSelfText}>Assign to Me</Text>
            </TouchableOpacity>
          ) : null}

          {employees.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                {deptLabel
                  ? `No online attendants in ${deptLabel}`
                  : 'No online attendants available'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={employees}
              keyExtractor={(item) => item.EmployeeId}
              style={styles.list}
              renderItem={({ item }) => {
                const count = taskCounts[item.EmployeeId] ?? 0;
                const isSelected = selected?.EmployeeId === item.EmployeeId;
                return (
                  <TouchableOpacity
                    style={[styles.row, isSelected && styles.rowSelected]}
                    onPress={() => setSelected(item)}
                    activeOpacity={0.8}
                  >
                    {/* Avatar with green online dot */}
                    <View style={styles.avatarWrap}>
                      <View style={styles.avatar}>
                        <Text style={styles.avatarLetter}>
                          {item.Name?.[0]?.toUpperCase() ?? '?'}
                        </Text>
                      </View>
                      <View style={styles.onlineDot} />
                    </View>

                    <View style={styles.info}>
                      <Text style={styles.name}>{item.Name}</Text>
                      <Text style={styles.dept}>
                        {item.Department?.replace(/_/g, ' ') ?? 'Attendant'}
                      </Text>
                    </View>

                    <View style={styles.rightCol}>
                      <View style={[styles.taskBadge, count === 0 && styles.taskBadgeFree]}>
                        <Text style={[styles.taskBadgeText, count === 0 && styles.taskBadgeTextFree]}>
                          {count} {count === 1 ? 'task' : 'tasks'}
                        </Text>
                      </View>
                      {isSelected ? <Text style={styles.checkmark}>✓</Text> : null}
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}

          <TouchableOpacity
            style={[styles.assignBtn, !selected && styles.assignBtnDisabled]}
            onPress={handleAssign}
            disabled={!selected}
          >
            <Text style={styles.assignBtnText}>Assign Task</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
      <LoadingOverlay visible={loading} />
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '75%',
  },
  title: { fontSize: 18, fontWeight: '700', color: COLORS.TEXT_PRIMARY, marginBottom: 4 },
  subtitle: { fontSize: 13, color: COLORS.TEXT_SECONDARY, marginBottom: 14 },
  list: { maxHeight: 320 },
  empty: { paddingVertical: 36, alignItems: 'center' },
  emptyText: { color: COLORS.GREY, fontSize: 14, textAlign: 'center' },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    backgroundColor: COLORS.LIGHT_GREY,
    marginBottom: 8,
  },
  rowSelected: { backgroundColor: '#EEF4FF', borderWidth: 1.5, borderColor: COLORS.PRIMARY },

  /* Avatar + green dot */
  avatarWrap: { position: 'relative', marginRight: 12 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.PRIMARY,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLetter: { color: '#fff', fontWeight: '700', fontSize: 16 },
  onlineDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: '#4CAF50',
    borderWidth: 2,
    borderColor: '#fff',
  },

  info: { flex: 1 },
  name: { fontSize: 14, fontWeight: '600', color: COLORS.TEXT_PRIMARY },
  dept: { fontSize: 12, color: COLORS.TEXT_SECONDARY, marginTop: 1 },

  rightCol: { alignItems: 'flex-end', gap: 4 },
  taskBadge: {
    backgroundColor: '#FFF3E0',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#FFB74D',
  },
  taskBadgeFree: { backgroundColor: '#E8F5E9', borderColor: '#81C784' },
  taskBadgeText: { fontSize: 11, fontWeight: '700', color: '#E65100' },
  taskBadgeTextFree: { color: '#2E7D32' },
  checkmark: { color: COLORS.PRIMARY, fontSize: 18, fontWeight: '700', marginLeft: 4 },

  assignBtn: {
    marginTop: 12,
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  assignBtnDisabled: { backgroundColor: '#BDBDBD' },
  assignBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  cancelBtn: { paddingVertical: 12, alignItems: 'center' },
  cancelBtnText: { color: COLORS.PRIMARY, fontWeight: '600', fontSize: 14 },

  assignToSelfBtn: {
    backgroundColor: '#E8F5E9',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#81C784',
  },
  assignToSelfText: { color: '#2E7D32', fontWeight: '700', fontSize: 14 },
});
