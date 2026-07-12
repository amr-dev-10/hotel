import React, { useCallback } from 'react';
import { View, Text, StyleSheet, Switch, StatusBar, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { UserAvatar } from './UserAvatar';
import { PAGE_BG, CARD_BG, ACTIVE_BLUE, TEXT_PRIMARY, TEXT_MUTED, BORDER_COLOR } from '../../constants/colors';

interface Props {
  hotelName?: string | null;
  name?: string | null;
  profilePicUrl?: string | null;
  status?: boolean;
  onToggleStatus: (val: boolean) => void;
  onAvatarPress: () => void;
}

export function AttendantDashboardHeader({ hotelName, name, profilePicUrl, status, onToggleStatus, onAvatarPress }: Props) {
  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle('dark-content');
      StatusBar.setBackgroundColor(PAGE_BG);
    }, [])
  );

  return (
    <View style={styles.header}>
      <TouchableOpacity style={styles.headerLeft} onPress={onAvatarPress} activeOpacity={0.8}>
        <UserAvatar profileImage={profilePicUrl} name={name} size={44} />
        <View style={styles.headerText}>
          <Text style={styles.hotelText}>{hotelName ?? 'Hotel'}</Text>
          <Text style={styles.nameText}>{name ?? 'Attendant'}</Text>
        </View>
      </TouchableOpacity>

      <View style={styles.statusWrap}>
        <Text style={[styles.statusLabel, { color: status ? ACTIVE_BLUE : TEXT_MUTED }]}>
          {status ? 'ACTIVE' : 'INACTIVE'}
        </Text>
        <Switch
          value={status}
          onValueChange={onToggleStatus}
          trackColor={{ false: '#D1D5DB', true: ACTIVE_BLUE }}
          thumbColor={CARD_BG}
          ios_backgroundColor='#D1D5DB'
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: CARD_BG,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  headerText: { flex: 1 },
  hotelText: { fontSize: 15, fontWeight: '800', color: TEXT_PRIMARY, letterSpacing: 0.1 },
  nameText: { fontSize: 12, color: TEXT_MUTED, fontWeight: '500', marginTop: 1 },
  statusWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
});
