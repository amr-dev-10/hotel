import React, { useEffect } from 'react';
import { View, Text, StyleSheet, StatusBar } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RootStackParamList } from '../../types';
import { useAuthStore } from '../../store/useAuthStore';
import { COLORS } from '../../utils/constants';

type Props = NativeStackScreenProps<RootStackParamList, 'Splash'>;

export function SplashScreen({ navigation }: Props) {
  const { init, isLoggedIn, isLoading, hotelId } = useAuthStore();

  useEffect(() => {
    init();
  }, []);

  useEffect(() => {
    if (!isLoading) {
      const hasHotel = !!hotelId;
      const timer = setTimeout(() => {
        if (isLoggedIn && hasHotel) {
          navigation.replace('Main');
        } else {
          navigation.replace('RoleSelect');
        }
      }, isLoggedIn && hasHotel ? 1000 : 1600);
      return () => clearTimeout(timer);
    }
  }, [isLoading, isLoggedIn, hotelId]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <View style={styles.logoContainer}>
        <View style={styles.logoMark}>
          <Text style={styles.logoLetter}>H</Text>
        </View>
        <Text style={styles.logoText}>HOBO Experience</Text>
        <Text style={styles.tagline}>Hotel Management System</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.PRIMARY,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  logoMark: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  logoLetter: {
    fontSize: 40,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -1,
  },
  logoText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 1,
    textAlign: 'center',
  },
  tagline: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 8,
    letterSpacing: 2,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
});
