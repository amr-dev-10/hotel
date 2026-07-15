import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { COLORS } from '../../utils/constants';

const MIN_LOADER_MS = 350;

export function withScreenLoader<P extends object>(ScreenComponent: React.ComponentType<P>) {
  return function ScreenWithLoader(props: P) {
    const [showLoader, setShowLoader] = useState(true);

    useEffect(() => {
      const timer = setTimeout(() => setShowLoader(false), MIN_LOADER_MS);
      return () => clearTimeout(timer);
    }, []);

    if (showLoader) {
      return (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={COLORS.PRIMARY} />
        </View>
      );
    }

    return <ScreenComponent {...props} />;
  };
}

const styles = StyleSheet.create({
  loaderContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
