import React, { useCallback } from 'react';
import { Text, StyleSheet, View, StatusBar } from 'react-native';
import { SCREEN_HEADER_BG } from '../../constants/colors';
import { useFocusEffect } from '@react-navigation/native';

interface Props {
  title: string;
  topInset?: number;
}

export function ScreenHeader({ title, topInset = 0 }: Props) {
  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle('light-content');
      StatusBar.setBackgroundColor(SCREEN_HEADER_BG);
    }, [])
  );

  return (
    <View style={[styles.container, { paddingTop: topInset + 12 }]}>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: SCREEN_HEADER_BG,
    paddingHorizontal: 16,
    paddingBottom: 12,
    marginBottom: 12,
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    color: '#FFFFFF',
  },
});
