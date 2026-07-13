/**
 * Profile Screen — matches Royal_Android ProfileFragment.java
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, KeyboardAvoidingView, Platform,
  TouchableOpacity, Alert, ScrollView, Image, Modal,
  TextInput, ActivityIndicator, Switch, Pressable, FlatList,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { UsersService } from '../../services/backend';
import { ProfileDetails, JobRole, Department, RootStackParamList } from '../../types';
import { COLORS } from '../../utils/constants';
import { useAuthStore } from '../../store/useAuthStore';
import { fetchHotelDepartments, getDepartmentOptions } from '../../services/departmentService';
import { LoadingOverlay } from '../../components/common/LoadingOverlay';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UserAvatar, AVATARS, isAvatarKey } from '../../components/common/UserAvatar';

const PRIMARY    = '#003D9B';
const PRIMARY_CT = '#0052CC';
const SECONDARY  = '#00687A';
const TEAL       = '#0052CC';
const WHITE      = '#FFFFFF';
const BG         = '#F9F9FF';
const SURFACE_LO = '#F0F3FF';
const SURFACE_CT = '#E7EEFF';
const TEXT_DARK  = '#101C2D';
const TEXT_MID   = '#434654';
const TEXT_SOFT  = '#737685';
const OUTLINE_VAR= '#C3C6D6';
const BORDER     = '#E2E8F0';
const ERROR      = '#BA1A1A';

const ROLES: JobRole[] = ['Manager', 'Attendent'];

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function ProfileScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const {
    employeeId, name, email, jobRole, department, hotelId,
    profilePicUrl, status, setStatus, setProfilePicUrl, logout,
  } = useAuthStore();

  const [hotelDepts, setHotelDepts] = useState<{ key: string; label: string }[]>([]);
  useEffect(() => {
    if (hotelId) {
      fetchHotelDepartments(hotelId).then((list) => setHotelDepts(getDepartmentOptions(list)));
    }
  }, [hotelId]);

  const [employees,        setEmployees]        = useState<ProfileDetails[]>([]);
  const [loading,          setLoading]          = useState(false);
  const [uploadingPic,     setUploadingPic]     = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [pendingAvatar,    setPendingAvatar]    = useState<string | null>(null);
  const [showAddMember,    setShowAddMember]    = useState(false);
  const [newId,            setNewId]            = useState('');
  const [newName,          setNewName]          = useState('');
  const [newEmail,         setNewEmail]         = useState('');
  const [newPassword,      setNewPassword]      = useState('');
  const [newRole,          setNewRole]          = useState<JobRole>('Attendent');
  const [newDept,          setNewDept]          = useState<Department>('');
  const [addingMember,     setAddingMember]     = useState(false);
  const [showRemoveModal,  setShowRemoveModal]  = useState(false);
  const [selectedRemoveId, setSelectedRemoveId] = useState<string | null>(null);
  const [removingEmployee, setRemovingEmployee] = useState(false);

  const normalizedRole = (jobRole ?? '').toString().trim().toLowerCase().replace(/[\s_-]+/g, '');
  const isManager = normalizedRole === 'manager' || normalizedRole === 'frontdesk';

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

  async function handleLogout() {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes', style: 'destructive',
        onPress: async () => {
          setLoading(true);
          try {
            await logout();
            navigation.reset({ index: 0, routes: [{ name: 'RoleSelect' }] });
          } finally { setLoading(false); }
        },
      },
    ]);
  }

  async function handleToggleStatus(val: boolean) {
    if (!employeeId || !name || !department) return;
    try {
      await UsersService.setActiveStatus(employeeId, name, department, val);
      await setStatus(val);
    } catch { Alert.alert('Error', 'Retry'); }
  }

  function handlePickProfilePic() {
    setPendingAvatar(profilePicUrl ?? null);
    setShowAvatarPicker(true);
  }

  async function handleAvatarSave() {
    if (!pendingAvatar || !employeeId) return;
    setUploadingPic(true);
    setShowAvatarPicker(false);
    try {
      let finalValue = pendingAvatar;
      if (!isAvatarKey(pendingAvatar)) {
        finalValue = await UsersService.uploadProfilePicture(employeeId, pendingAvatar);
      }
      await UsersService.updateUser(employeeId, { ProfileImage: finalValue });
      await setProfilePicUrl(finalValue);
      Alert.alert('Success', 'Profile Updated');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Upload Failed');
    } finally { setUploadingPic(false); }
  }

  async function pickFromCamera() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.status !== 'granted') { Alert.alert('Permission needed', 'Camera permission required'); return; }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.85, allowsEditing: true, aspect: [1, 1] });
    if (!result.canceled && result.assets[0]) setPendingAvatar(result.assets[0].uri);
  }

  async function pickFromLibrary() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') { Alert.alert('Permission needed', 'Photo library permission required'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.85, allowsEditing: true, aspect: [1, 1] });
    if (!result.canceled && result.assets[0]) setPendingAvatar(result.assets[0].uri);
  }

  function resetAddForm() {
    setNewId(''); setNewName(''); setNewEmail(''); setNewPassword('');
    setNewRole('Attendent'); setNewDept('');
  }

  async function handleAddMember() {
    if (!newId.trim()) { Alert.alert('Error', 'Employee ID cannot be empty'); return; }
    if (!/^\d{5}$/.test(newId.trim())) { Alert.alert('Error', 'Employee ID must be exactly 5 digits'); return; }
    if (!newName.trim()) { Alert.alert('Error', 'Name cannot be empty'); return; }
    if (!newEmail.trim()) { Alert.alert('Error', 'Email cannot be empty'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail.trim())) { Alert.alert('Error', 'Please enter a valid email address'); return; }
    if (!newPassword.trim()) { Alert.alert('Error', 'Password cannot be empty'); return; }
    setAddingMember(true);
    try {
      const existing = await UsersService.getUser(newId.trim());
      if (existing) { Alert.alert('Error', 'Employee Id Already Exist'); return; }
      await UsersService.updateUser(newId.trim(), {
        EmployeeId: newId.trim(), Name: newName.trim(), Email: newEmail.trim(),
        Password: newPassword.trim(), Jobrole: newRole, Department: newDept, Status: false,
      });
      Alert.alert('Success', 'Added SuccessFully');
      resetAddForm(); setShowAddMember(false);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to add employee');
    } finally { setAddingMember(false); }
  }

  async function handleRemoveEmployee() {
    if (!selectedRemoveId) { Alert.alert('Error', 'Employee ID or Task ID is null'); return; }
    setRemovingEmployee(true);
    try {
      await UsersService.deleteUser(selectedRemoveId);
      Alert.alert('Success', 'Employee removed successfully');
      setSelectedRemoveId(null); setShowRemoveModal(false);
    } catch (e: any) {
      Alert.alert('Error', `Error removing employee: ${e?.message ?? ''}`);
    } finally { setRemovingEmployee(false); }
  }

  const initial = name?.[0]?.toUpperCase() ?? '?';

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ── Profile Hero Card ── */}
        <View style={styles.heroCard}>
          <View style={styles.heroAvatarWrap}>
            <View style={styles.heroAvatarRing}>
              <TouchableOpacity onPress={handlePickProfilePic} activeOpacity={0.85}>
                {uploadingPic ? (
                  <View style={styles.heroAvatarLoading}>
                    <ActivityIndicator color={PRIMARY} />
                  </View>
                ) : (
                  <UserAvatar profileImage={profilePicUrl} name={name} size={96} />
                )}
              </TouchableOpacity>
            </View>
            <View style={styles.heroVerifiedBadge}>
              <Ionicons name="checkmark" size={14} color={WHITE} />
            </View>
          </View>

          <Text style={styles.heroName}>{name ?? 'User'}</Text>
          <Text style={styles.heroId}>ID: {employeeId}</Text>
          {department ? (
            <View style={styles.heroDeptChip}>
              <Ionicons name="business-outline" size={13} color={PRIMARY_CT} />
              <Text style={styles.heroDeptText}>
                {hotelDepts.find((d) => d.key === department)?.label ?? String(department).replace(/_/g, ' ')}
                {jobRole ? `  ·  ${jobRole === 'Attendent' ? 'Attendant' : jobRole}` : ''}
              </Text>
            </View>
          ) : null}

          <TouchableOpacity style={styles.changePicBtn} onPress={handlePickProfilePic} activeOpacity={0.85}>
            <Text style={styles.changePicBtnText}>Change Picture</Text>
          </TouchableOpacity>
        </View>

        {/* ── Account Details (manager only) ── */}
        {isManager ? (
          <View style={styles.accountSection}>
            <Text style={styles.sectionLabel}>ACCOUNT DETAILS</Text>
            <View style={styles.accountCard}>
              <TouchableOpacity style={styles.accountRow} onPress={() => setShowAddMember(true)} activeOpacity={0.85}>
                <View style={styles.accountLeft}>
                  <View style={[styles.accountIcon, { backgroundColor: 'rgba(0,82,204,0.10)' }]}>
                    <Ionicons name="id-card-outline" size={20} color={PRIMARY_CT} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.accountTitle}>Create Employee ID</Text>
                    <Text style={styles.accountSub}>Add verification to your profile</Text>
                  </View>
                </View>
                <Text style={[styles.accountAction, { color: PRIMARY_CT }]}>Create</Text>
              </TouchableOpacity>

              <View style={styles.accountDivider} />

              <TouchableOpacity style={styles.accountRow} onPress={() => setShowRemoveModal(true)} activeOpacity={0.85}>
                <View style={styles.accountLeft}>
                  <View style={[styles.accountIcon, { backgroundColor: 'rgba(186,26,26,0.10)' }]}>
                    <Ionicons name="person-remove-outline" size={20} color={ERROR} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.accountTitle}>Remove Employee Id</Text>
                    <Text style={styles.accountSub}>Revoke existing identification</Text>
                  </View>
                </View>
                <Text style={[styles.accountAction, { color: ERROR }]}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {/* ── Shortcut Grid ── */}
        <View style={styles.shortcutRow}>
          <TouchableOpacity
            style={[styles.shortcutCard, { backgroundColor: SURFACE_CT, borderColor: 'rgba(0,82,204,0.10)' }]}
            onPress={() => navigation.navigate('Main')}
            activeOpacity={0.85}
          >
            <Ionicons name="reader-outline" size={24} color={PRIMARY_CT} />
            <View>
              <Text style={styles.shortcutTitle}>Recent Tasks</Text>
              <Text style={styles.shortcutSub}>View pending items</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.shortcutCard, { backgroundColor: 'rgba(0,217,254,0.10)', borderColor: 'rgba(0,104,122,0.10)' }]}
            onPress={() => navigation.navigate('Main')}
            activeOpacity={0.85}
          >
            <Ionicons name="chatbubbles-outline" size={24} color={SECONDARY} />
            <View>
              <Text style={styles.shortcutTitle}>Team Chat</Text>
              <Text style={styles.shortcutSub}>Messages & updates</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* ── Rooms ── */}
        <View style={styles.accountSection}>
          <Text style={styles.sectionLabel}>ROOMS</Text>
          <View style={styles.accountCard}>
            <TouchableOpacity style={styles.accountRow} onPress={() => navigation.navigate('BlockedRooms')} activeOpacity={0.85}>
              <View style={styles.accountLeft}>
                <View style={[styles.accountIcon, { backgroundColor: 'rgba(133,83,0,0.10)' }]}>
                  <Ionicons name="construct-outline" size={20} color="#855300" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.accountTitle}>Blocked Rooms</Text>
                  <Text style={styles.accountSub}>Rooms out of service for maintenance</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={SECONDARY} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Logout ── */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ── Add Team Member Modal ── */}
      <Modal visible={showAddMember} transparent animationType="slide" onRequestClose={() => setShowAddMember(false)}>
        <KeyboardAvoidingView style={styles.modalBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>Add Team Member</Text>

              <Text style={styles.fieldLabel}>Employee ID * (5 digits)</Text>
              <TextInput style={styles.input} placeholder="e.g. 10001" placeholderTextColor={TEXT_SOFT}
                value={newId} onChangeText={(v) => setNewId(v.replace(/\D/g, '').slice(0, 5))} keyboardType="number-pad" maxLength={5} />

              <Text style={styles.fieldLabel}>Full Name *</Text>
              <TextInput style={styles.input} placeholder="Full name" placeholderTextColor={TEXT_SOFT}
                value={newName} onChangeText={setNewName} />

              <Text style={styles.fieldLabel}>Email *</Text>
              <TextInput style={styles.input} placeholder="Email address" placeholderTextColor={TEXT_SOFT}
                value={newEmail} onChangeText={setNewEmail} keyboardType="email-address" autoCapitalize="none" />

              <Text style={styles.fieldLabel}>Password *</Text>
              <TextInput style={styles.input} placeholder="Password" placeholderTextColor={TEXT_SOFT}
                value={newPassword} onChangeText={setNewPassword} secureTextEntry />

              <Text style={styles.fieldLabel}>Job Role</Text>
              <View style={styles.chipRow}>
                {ROLES.map((r) => (
                  <TouchableOpacity key={r} style={[styles.chip, newRole === r && styles.chipActive]} onPress={() => setNewRole(r)}>
                    <Text style={[styles.chipText, newRole === r && styles.chipTextActive]}>
                      {r === 'Attendent' ? 'Attendant' : r}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Department</Text>
              <View style={styles.chipRow}>
                {hotelDepts.map((d) => (
                  <TouchableOpacity key={d.key} style={[styles.chip, newDept === d.key && styles.chipActive]} onPress={() => setNewDept(d.key)}>
                    <Text style={[styles.chipText, newDept === d.key && styles.chipTextActive]}>
                      {d.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={[styles.submitBtn, addingMember && styles.submitBtnDisabled]} onPress={handleAddMember} disabled={addingMember}>
                {addingMember ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Add Attendant</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelModalBtn} onPress={() => { resetAddForm(); setShowAddMember(false); }}>
                <Text style={styles.cancelModalText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Remove Employee Modal ── */}
      <Modal visible={showRemoveModal} transparent animationType="slide" onRequestClose={() => setShowRemoveModal(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.removeSheet} onPress={() => {}}>
            <Text style={styles.modalTitle}>Remove Employee</Text>
            <Text style={styles.removeSubtitle}>Select an employee from the list below</Text>
            <FlatList
              data={employees.filter((e) => e.EmployeeId !== employeeId)}
              keyExtractor={(item) => item.EmployeeId}
              style={styles.removeList}
              renderItem={({ item }) => {
                const isSelected = selectedRemoveId === item.EmployeeId;
                return (
                  <TouchableOpacity style={[styles.removeRow, isSelected && styles.removeRowSelected]} onPress={() => setSelectedRemoveId(item.EmployeeId)}>
                    <View style={styles.removeAvatar}>
                      <UserAvatar profileImage={item.ProfileImage} name={item.Name} size={40} />
                    </View>
                    <View style={styles.removeInfo}>
                      <Text style={styles.removeName}>{item.Name}</Text>
                      <Text style={styles.removeRole}>
                        {item.JobRole === 'Attendent' ? 'Attendant' : item.JobRole}
                        {item.Department ? ` · ${hotelDepts.find((d) => d.key === item.Department)?.label ?? item.Department}` : ''}
                      </Text>
                    </View>
                    {isSelected ? <Text style={styles.removeCheck}>✓</Text> : null}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={<Text style={styles.emptyTeam}>No employees to remove</Text>}
            />
            <TouchableOpacity style={[styles.submitBtn, styles.removeBtn, (!selectedRemoveId || removingEmployee) && styles.submitBtnDisabled]}
              onPress={handleRemoveEmployee} disabled={!selectedRemoveId || removingEmployee}>
              <Text style={styles.submitBtnText}>{removingEmployee ? 'Removing...' : 'Remove'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelModalBtn} onPress={() => { setSelectedRemoveId(null); setShowRemoveModal(false); }}>
              <Text style={styles.cancelModalText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </View>
      </Modal>

      {/* ── Avatar Picker Modal ── */}
      <Modal visible={showAvatarPicker} transparent animationType="slide" onRequestClose={() => setShowAvatarPicker(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowAvatarPicker(false)}>
          <Pressable style={styles.avatarPickerSheet} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <Text style={styles.modalTitle}>Change Profile Photo</Text>

            {/* Preview */}
            <View style={styles.pickerPreviewWrap}>
              {pendingAvatar ? (
                isAvatarKey(pendingAvatar) ? (
                  <View style={[styles.pickerPreview, { backgroundColor: AVATARS.find((a) => a.key === pendingAvatar)?.bg ?? '#E5E7EB', overflow: 'hidden' }]}>
                    <Image source={{ uri: AVATARS.find((a) => a.key === pendingAvatar)?.url }} style={styles.pickerPreview} />
                  </View>
                ) : (
                  <Image source={{ uri: pendingAvatar }} style={styles.pickerPreview} />
                )
              ) : (
                <UserAvatar profileImage={profilePicUrl} name={name} size={80} />
              )}
            </View>

            {/* Camera / Gallery */}
            <View style={styles.photoRow}>
              <TouchableOpacity style={styles.photoBtn} onPress={pickFromCamera} activeOpacity={0.8}>
                <Text style={styles.photoBtnIcon}>📷</Text>
                <Text style={styles.photoBtnText}>Camera</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.photoBtn} onPress={pickFromLibrary} activeOpacity={0.8}>
                <Text style={styles.photoBtnIcon}>🖼️</Text>
                <Text style={styles.photoBtnText}>Gallery</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.pickerDivRow}>
              <View style={styles.pickerDivLine} />
              <Text style={styles.pickerDivLabel}>or pick an avatar</Text>
              <View style={styles.pickerDivLine} />
            </View>

            {/* Avatar grid */}
            <View style={styles.avatarGrid}>
              {AVATARS.map((av) => {
                const active = pendingAvatar === av.key;
                return (
                  <TouchableOpacity
                    key={av.key}
                    style={[styles.avCell, { backgroundColor: av.bg }, active && styles.avCellActive]}
                    onPress={() => setPendingAvatar(av.key)}
                    activeOpacity={0.75}
                  >
                    <Image source={{ uri: av.url }} style={styles.avCellImg} />
                    {active && (
                      <View style={styles.avCheck}><Text style={styles.avCheckMark}>✓</Text></View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, !pendingAvatar && styles.submitBtnDisabled]}
              onPress={handleAvatarSave}
              disabled={!pendingAvatar}
            >
              <Text style={styles.submitBtnText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelModalBtn} onPress={() => setShowAvatarPicker(false)}>
              <Text style={styles.cancelModalText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <LoadingOverlay visible={loading} />
    </View>
  );
}

const styles = StyleSheet.create({
  root:      { flex: 1, backgroundColor: BG },
  content:   { padding: 20, paddingBottom: 48, gap: 20 },

  // Hero card
  heroCard: {
    backgroundColor: WHITE,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(195,198,214,0.3)',
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#0052CC',
    shadowOpacity: 0.06,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
  },
  heroAvatarWrap: {
    position: 'relative',
    marginBottom: 14,
  },
  heroAvatarRing: {
    width: 104, height: 104,
    borderRadius: 52,
    padding: 4,
    backgroundColor: 'rgba(0,82,204,0.20)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroAvatarLoading: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center', alignItems: 'center',
  },
  heroVerifiedBadge: {
    position: 'absolute',
    bottom: 0, right: 0,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: PRIMARY,
    borderWidth: 2, borderColor: WHITE,
    justifyContent: 'center', alignItems: 'center',
  },
  heroName: {
    fontSize: 22, fontWeight: '700',
    color: TEXT_DARK, letterSpacing: -0.3,
  },
  heroId: {
    fontSize: 12, fontWeight: '600',
    color: TEXT_SOFT, letterSpacing: 1.6,
    marginTop: 4,
  },
  heroDeptChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 10, paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 999, backgroundColor: 'rgba(0,82,204,0.08)',
  },
  heroDeptText: { fontSize: 13, fontWeight: '700', color: PRIMARY_CT },

  // Change Picture pill
  changePicBtn: {
    marginTop: 22,
    borderWidth: 1, borderColor: PRIMARY_CT,
    borderRadius: 8,
    paddingHorizontal: 28, paddingVertical: 11,
    backgroundColor: WHITE,
  },
  changePicBtnText: { color: PRIMARY_CT, fontSize: 14, fontWeight: '600', letterSpacing: 0.3 },

  // Section label (ACCOUNT DETAILS)
  accountSection: {},
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: TEXT_MID,
    letterSpacing: 0.8,
    marginBottom: 10,
    paddingHorizontal: 4,
  },

  // Account card with rows
  accountCard: {
    backgroundColor: WHITE,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(195,198,214,0.3)',
    overflow: 'hidden',
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    gap: 12,
  },
  accountLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  accountIcon: {
    width: 40, height: 40, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center',
  },
  accountTitle: { fontSize: 14, fontWeight: '600', color: TEXT_DARK },
  accountSub:   { fontSize: 12, color: TEXT_SOFT, marginTop: 2 },
  accountAction:{ fontSize: 14, fontWeight: '600' },
  accountDivider: { height: 1, backgroundColor: 'rgba(195,198,214,0.2)' },

  // Shortcut grid
  shortcutRow: { flexDirection: 'row', gap: 12 },
  shortcutCard: {
    flex: 1,
    height: 124,
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    justifyContent: 'space-between',
  },
  shortcutTitle: { fontSize: 14, fontWeight: '600', color: TEXT_DARK },
  shortcutSub:   { fontSize: 12, color: TEXT_SOFT, marginTop: 2 },

  // Logout
  logoutBtn: {
    borderWidth: 1, borderColor: PRIMARY_CT,
    backgroundColor: WHITE,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  logoutText: { color: PRIMARY_CT, fontSize: 18, fontWeight: '700', letterSpacing: -0.2 },

  // Modals
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalScroll:   { justifyContent: 'flex-end', flexGrow: 1 },
  modalBox:      { backgroundColor: WHITE, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  modalTitle:    { fontSize: 18, fontWeight: '700', color: TEXT_DARK, marginBottom: 16 },
  fieldLabel:    { fontSize: 13, fontWeight: '600', color: TEXT_SOFT, marginTop: 12, marginBottom: 6 },
  input: {
    borderWidth: 1.5, borderColor: BORDER, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: TEXT_DARK, backgroundColor: WHITE,
  },
  chipRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip:         { borderWidth: 1.5, borderColor: TEAL, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  chipActive:   { backgroundColor: TEAL },
  chipText:     { fontSize: 12, color: TEAL, fontWeight: '600' },
  chipTextActive: { color: WHITE },
  submitBtn:    { backgroundColor: TEAL, borderRadius: 50, paddingVertical: 14, alignItems: 'center', marginTop: 20, marginBottom: 8 },
  submitBtnDisabled: { backgroundColor: '#D1D5DB' },
  submitBtnText: { color: WHITE, fontWeight: '700', fontSize: 15 },
  cancelModalBtn: { paddingVertical: 12, alignItems: 'center' },
  cancelModalText: { color: TEAL, fontWeight: '600', fontSize: 14 },

  removeSheet:    { backgroundColor: WHITE, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40, maxHeight: '80%' },
  removeSubtitle: { fontSize: 13, color: TEXT_SOFT, marginBottom: 12 },
  removeList:     { maxHeight: 350 },
  removeRow:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: BORDER },
  removeRowSelected: { backgroundColor: '#F0FDFC' },
  removeAvatar:   { width: 40, height: 40, borderRadius: 20, backgroundColor: TEAL, justifyContent: 'center', alignItems: 'center', marginRight: 12, overflow: 'hidden' },
  removeAvatarImg: { width: 40, height: 40, borderRadius: 20 },
  removeAvatarLetter: { color: WHITE, fontWeight: '700', fontSize: 16 },
  removeInfo:     { flex: 1 },
  removeName:     { fontSize: 14, fontWeight: '600', color: TEXT_DARK },
  removeRole:     { fontSize: 12, color: TEXT_SOFT, marginTop: 1 },
  removeCheck:    { color: TEAL, fontSize: 18, fontWeight: '700' },
  removeBtn:      { backgroundColor: '#EF4444' },
  emptyTeam:      { color: TEXT_SOFT, fontSize: 14, textAlign: 'center', paddingVertical: 12 },

  // Avatar picker sheet
  avatarPickerSheet: {
    backgroundColor: WHITE, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 36, maxHeight: '90%',
  },
  sheetHandle: { width: 36, height: 4, backgroundColor: BORDER, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  pickerPreviewWrap: { alignItems: 'center', marginBottom: 16 },
  pickerPreview: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  pickerPreviewEmoji: { fontSize: 42 },
  photoRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  photoBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: WHITE, borderRadius: 10, borderWidth: 1.5, borderColor: TEAL, paddingVertical: 10,
  },
  photoBtnIcon: { fontSize: 16 },
  photoBtnText: { fontSize: 13, fontWeight: '700', color: TEAL },
  pickerDivRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  pickerDivLine: { flex: 1, height: 1, backgroundColor: BORDER },
  pickerDivLabel: { fontSize: 11, color: TEXT_SOFT },
  avatarGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginBottom: 4 },
  avCell: {
    width: 60, height: 60, borderRadius: 30,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2.5, borderColor: 'transparent', position: 'relative',
    overflow: 'hidden',
  },
  avCellActive: { borderColor: TEAL, elevation: 3, shadowColor: TEAL, shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  avCellImg: { width: 55, height: 55, borderRadius: 27.5 },
  avEmoji: { fontSize: 28 },
  avCheck: {
    position: 'absolute', bottom: 0, right: 0,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: TEAL, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: WHITE,
  },
  avCheckMark: { color: WHITE, fontSize: 9, fontWeight: '800' },
});
