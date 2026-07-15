/**
 * Unified top bar — logo + brand on the left, profile avatar on the right.
 * Used across all bottom-tab screens for visual consistency.
 */
import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types';
import { useAuthStore } from '../../store/useAuthStore';
import { UserAvatar } from './UserAvatar';

const PRIMARY = '#003D9B';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function AppTopBar() {
  const navigation = useNavigation<Nav>();
  const { name, profilePicUrl } = useAuthStore();

  return (
    <View style={styles.bar}>
      <View style={styles.left}>
        <Image
          source={require('../../../assets/Hobostays logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.brand}>HoBo Experience</Text>
      </View>
      <TouchableOpacity onPress={() => navigation.navigate('Profile')} activeOpacity={0.85}>
        <View style={styles.avatarWrap}>
          <UserAvatar profileImage={profilePicUrl} name={name} size={36} />
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  logo: { width: 36, height: 36, borderRadius: 8 },
  brand: { fontSize: 18, fontWeight: '700', color: PRIMARY, letterSpacing: -0.2 },
  avatarWrap: {
    width: 40, height: 40, borderRadius: 20,
    borderWidth: 2, borderColor: 'rgba(0,82,204,0.15)',
    overflow: 'hidden',
    justifyContent: 'center', alignItems: 'center',
  },
});
