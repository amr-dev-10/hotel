import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, Modal, Pressable, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Priority, Department, AddOn, RootStackParamList } from '../../types';
import { TasksService } from '../../services/backend';
import { LoadingOverlay } from '../../components/common/LoadingOverlay';
import { useAuthStore } from '../../store/useAuthStore';
import { fetchHotelDepartments, getDepartmentOptions } from '../../services/departmentService';

const PRIMARY     = '#003D9B';
const PRIMARY_CT  = '#0052CC';
const WHITE       = '#FFFFFF';
const BG          = '#F9F9FF';
const SURFACE_LO  = '#F0F3FF';
const TEXT_DARK   = '#101C2D';
const TEXT_MID    = '#434654';
const TEXT_SOFT   = '#737685';
const SLATE_BORD  = '#E2E8F0';
const SLATE_LITE  = '#F1F5F9';

const PRIORITIES: Priority[] = ['Routine', 'Important', 'High'];
const PAID_BY_OPTIONS = ['Guest', 'Hotel', 'Complimentary'];
const TICKET_TYPES    = ['Service', 'Complaints', 'Request'];

type CreateTaskRoute = RouteProp<RootStackParamList, 'CreateTask'>;

export function CreateTaskScreen() {
  const navigation = useNavigation();
  const route = useRoute<CreateTaskRoute>();
  const insets = useSafeAreaInsets();
  const { employeeId, name, hotelId } = useAuthStore();

  const [hotelDepts, setHotelDepts] = useState<{ key: string; label: string }[]>([]);
  useEffect(() => {
    if (hotelId) {
      fetchHotelDepartments(hotelId).then((list) => setHotelDepts(getDepartmentOptions(list)));
    }
  }, [hotelId]);

  const [roomNo,      setRoomNo]      = useState(route.params?.roomNo ?? '');
  const [guestName,   setGuestName]   = useState('');
  const [desiredDate, setDesiredDate] = useState('');
  const [desiredTime, setDesiredTime] = useState('');
  const [paidBy,      setPaidBy]      = useState('');
  const [priority,    setPriority]    = useState<Priority | ''>('');
  const [department,  setDepartment]  = useState<Department | ''>('');
  const [itemOrdered, setItemOrdered] = useState('');
  const [note,        setNote]        = useState('');
  const [ticketType,  setTicketType]  = useState('Service');
  const [addons,      setAddons]      = useState<AddOn[]>([]);
  const [addonInput,  setAddonInput]  = useState('');
  const [loading,     setLoading]     = useState(false);

  const [showTypePicker,     setShowTypePicker]     = useState(false);
  const [showDeptPicker,     setShowDeptPicker]     = useState(false);
  const [showDatePicker,     setShowDatePicker]     = useState(false);
  const [showTimePicker,     setShowTimePicker]     = useState(false);
  const [pickerDate,         setPickerDate]         = useState(new Date());

  function addAddon() {
    if (addonInput.trim()) {
      setAddons([...addons, { name: addonInput.trim() }]);
      setAddonInput('');
    }
  }

  async function handleSubmit() {
    if (!roomNo.trim())      { Alert.alert('Required', 'Room number is required'); return; }
    if (!guestName.trim())   { Alert.alert('Required', 'Guest name is required'); return; }
    if (!desiredDate.trim()) { Alert.alert('Required', 'Please select a date'); return; }
    if (!desiredTime.trim()) { Alert.alert('Required', 'Please select a time'); return; }
    {
      const [dd, mm, yyyy] = desiredDate.split('/').map(Number);
      const m = desiredTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
      if (dd && mm && yyyy && m) {
        let h = Number(m[1]);
        const min = Number(m[2]);
        const ampm = m[3].toUpperCase();
        if (ampm === 'PM' && h !== 12) h += 12;
        if (ampm === 'AM' && h === 12) h = 0;
        const desiredMs = new Date(yyyy, mm - 1, dd, h, min).getTime();
        if (desiredMs < Date.now()) {
          Alert.alert('Invalid Time', 'Desired date & time cannot be in the past.');
          return;
        }
      }
    }
    if (!itemOrdered.trim()) { Alert.alert('Required', 'Item ordered is required'); return; }
    if (!priority)           { Alert.alert('Required', 'Please select a priority'); return; }
    if (!department)         { Alert.alert('Required', 'Please select a department'); return; }
    setLoading(true);
    try {
      await TasksService.createTask({
        RoomNo: roomNo.trim(), GuestName: guestName.trim(),
        Priority: priority as Priority, Note: note.trim(),
        ItemOrdered: itemOrdered.trim(), PaidBy: paidBy,
        DesiredDate: desiredDate.trim(), DesiredTime: desiredTime.trim(),
        Department: department as Department, TicketType: ticketType,
        AddOns: addons, Stage: 'Created',
        TaskAdderName: name ?? '', TaskAdderId: employeeId ?? '',
      });
      Alert.alert('Success', 'Task created!', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to create task');
    } finally { setLoading(false); }
  }

  const deptLabel = department ? (hotelDepts.find((d) => d.key === department)?.label ?? department) : '';

  return (
    <View style={styles.root}>
      <ScreenHeader title="Add Task" topInset={insets.top} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={styles.pageSub}>Fill in the details to initiate a new service request for our guests.</Text>

        {/* Form Card */}
        <View style={styles.formCard}>
          {/* Hero image with overlay title */}
          <View style={styles.hero}>
            <View style={styles.heroPlaceholder}>
              <Ionicons name="business-outline" size={48} color="rgba(255,255,255,0.55)" />
            </View>
            <View style={styles.heroOverlay}>
              <Text style={styles.heroTitle}>Service Request Form</Text>
            </View>
          </View>

          {/* Guest & Room */}
          <Field label="Guest Name">
            <TextInput
              style={styles.fillInput}
              placeholder="John Doe"
              placeholderTextColor={TEXT_SOFT}
              value={guestName}
              onChangeText={setGuestName}
            />
          </Field>

          <Field label="Room No.">
            <TextInput
              style={styles.fillInput}
              placeholder="402"
              placeholderTextColor={TEXT_SOFT}
              value={roomNo}
              onChangeText={setRoomNo}
              keyboardType="number-pad"
            />
          </Field>

          {/* Service (ticket type) */}
          <Field label="Service">
            <TouchableOpacity style={styles.fillInput} onPress={() => setShowTypePicker(true)} activeOpacity={0.85}>
              <Text style={[styles.dropText, !ticketType && styles.dropPlaceholder]}>
                {ticketType || 'Select Service'}
              </Text>
              <Ionicons name="chevron-down" size={18} color={TEXT_SOFT} />
            </TouchableOpacity>
          </Field>

          {/* Department */}
          <Field label="Department">
            <TouchableOpacity style={styles.fillInput} onPress={() => setShowDeptPicker(true)} activeOpacity={0.85}>
              <Text style={[styles.dropText, !deptLabel && styles.dropPlaceholder]}>
                {deptLabel || 'Select Dept'}
              </Text>
              <Ionicons name="chevron-down" size={18} color={TEXT_SOFT} />
            </TouchableOpacity>
          </Field>

          {/* Item & Priority — card-in-card */}
          <View style={styles.innerCard}>
            <Field label="Item Ordered" gap="sm">
              <View style={styles.whiteSelect}>
                <TextInput
                  style={styles.whiteSelectInput}
                  placeholder="Select Item"
                  placeholderTextColor={TEXT_SOFT}
                  value={itemOrdered}
                  onChangeText={setItemOrdered}
                />
              </View>
            </Field>

            <Field label="Priority Level" gap="sm">
              <View style={styles.priorityRow}>
                {PRIORITIES.map((p) => {
                  const active = priority === p;
                  const label = p === 'Important' ? 'Medium' : p === 'Routine' ? 'Low' : 'High';
                  return (
                    <TouchableOpacity
                      key={p}
                      style={[styles.priorityPill, active && styles.priorityPillActive]}
                      onPress={() => setPriority(p)}
                      activeOpacity={0.85}
                    >
                      <Text style={[styles.priorityPillText, active && styles.priorityPillTextActive]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Field>
          </View>

          {/* Paid By — radio cards */}
          <Field label="Paid By">
            <View style={styles.payRow}>
              {PAID_BY_OPTIONS.map((key) => {
                const active = paidBy === key;
                const label = key === 'Guest' ? 'Guest Account' : key;
                const opt = { key, label };
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={styles.payCard}
                    onPress={() => setPaidBy(opt.key)}
                    activeOpacity={0.85}
                  >
                    <View style={[styles.radioOuter, active && styles.radioOuterActive]}>
                      {active && <View style={styles.radioInner} />}
                    </View>
                    <Text style={styles.payText}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Field>

          {/* Optional fields — kept as in original logic */}
          <Field label="Quick Add-ons">
            <View style={styles.addonChips}>
              {addons.map((addon, i) => (
                <TouchableOpacity key={i} style={styles.addonChip} onPress={() => setAddons(addons.filter((_, idx) => idx !== i))}>
                  <Text style={styles.addonChipText}>{addon.name}</Text>
                  <Text style={styles.addonChipRemove}>  ✕</Text>
                </TouchableOpacity>
              ))}
              <TextInput
                style={styles.addonInput}
                placeholder="Type & press enter..."
                placeholderTextColor={TEXT_SOFT}
                value={addonInput}
                onChangeText={setAddonInput}
                onSubmitEditing={addAddon}
                returnKeyType="done"
                blurOnSubmit={false}
              />
            </View>
          </Field>

          <Field label="Note">
            <TextInput
              style={[styles.fillInput, styles.textarea]}
              placeholder="Additional instructions..."
              placeholderTextColor={TEXT_SOFT}
              value={note}
              onChangeText={setNote}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </Field>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Field label="Desired Date">
                <TouchableOpacity
                  style={styles.pickerTrigger}
                  onPress={() => setShowDatePicker(true)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.pickerTriggerText, !desiredDate && { color: TEXT_SOFT }]}>
                    {desiredDate || 'DD/MM/YYYY'}
                  </Text>
                  <Ionicons name="calendar-outline" size={18} color={TEXT_SOFT} />
                </TouchableOpacity>
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Desired Time">
                <TouchableOpacity
                  style={styles.pickerTrigger}
                  onPress={() => setShowTimePicker(true)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.pickerTriggerText, !desiredTime && { color: TEXT_SOFT }]}>
                    {desiredTime || 'HH:MM AM/PM'}
                  </Text>
                  <Ionicons name="time-outline" size={18} color={TEXT_SOFT} />
                </TouchableOpacity>
              </Field>
            </View>
          </View>

          {showDatePicker && (
            <DateTimePicker
              value={pickerDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
              minimumDate={new Date()}
              onChange={(e: DateTimePickerEvent, date?: Date) => {
                setShowDatePicker(false);
                if (e.type === 'set' && date) {
                  setPickerDate(date);
                  const dd = String(date.getDate()).padStart(2, '0');
                  const mm = String(date.getMonth() + 1).padStart(2, '0');
                  const yyyy = date.getFullYear();
                  setDesiredDate(`${dd}/${mm}/${yyyy}`);
                }
              }}
            />
          )}

          {showTimePicker && (
            <DateTimePicker
              value={pickerDate}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'clock'}
              onChange={(e: DateTimePickerEvent, date?: Date) => {
                setShowTimePicker(false);
                if (e.type === 'set' && date) {
                  const [dd, mm, yyyy] = (desiredDate || '').split('/').map(Number);
                  if (dd && mm && yyyy) {
                    const combined = new Date(yyyy, mm - 1, dd, date.getHours(), date.getMinutes()).getTime();
                    if (combined < Date.now()) {
                      Alert.alert('Invalid Time', 'Selected time is in the past. Please pick a future time.');
                      return;
                    }
                  }
                  setPickerDate(date);
                  let h = date.getHours();
                  const m = String(date.getMinutes()).padStart(2, '0');
                  const ampm = h >= 12 ? 'PM' : 'AM';
                  h = h % 12 || 12;
                  setDesiredTime(`${h}:${m} ${ampm}`);
                }
              }}
            />
          )}

          {/* Assign button */}
          <TouchableOpacity style={styles.assignBtn} onPress={handleSubmit} activeOpacity={0.9}>
            <Text style={styles.assignBtnText}>Assign Task</Text>
          </TouchableOpacity>
        </View>

        {/* Footer note */}
        <Text style={styles.footerNote}>
          Task will be assigned to the next available staff member in the department.
        </Text>
      </ScrollView>

      <DropdownModal visible={showTypePicker} title="Select Service"
        options={TICKET_TYPES.map((t) => ({ key: t, label: t }))} selected={ticketType}
        onSelect={(v) => { setTicketType(v); setShowTypePicker(false); }}
        onClose={() => setShowTypePicker(false)} />
      <DropdownModal visible={showDeptPicker} title="Select Department"
        options={hotelDepts} selected={department}
        onSelect={(v) => { setDepartment(v as Department); setShowDeptPicker(false); }}
        onClose={() => setShowDeptPicker(false)} />

      <LoadingOverlay visible={loading} />
    </View>
  );
}

function Field({ label, gap = 'md', children }: { label: string; gap?: 'sm' | 'md'; children: React.ReactNode }) {
  return (
    <View style={[styles.fieldWrap, { marginBottom: gap === 'sm' ? 12 : 18 }]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function DropdownModal({ visible, title, options, selected, onSelect, onClose }: {
  visible: boolean; title: string; options: { key: string; label: string }[];
  selected: string; onSelect: (v: string) => void; onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={dd.backdrop} onPress={onClose}>
        <Pressable style={dd.sheet} onPress={() => {}}>
          <View style={dd.handle} />
          <Text style={dd.title}>{title}</Text>
          {options.map((opt) => (
            <TouchableOpacity key={opt.key} style={[dd.option, selected === opt.key && dd.optionActive]} onPress={() => onSelect(opt.key)}>
              <Text style={[dd.optionText, selected === opt.key && dd.optionTextActive]}>{opt.label}</Text>
              {selected === opt.key ? <Text style={dd.check}>✓</Text> : null}
            </TouchableOpacity>
          ))}
          <View style={{ height: 24 }} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: BG },
  scroll: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 32 },

  // Heading
  pageSub:   { fontSize: 14, color: TEXT_MID, marginTop: 6, lineHeight: 20, marginBottom: 16 },

  // Form card
  formCard: {
    backgroundColor: WHITE,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EDF0F2',
    padding: 20,
    elevation: 4,
    shadowColor: '#0052CC',
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
  },

  // Hero
  hero: {
    width: '100%', height: 160,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 20,
    backgroundColor: '#1F2937',
  },
  heroPlaceholder: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: PRIMARY,
  },
  heroOverlay: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  heroTitle: { fontSize: 18, fontWeight: '700', color: WHITE, letterSpacing: -0.2 },

  // Field
  fieldWrap:  {},
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_MID,
    marginBottom: 6,
    marginLeft: 4,
    letterSpacing: 0.4,
  },

  fillInput: {
    backgroundColor: SURFACE_LO,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: TEXT_DARK,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  textarea: { minHeight: 88, textAlignVertical: 'top', alignItems: 'flex-start' },

  dropText:        { fontSize: 15, color: TEXT_DARK, fontWeight: '500', flex: 1 },
  dropPlaceholder: { color: TEXT_SOFT, fontWeight: '400' },

  // Inner card (Item + Priority)
  innerCard: {
    backgroundColor: BG,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SLATE_LITE,
    padding: 16,
    marginBottom: 18,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  whiteSelect: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: WHITE,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: SLATE_BORD,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 48,
  },
  whiteSelectInput: {
    flex: 1,
    fontSize: 15,
    color: TEXT_DARK,
  },

  // Priority pills
  priorityRow: {
    flexDirection: 'row',
    gap: 8,
  },
  priorityPill: {
    flex: 1,
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: SLATE_BORD,
    borderRadius: 9999,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  priorityPillActive: {
    backgroundColor: 'rgba(0,82,204,0.10)',
    borderColor: PRIMARY_CT,
    borderWidth: 2,
  },
  priorityPillText:       { fontSize: 13, fontWeight: '600', color: TEXT_DARK, letterSpacing: 0.4 },
  priorityPillTextActive: { color: PRIMARY },

  // Paid By
  payRow: { flexDirection: 'column', gap: 8 },
  payCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: SURFACE_LO,
    borderWidth: 1,
    borderColor: SLATE_LITE,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  radioOuter: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 1.5, borderColor: TEXT_SOFT,
    backgroundColor: WHITE,
    justifyContent: 'center', alignItems: 'center',
  },
  radioOuterActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  radioInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: WHITE },
  payText: { fontSize: 14, color: TEXT_DARK, fontWeight: '500', flex: 1 },

  // Add-ons
  addonChips: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    backgroundColor: SURFACE_LO,
    borderRadius: 8, padding: 12,
    minHeight: 48,
    alignItems: 'center',
  },
  addonChip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: WHITE, borderRadius: 9999,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: SLATE_BORD,
  },
  addonChipText:   { fontSize: 13, color: TEXT_DARK, fontWeight: '500' },
  addonChipRemove: { fontSize: 12, color: TEXT_SOFT },
  addonInput:      { fontSize: 14, color: TEXT_DARK, minWidth: 120, paddingVertical: 8, flex: 1 },

  pickerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: SURFACE_LO,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  pickerTriggerText: { fontSize: 14, color: TEXT_DARK, flex: 1 },

  // Assign button
  assignBtn: {
    backgroundColor: PRIMARY_CT,
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  assignBtnText: { fontSize: 18, fontWeight: '700', color: WHITE, letterSpacing: -0.2 },

  // Footer note
  footerNote: {
    textAlign: 'center',
    color: TEXT_SOFT,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 20,
    paddingHorizontal: 16,
  },
});

const dd = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: WHITE, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 10, elevation: 20,
  },
  handle: { width: 36, height: 4, backgroundColor: SLATE_BORD, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  title:  { fontSize: 16, fontWeight: '700', color: TEXT_DARK, marginBottom: 12 },
  option: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: SLATE_BORD,
  },
  optionActive:     { backgroundColor: SURFACE_LO, marginHorizontal: -20, paddingHorizontal: 20 },
  optionText:       { fontSize: 15, color: TEXT_DARK },
  optionTextActive: { color: PRIMARY, fontWeight: '700' },
  check:            { color: PRIMARY, fontSize: 16, fontWeight: '700' },
});
