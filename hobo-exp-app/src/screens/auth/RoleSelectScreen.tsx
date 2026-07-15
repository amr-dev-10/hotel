import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../../types';

type Props = NativeStackScreenProps<RootStackParamList, 'RoleSelect'>;

const TEAL          = '#00687A';
const TEAL_DEEP     = '#004E5D';
const TEAL_FIXED    = '#ADECFF';
const PRIMARY       = '#003D9B';
const SURFACE_LOW   = '#F0F3FF';
const OUTLINE       = '#737685';
const OUTLINE_VAR   = '#C3C6D6';
const ON_SURFACE    = '#101C2D';
const ON_SURF_VAR   = '#434654';

export function RoleSelectScreen({ navigation }: Props) {
  const [selected, setSelected] = useState<string | null>(null);

  useFocusEffect(
    React.useCallback(() => {
      setSelected(null);
    }, [])
  );

  function selectRole(role: 'Manager' | 'Attendent' | 'Front_desk') {
    setSelected(role);
    setTimeout(() => {
      navigation.navigate('Login', { userType: role });
    }, 400);
  }

  function handleHelp() {
    Alert.alert('Need Help?', 'Please contact your admin to reset your password or set up your account.');
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Decorative blurred blobs */}
      <View style={[styles.blob, styles.blobTop]} />
      <View style={[styles.blob, styles.blobBottom]} />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.logoBadge}>
            <Ionicons name="ribbon-outline" size={48} color="#FFFFFF" />
          </View>
          <Text style={styles.brandTitle}>HoBo Experience</Text>
          <Text style={styles.brandSubtitle}>HOTEL MANAGEMENT</Text>
        </View>

        {/* Card */}
        <View style={styles.cardWrap}>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>I am a...</Text>
              <Text style={styles.cardSub}>Select your role to continue to the dashboard</Text>
            </View>

            {/* Manager row */}
            <TouchableOpacity
              style={[styles.roleRow, selected === 'Manager' && styles.roleRowActive]}
              onPress={() => selectRole('Manager')}
              activeOpacity={0.85}
            >
              <View style={styles.roleLeft}>
                <View style={[styles.roleIcon, { backgroundColor: 'rgba(0,61,155,0.10)' }]}>
                  <Ionicons name="shield-checkmark" size={22} color={PRIMARY} />
                </View>
                <View>
                  <Text style={styles.roleTitle}>Manager</Text>
                  <Text style={styles.roleDesc}>Full administration access</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={22} color={OUTLINE} />
            </TouchableOpacity>

            {/* Front Desk row */}
            <TouchableOpacity
              style={[styles.roleRow, selected === 'Front_desk' && styles.roleRowActive]}
              onPress={() => selectRole('Front_desk')}
              activeOpacity={0.85}
            >
              <View style={styles.roleLeft}>
                <View style={[styles.roleIcon, { backgroundColor: 'rgba(0,104,122,0.12)' }]}>
                  <Ionicons name="desktop-outline" size={22} color={TEAL} />
                </View>
                <View>
                  <Text style={styles.roleTitle}>Front Desk</Text>
                  <Text style={styles.roleDesc}>Reception & guest services</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={22} color={OUTLINE} />
            </TouchableOpacity>

            {/* Attendant row */}
            <TouchableOpacity
              style={[styles.roleRow, selected === 'Attendent' && styles.roleRowActive]}
              onPress={() => selectRole('Attendent')}
              activeOpacity={0.85}
            >
              <View style={styles.roleLeft}>
                <View style={[styles.roleIcon, { backgroundColor: 'rgba(0,104,122,0.12)' }]}>
                  <Ionicons name="id-card" size={22} color={TEAL} />
                </View>
                <View>
                  <Text style={styles.roleTitle}>Attendant</Text>
                  <Text style={styles.roleDesc}>Service & guest management</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={22} color={OUTLINE} />
            </TouchableOpacity>

            {/* Divider + help link */}
            <View style={styles.divider} />
            <TouchableOpacity onPress={handleHelp} style={styles.helpBtn} activeOpacity={0.7}>
              <Text style={styles.helpText}>Need help signing in?</Text>
              <Ionicons name="information-circle-outline" size={14} color={PRIMARY} />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: TEAL, overflow: 'hidden' },
  safe: { flex: 1 },

  // Decorative background blobs
  blob: {
    position: 'absolute',
    borderRadius: 9999,
    opacity: 0.18,
  },
  blobTop: {
    width: 360, height: 360,
    top: -100, left: -100,
    backgroundColor: '#00D9FE',
  },
  blobBottom: {
    width: 320, height: 320,
    bottom: -80, right: -80,
    backgroundColor: '#0052CC',
  },

  // Hero
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  logoBadge: {
    width: 96, height: 96,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  brandTitle: {
    fontSize: 38,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -1,
    textAlign: 'center',
  },
  brandSubtitle: {
    fontSize: 13,
    color: TEAL_FIXED,
    marginTop: 6,
    letterSpacing: 4,
    fontWeight: '600',
    opacity: 0.85,
  },

  // Card
  cardWrap: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 8 },
  },
  cardHeader: { alignItems: 'center', marginBottom: 20 },
  cardTitle:  { fontSize: 22, fontWeight: '700', color: ON_SURFACE, letterSpacing: -0.3 },
  cardSub:    { fontSize: 13, color: ON_SURF_VAR, marginTop: 4, textAlign: 'center' },

  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: SURFACE_LOW,
    borderWidth: 2,
    borderColor: OUTLINE_VAR,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  roleRowActive: {
    borderColor: PRIMARY,
    backgroundColor: '#F5F8FF',
  },
  roleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  roleIcon: {
    width: 48, height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleTitle: { fontSize: 18, fontWeight: '700', color: ON_SURFACE, letterSpacing: -0.2 },
  roleDesc:  { fontSize: 11, color: ON_SURF_VAR, marginTop: 2, fontWeight: '500' },

  divider: {
    height: 1,
    backgroundColor: 'rgba(195,198,214,0.4)',
    marginTop: 12,
    marginBottom: 14,
  },
  helpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  helpText: {
    fontSize: 13,
    fontWeight: '600',
    color: PRIMARY,
    letterSpacing: 0.2,
  },
});
