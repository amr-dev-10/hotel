/**
 * TransferTaskModal — mirrors the web Arcadia_Dashboard TransferTicketModal.
 * Two-step picker:
 *   1. Destination department (all hotel departments)
 *   2. Assign to — "Auto-assign (will go to <lightest>)" + a role-filtered list
 *      of staff in that department:
 *        • Owner/admin  → managers + attendants (managers tagged "[Manager]")
 *        • Manager      → attendants only
 *        • Owners are never assignable
 *      Each row shows online/OFF status and the staffer's active-ticket load.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { LoadingOverlay } from '../common/LoadingOverlay';
import { TenantManager } from '../../services/tenant';
import { fetchHotelDepartments, getDepartmentOptions } from '../../services/departmentService';
import { TasksService, UsersService } from '../../services/backend';
import { useAuthStore } from '../../store/useAuthStore';

interface Props {
  visible: boolean;
  currentDepartment?: string;
  currentAssignedId?: string;
  taskId: string;
  onClose: () => void;
  onTransferred: () => void;
}

type Staff = {
  EmployeeId: string;
  Name: string;
  Department: string;
  Jobrole: string;
  Status: boolean | string;
};

const asText = (v: any) => (v === null || v === undefined ? '' : String(v).trim());
const normSlug = (v: any) => asText(v).toLowerCase().replace(/[\s_-]+/g, '');
const normaliseRole = (r: any) => {
  const s = asText(r).toLowerCase();
  if (s === 'attendent' || s === 'attendant') return 'attendant';
  if (s === 'manager') return 'manager';
  if (s === 'frontdesk' || s === 'front_desk') return 'frontdesk';
  return s;
};
const isOff = (status: boolean | string) =>
  status === false || normSlug(status) === 'off' || normSlug(status) === 'false';

export function TransferTaskModal({
  visible,
  currentDepartment,
  currentAssignedId,
  taskId,
  onClose,
  onTransferred,
}: Props) {
  const { isHotelOwner } = useAuthStore();
  const isAdmin = !!isHotelOwner;

  const [departments, setDepartments] = useState<{ key: string; label: string }[]>([]);
  const [selectedDept, setSelectedDept] = useState<string | null>(null);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [taskCounts, setTaskCounts] = useState<Record<string, number>>({});
  const [assignTo, setAssignTo] = useState<string>('auto'); // 'auto' | EmployeeId
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [saving, setSaving] = useState(false);
  const unsubRef = useRef<(() => void) | null>(null);

  // Departments + default selection
  useEffect(() => {
    if (!visible) return;
    const hotelId = TenantManager.getHotelId();
    fetchHotelDepartments(hotelId)
      .then((list) => {
        const opts = getDepartmentOptions(list, false);
        setDepartments(opts);
        setSelectedDept(currentDepartment ?? opts[0]?.key ?? null);
      })
      .catch(() => {
        setDepartments([]);
        setSelectedDept(currentDepartment ?? null);
      });
    setAssignTo('auto');
  }, [visible, currentDepartment]);

  // Staff (attendants + managers, no owners) + their open-ticket load
  useEffect(() => {
    if (!visible) {
      unsubRef.current?.();
      unsubRef.current = null;
      setStaff([]);
      setTaskCounts({});
      return;
    }
    setLoadingStaff(true);

    const unsubTasks = TasksService.subscribeToAllTasks((tasks) => {
      const counts: Record<string, number> = {};
      tasks.forEach((t) => {
        const stage = asText(t?.Stage).toLowerCase();
        if (['completed', 'delivered', 'cancelled', 'closed'].includes(stage)) return;
        const id = asText(t?.AssignedToID);
        if (id) counts[id] = (counts[id] ?? 0) + 1;
      });
      setTaskCounts(counts);
    });

    unsubRef.current = UsersService.subscribeToAllEmployees((employees: any[]) => {
      const list: Staff[] = [];
      employees.forEach((v: any) => {
        if (v.isHotelOwner === true) return; // owners not assignable
        const role = normaliseRole(v.Jobrole ?? v.JobRole ?? v.jobrole);
        if (role !== 'attendant' && role !== 'manager' && role !== 'frontdesk') return;
        list.push({
          EmployeeId: asText(v.EmployeeId),
          Name: asText(v.Name),
          Department: asText(v.Department ?? v.department),
          Jobrole: asText(v.Jobrole ?? v.JobRole ?? v.jobrole),
          Status: v.Status ?? v.status ?? 'on',
        });
      });
      setStaff(list);
      setLoadingStaff(false);
    });

    return () => {
      unsubTasks();
      unsubRef.current?.();
      unsubRef.current = null;
    };
  }, [visible]);

  // Staff in the selected department, role-filtered for the current user.
  const deptStaff = useMemo(() => {
    if (!selectedDept) return [];
    const dept = normSlug(selectedDept);
    let filtered = staff.filter((s) => normSlug(s.Department) === dept);
    // Non-admin (manager / front desk) sees frontline staff (attendants +
    // front desk); admin/owner sees everyone (managers included).
    if (!isAdmin) {
      filtered = filtered.filter((s) => ['attendant', 'frontdesk'].includes(normaliseRole(s.Jobrole)));
    }
    return filtered.sort((a, b) => {
      const ca = taskCounts[a.EmployeeId] ?? 0;
      const cb = taskCounts[b.EmployeeId] ?? 0;
      if (ca !== cb) return ca - cb;
      return a.Name.localeCompare(b.Name);
    });
  }, [staff, selectedDept, isAdmin, taskCounts]);

  // Lightest-loaded available attendant — previewed on the Auto-assign option.
  // Auto-assign routes to a same-department attendant first (Tier 1), so the
  // preview names an attendant only (managers/front desk are manual-pick only).
  const autoPick = useMemo(() => {
    const available = deptStaff.filter((s) => normaliseRole(s.Jobrole) === 'attendant' && !isOff(s.Status));
    if (available.length === 0) return null;
    return available.reduce((best, curr) => {
      const bc = taskCounts[best.EmployeeId] ?? 0;
      const cc = taskCounts[curr.EmployeeId] ?? 0;
      if (cc < bc) return curr;
      if (cc === bc) return curr.Name.localeCompare(best.Name) < 0 ? curr : best;
      return best;
    });
  }, [deptStaff, taskCounts]);

  async function handleTransfer() {
    if (!selectedDept) { Alert.alert('Select', 'Please select a destination department'); return; }
    const sameDept = selectedDept === currentDepartment;
    const samePerson = assignTo !== 'auto' && assignTo === (currentAssignedId ?? '');
    if (sameDept && (assignTo === 'auto' || samePerson)) {
      Alert.alert('No change', 'Nothing changed for this ticket');
      return;
    }
    setSaving(true);
    try {
      if (assignTo !== 'auto') {
        const target = staff.find((s) => s.EmployeeId === assignTo);
        if (!target) { Alert.alert('Error', 'Selected staff not found'); setSaving(false); return; }
        await TasksService.transferTicket(taskId, selectedDept, { id: target.EmployeeId, name: target.Name });
      } else {
        await TasksService.transferTicket(taskId, selectedDept, null);
      }
      onTransferred();
      onClose();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not transfer ticket');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Transfer Ticket</Text>
          <Text style={styles.subtitle}>Move to a different department or attendant</Text>

          <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
            {/* Department */}
            <Text style={styles.sectionLabel}>Department</Text>
            <View style={styles.chipWrap}>
              {departments.length === 0 ? (
                <Text style={styles.emptyText}>No departments found</Text>
              ) : departments.map((d) => {
                const sel = selectedDept === d.key;
                return (
                  <TouchableOpacity
                    key={d.key}
                    style={[styles.chip, sel && styles.chipSelected]}
                    onPress={() => { setSelectedDept(d.key); setAssignTo('auto'); }}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.chipText, sel && styles.chipTextSelected]}>{d.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Assign to */}
            <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Assign to</Text>
            {loadingStaff ? (
              <View style={styles.loadingRow}><ActivityIndicator color="#0C9488" /></View>
            ) : (
              <>
                {/* Auto-assign */}
                <TouchableOpacity
                  style={[styles.row, assignTo === 'auto' && styles.rowSelected]}
                  onPress={() => setAssignTo('auto')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.name}>
                    Auto-assign{autoPick ? ` (will go to ${autoPick.Name})` : ''}
                  </Text>
                  {assignTo === 'auto' ? <Text style={styles.check}>✓</Text> : null}
                </TouchableOpacity>

                {/* Staff rows */}
                {deptStaff.map((s) => {
                  const sel = assignTo === s.EmployeeId;
                  const off = isOff(s.Status);
                  const count = taskCounts[s.EmployeeId] ?? 0;
                  const role = normaliseRole(s.Jobrole);
                  const roleTag = role === 'manager' ? '  [Manager]' : role === 'frontdesk' ? '  [Front Desk]' : '';
                  return (
                    <TouchableOpacity
                      key={s.EmployeeId}
                      style={[styles.row, sel && styles.rowSelected]}
                      onPress={() => setAssignTo(s.EmployeeId)}
                      activeOpacity={0.8}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.name}>
                          {s.Name}{roleTag}
                        </Text>
                        <Text style={styles.meta}>
                          {off ? 'OFF · ' : 'Online · '}{count} active
                        </Text>
                      </View>
                      {sel ? <Text style={styles.check}>✓</Text> : null}
                    </TouchableOpacity>
                  );
                })}

                {selectedDept && deptStaff.length === 0 ? (
                  <Text style={styles.hint}>
                    No staff in this department yet — the ticket will sit in Created until one is added.
                  </Text>
                ) : null}
              </>
            )}
          </ScrollView>

          <TouchableOpacity
            style={[styles.transferBtn, (!selectedDept || saving) && styles.transferBtnDisabled]}
            onPress={handleTransfer}
            disabled={!selectedDept || saving}
          >
            <Text style={styles.transferBtnText}>{saving ? 'Transferring…' : 'Transfer'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
      <LoadingOverlay visible={saving} />
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '85%' },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#6B7280', marginBottom: 12 },

  sectionLabel: { fontSize: 12, fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, backgroundColor: '#F3F4F6', borderWidth: 1.5, borderColor: 'transparent' },
  chipSelected: { backgroundColor: '#EEF4FF', borderColor: '#2563EB' },
  chipText: { fontSize: 13, color: '#111827', fontWeight: '600' },
  chipTextSelected: { color: '#2563EB' },

  loadingRow: { paddingVertical: 24, alignItems: 'center' },
  row: { padding: 12, borderRadius: 10, backgroundColor: '#F3F4F6', marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowSelected: { backgroundColor: '#EEF4FF', borderWidth: 1.5, borderColor: '#2563EB' },
  name: { fontSize: 14, color: '#111827', fontWeight: '600' },
  meta: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  check: { color: '#2563EB', fontWeight: '700', fontSize: 16, marginLeft: 8 },
  hint: { fontSize: 11, color: '#92400E', backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginTop: 4 },
  emptyText: { color: '#9CA3AF', paddingVertical: 8 },

  transferBtn: { marginTop: 12, backgroundColor: '#0C9488', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  transferBtnDisabled: { backgroundColor: '#BDBDBD' },
  transferBtnText: { color: '#fff', fontWeight: '700' },
  cancelBtn: { paddingVertical: 12, alignItems: 'center' },
  cancelText: { color: '#0C9488', fontWeight: '600' },
});
