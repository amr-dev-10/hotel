import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../services/firebaseConfig';
import { RootStackParamList, JobRole } from '../../types';
import { useAuthStore } from '../../store/useAuthStore';
import { LoadingOverlay } from '../../components/common/LoadingOverlay';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../utils/constants';
import { TenantManager } from '../../services/tenant';
import { fetchHotelDepartments, sanitizeDepartment as sanitizeDeptDynamic } from '../../services/departmentService';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export function LoginScreen({ navigation, route }: Props) {
  const { userType } = route.params;
  const login = useAuthStore((s) => s.login);

  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const isReady = employeeId.trim().length > 0 && password.trim().length > 0;

  async function handleLogin() {
    if (!isReady) return;
    setLoading(true);
    try {
      const docSnap = await getDoc(doc(db, 'users', employeeId.trim()));
      if (!docSnap.exists()) {
        Alert.alert('Error', 'Contact Admin');
        return;
      }
      const data = docSnap.data()!;
      if (!data.Password) {
        Alert.alert('Error', 'Contact Admin');
        return;
      }
      // Normalize role comparison — handle Front_desk / front_desk variants
      const normalizeRole = (r: string) => (r ?? '').trim().toLowerCase().replace(/[\s_-]+/g, '');
      const storedRole = normalizeRole(data.Jobrole ?? '');
      const storedDept = normalizeRole(data.Department ?? '');
      const selectedRole = normalizeRole(userType);

      // In Firestore, "Front_desk" is a Department, not a Jobrole.
      // Jobrole is only "Manager" or "Attendent". For front-desk login,
      // validate against the Department field instead.
      const FRONT_DESK_DEPTS = new Set([
        'frontdesk', 'emergencyservices', 'emergencyresponse',
        'handlegeneralinquiries', 'safety',
      ]);

      let roleMatch: boolean;
      if (selectedRole === 'frontdesk') {
        roleMatch = FRONT_DESK_DEPTS.has(storedDept);
      } else {
        roleMatch = storedRole === selectedRole;
      }

      if (
        data.Password.toLowerCase() !== password.trim().toLowerCase() ||
        !roleMatch
      ) {
        Alert.alert('Error', 'Incorrect Credentials');
        return;
      }

      const hotelId = (data.hotel_id ?? data.HOTEL_ID ?? '').toString();
      if (!TenantManager.isValidHotelId(hotelId)) {
        Alert.alert('Error', 'Account not linked to a hotel. Contact Admin.');
        return;
      }

      const hotelSnap = await getDoc(doc(db, 'hotels', hotelId));
      let hotelName = '';
      if (hotelSnap.exists()) {
        const hotelData = hotelSnap.data() as Record<string, unknown>;
        const status = (hotelData.status ?? hotelData.Status ?? '').toString();
        if (status.toLowerCase() === 'suspended') {
          Alert.alert('Error', 'Hotel is suspended. Contact Admin.');
          return;
        }
        hotelName =
          (hotelData.name ?? hotelData.Name ?? hotelData.hotelName ?? hotelData.hotel_name ?? '').toString();
      }

      const hotelDepts = await fetchHotelDepartments(hotelId);
      const profileImage = (data.ProfileImage ?? '').toString().trim();
      // When user logs in as Front Desk, store 'Front_desk' as the jobRole
      // so navigation grants them the full 6-tab manager layout.
      const effectiveRole = selectedRole === 'frontdesk' ? 'Front_desk' : data.Jobrole;
      await login({
        employeeId: docSnap.id,
        phoneNumber: '',
        name: data.Name ?? '',
        email: data.Email ?? '',
        jobRole: effectiveRole as JobRole,
        department: sanitizeDeptDynamic(data.Department, hotelDepts),
        isHotelOwner: data.isHotelOwner === true,
        hotelId,
        hotelName,
        profilePicUrl: profileImage || undefined,
        status: data.Status ?? false,
      });
      navigation.reset({
        index: 0,
        routes: [{ name: profileImage ? 'Main' : 'SetupProfile' }],
      });
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  function handleForgotPassword() {
    Alert.alert(
      'Reset Password',
      'Please contact your admin to reset your password.',
      [{ text: 'OK' }]
    );
  }

  const roleLabel = userType === 'Attendent' ? 'Attendant' : userType === 'Front_desk' ? 'Front Desk' : userType;

  return (
    <SafeAreaView style={styles.flex} edges={['bottom']}>
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
      >
        {/* Header — teal banner with logo */}
        <View style={styles.header}>
          <View style={styles.headerOverlay} />
          <View style={styles.logoBadge}>
            <Image source={require('../../../assets/Hobostays logo.png')} style={styles.logoImg} resizeMode="contain" />
          </View>
          <Text style={styles.brandName}>HoBo Experience</Text>
        </View>

        {/* Form card — overlaps header */}
        <View style={styles.cardWrap}>
          <View style={styles.formCard}>
            {/* Role badge */}
            <View style={styles.roleBadgeWrap}>
              <View style={styles.roleBadge}>
                <Text style={styles.roleBadgeText}>{roleLabel.toUpperCase()}</Text>
              </View>
            </View>

            <Text style={styles.cardTitle}>Welcome back</Text>
            <Text style={styles.cardSubtitle}>Sign in to your account</Text>

            {/* Employee ID */}
            <Text style={styles.fieldLabel}>Employee ID</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="card-outline" size={20} color={COLORS.OUTLINE} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Enter ID"
                placeholderTextColor="rgba(115,118,133,0.5)"
                value={employeeId}
                onChangeText={setEmployeeId}
                autoCapitalize="none"
              />
            </View>

            {/* Password */}
            <View style={styles.passwordLabelRow}>
              <Text style={styles.fieldLabel}>Password</Text>
              <TouchableOpacity onPress={handleForgotPassword}>
                <Text style={styles.resetLink}>Reset Password</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.inputWrap}>
              <Ionicons name="lock-closed-outline" size={20} color={COLORS.OUTLINE} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { paddingRight: 48 }]}
                placeholder="••••••••"
                placeholderTextColor="rgba(115,118,133,0.5)"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowPassword((v) => !v)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={COLORS.OUTLINE}
                />
              </TouchableOpacity>
            </View>

            {/* Sign in */}
            <TouchableOpacity
              style={[styles.signInBtn, !isReady && styles.signInBtnDisabled]}
              onPress={handleLogin}
              disabled={!isReady}
              activeOpacity={0.9}
            >
              <Text style={styles.signInText}>SIGN IN</Text>
              <Ionicons name="chevron-forward" size={18} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Switch Role — outside the card */}
          <TouchableOpacity
            style={styles.switchRoleBtn}
            onPress={() => navigation.replace('RoleSelect')}
            activeOpacity={0.7}
          >
            <Ionicons name="swap-horizontal" size={18} color={COLORS.OUTLINE} />
            <Text style={styles.switchRoleText}>Switch Role</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>HOBO EXPERIENCE</Text>
        </View>
      </ScrollView>
      <LoadingOverlay visible={loading} />
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const TEAL    = '#00687A';
const TEAL_BG = '#ADECFF';
const PRIMARY = '#003D9B';
const BG      = '#F9F9FF';
const SURFACE = '#F0F3FF';
const OUTLINE = '#737685';
const ON_SURFACE = '#101C2D';

const styles = StyleSheet.create({
  flex:      { flex: 1, backgroundColor: BG },
  container: { flexGrow: 1, backgroundColor: BG, paddingBottom: 32 },

  // Header — teal banner with floating logo
  header: {
    height: 240,
    backgroundColor: TEAL,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  headerOverlay: {
    position: 'absolute',
    top: -110, left: -40,
    width: '140%', height: '200%',
    backgroundColor: '#003C46',
    opacity: 0.12,
    transform: [{ rotate: '12deg' }],
  },
  logoBadge: {
    width: 80,
    height: 80,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  logoImg: { width: 64, height: 64 },
  brandName: {
    marginTop: 10,
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },

  // Card overlapping the header
  cardWrap: {
    paddingHorizontal: 20,
    marginTop: -48,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 28,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 4,
    shadowColor: '#0052CC',
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
  },

  // Role badge
  roleBadgeWrap: { alignItems: 'center', marginBottom: 24 },
  roleBadge: {
    backgroundColor: TEAL_BG,
    borderRadius: 50,
    paddingHorizontal: 16,
    paddingVertical: 5,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#005B6B',
    letterSpacing: 1.5,
  },

  // Headings
  cardTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: ON_SURFACE,
    textAlign: 'center',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  cardSubtitle: {
    fontSize: 14,
    color: OUTLINE,
    textAlign: 'center',
    marginBottom: 24,
  },

  // Field
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#434654',
    marginBottom: 8,
    marginLeft: 4,
    letterSpacing: 0.4,
  },
  passwordLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  resetLink: {
    fontSize: 12,
    fontWeight: '600',
    color: PRIMARY,
  },

  inputWrap: {
    position: 'relative',
    justifyContent: 'center',
    marginBottom: 4,
  },
  inputIcon: {
    position: 'absolute',
    left: 16,
    zIndex: 1,
  },
  input: {
    backgroundColor: SURFACE,
    borderRadius: 10,
    paddingVertical: 16,
    paddingLeft: 48,
    paddingRight: 16,
    fontSize: 15,
    color: ON_SURFACE,
  },
  eyeBtn: {
    position: 'absolute',
    right: 14,
    padding: 4,
  },

  // Sign In button
  signInBtn: {
    marginTop: 24,
    backgroundColor: PRIMARY,
    borderRadius: 10,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    elevation: 4,
    shadowColor: PRIMARY,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  signInBtnDisabled: {
    backgroundColor: '#C3C6D6',
    elevation: 0,
    shadowOpacity: 0,
  },
  signInText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1.2,
  },

  // Switch role
  switchRoleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    gap: 8,
    marginTop: 32,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 10,
  },
  switchRoleText: {
    fontSize: 14,
    fontWeight: '600',
    color: OUTLINE,
    letterSpacing: 0.4,
  },

  // Footer
  footer: {
    paddingVertical: 24,
    alignItems: 'center',
    opacity: 0.4,
  },
  footerText: {
    fontSize: 11,
    color: OUTLINE,
    letterSpacing: 2,
    fontWeight: '500',
  },
});
