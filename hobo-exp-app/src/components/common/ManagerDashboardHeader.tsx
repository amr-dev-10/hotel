import React, { useCallback } from 'react';
import { View, Text, StyleSheet, StatusBar, TouchableOpacity, Image } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { UserAvatar } from './UserAvatar';
import { PAGE_BG, BORDER_COLOR } from '../../constants/colors';

const PRIMARY = '#003D9B';

interface Props {
  name?: string | null;
  profilePicUrl?: string | null;
  onAvatarPress: () => void;
}

export function ManagerDashboardHeader({ name, profilePicUrl, onAvatarPress }: Props) {
  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle('dark-content');
      StatusBar.setBackgroundColor(PAGE_BG);
    }, [])
  );

  return (
    <View style={styles.topBar}>
      <View style={styles.topBarLeft}>
        <Image source={require('../../../assets/Hobostays logo.png')} style={styles.logo} resizeMode="contain" />
        <Text style={styles.brandText}>HoBo Experience</Text>
      </View>
      <TouchableOpacity onPress={onAvatarPress} activeOpacity={0.85}>
        <View style={styles.avatarWrap}>
          <UserAvatar profileImage={profilePicUrl} name={name} size={36} />
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  topBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  logo: { width: 36, height: 36, borderRadius: 8 },
  brandText: { fontSize: 18, fontWeight: '700', color: PRIMARY, letterSpacing: -0.2 },
  avatarWrap: {
    width: 40, height: 40, borderRadius: 20,
    borderWidth: 2, borderColor: 'rgba(0,82,204,0.15)',
    overflow: 'hidden',
    justifyContent: 'center', alignItems: 'center',
  },
});
