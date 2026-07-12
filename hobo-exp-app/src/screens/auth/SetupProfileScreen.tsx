import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { RootStackParamList } from '../../types';
import { useAuthStore } from '../../store/useAuthStore';
import { UsersService } from '../../services/firebase';
import { AVATARS, isAvatarKey } from '../../components/common/UserAvatar';

type Props = NativeStackScreenProps<RootStackParamList, 'SetupProfile'>;

const TEAL  = '#0C9488';
const WHITE = '#FFFFFF';
const DARK  = '#111827';
const SOFT  = '#6B7280';
const BG    = '#F0F4F8';

export function SetupProfileScreen({ navigation }: Props) {
  const { employeeId, name, setProfilePicUrl } = useAuthStore();
  const [selected, setSelected] = useState<string | null>(null);
  const [saving,   setSaving]   = useState(false);

  const initial = name?.[0]?.toUpperCase() ?? '?';

  function renderPreview() {
    if (!selected) {
      return (
        <View style={styles.previewCircle}>
          <Text style={styles.previewInitial}>{initial}</Text>
        </View>
      );
    }
    if (isAvatarKey(selected)) {
      const av = AVATARS.find((a) => a.key === selected)!;
      return (
        <View style={[styles.previewCircle, { backgroundColor: av.bg, overflow: 'hidden' }]}>
          <Image source={{ uri: av.url }} style={styles.previewCircle} />
        </View>
      );
    }
    return <Image source={{ uri: selected }} style={styles.previewCircle} />;
  }

  async function pickFromCamera() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('Permission needed', 'Camera access is required');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!result.canceled && result.assets[0]) {
      setSelected(result.assets[0].uri);
    }
  }

  async function pickFromLibrary() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('Permission needed', 'Photo library access is required');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!result.canceled && result.assets[0]) {
      setSelected(result.assets[0].uri);
    }
  }

  async function handleSave() {
    if (!selected || !employeeId) return;
    setSaving(true);
    try {
      let finalValue = selected;
      if (!isAvatarKey(selected)) {
        finalValue = await UsersService.uploadProfilePicture(employeeId, selected);
      }
      await UsersService.updateUser(employeeId, { ProfileImage: finalValue });
      await setProfilePicUrl(finalValue);
      navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not save profile photo');
    } finally {
      setSaving(false);
    }
  }

  function handleSkip() {
    navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
  }

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        <Text style={styles.heading}>Choose Your Avatar</Text>
        <Text style={styles.sub}>Pick one below or upload your own photo</Text>

        {/* Live preview */}
        <View style={styles.previewWrap}>{renderPreview()}</View>

        {/* Photo upload options */}
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

        <View style={styles.dividerRow}>
          <View style={styles.divLine} />
          <Text style={styles.divLabel}>or pick an avatar</Text>
          <View style={styles.divLine} />
        </View>

        {/* Avatar grid */}
        <View style={styles.grid}>
          {AVATARS.map((av) => {
            const active = selected === av.key;
            return (
              <TouchableOpacity
                key={av.key}
                style={[styles.avatarCell, { backgroundColor: av.bg }, active && styles.avatarCellActive]}
                onPress={() => setSelected(av.key)}
                activeOpacity={0.75}
              >
                <Image source={{ uri: av.url }} style={styles.avatarCellImg} />
                {active && (
                  <View style={styles.checkBadge}>
                    <Text style={styles.checkMark}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Save */}
        <TouchableOpacity
          style={[styles.saveBtn, (!selected || saving) && styles.saveBtnOff]}
          onPress={handleSave}
          disabled={!selected || saving}
          activeOpacity={0.85}
        >
          {saving
            ? <ActivityIndicator color={WHITE} />
            : <Text style={styles.saveBtnText}>Save & Continue</Text>}
        </TouchableOpacity>

        {/* Skip */}
        <TouchableOpacity style={styles.skipBtn} onPress={handleSkip} disabled={saving} activeOpacity={0.7}>
          <Text style={styles.skipText}>Skip for now</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: BG },
  content: { padding: 24, paddingBottom: 48, alignItems: 'center' },

  heading: { fontSize: 22, fontWeight: '800', color: DARK, textAlign: 'center', marginTop: 8 },
  sub:     { fontSize: 14, color: SOFT, textAlign: 'center', marginTop: 6, marginBottom: 24 },

  previewWrap:    { marginBottom: 24 },
  previewCircle:  {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  previewInitial: { fontSize: 40, fontWeight: '700', color: DARK },
  previewEmoji:   { fontSize: 52 },

  photoRow:    { flexDirection: 'row', gap: 12, width: '100%', marginBottom: 24 },
  photoBtn:    {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: WHITE, borderRadius: 12,
    borderWidth: 1.5, borderColor: TEAL, paddingVertical: 12,
  },
  photoBtnIcon: { fontSize: 18 },
  photoBtnText: { fontSize: 14, fontWeight: '700', color: TEAL },

  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, width: '100%', marginBottom: 20 },
  divLine:    { flex: 1, height: 1, backgroundColor: '#E5E7EB' },
  divLabel:   { fontSize: 12, color: SOFT },

  grid: {
    flexDirection: 'row', flexWrap: 'wrap',
    justifyContent: 'center', gap: 14,
    width: '100%', marginBottom: 32,
  },
  avatarCell: {
    width: 72, height: 72, borderRadius: 36,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2.5, borderColor: 'transparent',
    position: 'relative',
    overflow: 'hidden',
  },
  avatarCellImg: { width: 67, height: 67, borderRadius: 33 },
  avatarCellActive: {
    borderColor: TEAL,
    elevation: 4,
    shadowColor: TEAL, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
  },
  avatarEmoji: { fontSize: 34 },
  checkBadge:  {
    position: 'absolute', bottom: 1, right: 1,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: TEAL, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: WHITE,
  },
  checkMark: { color: WHITE, fontSize: 11, fontWeight: '800' },

  saveBtn:    {
    width: '100%', backgroundColor: TEAL,
    borderRadius: 14, paddingVertical: 15,
    alignItems: 'center', marginBottom: 12,
  },
  saveBtnOff:  { backgroundColor: '#D1D5DB' },
  saveBtnText: { color: WHITE, fontWeight: '800', fontSize: 16 },

  skipBtn:  { paddingVertical: 10 },
  skipText: { fontSize: 14, color: SOFT, fontWeight: '600' },
});
