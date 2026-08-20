import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import * as Font from 'expo-font';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from './src/navigation/RootNavigator';
import { navigationRef } from './src/navigation/navigationRef';
import { MessageBanner } from './src/components/common/MessageBanner';
import { requestLocationPermissionOnLaunch } from './src/services/locationPermission';
import { setupNotificationHandlers } from './src/services/notifications';
import { configureTaskAlertAudio } from './src/services/taskAlert';

export default function App() {
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    Font.loadAsync({
      Ionicons: require('./assets/fonts/Ionicons.ttf'),
      MaterialIcons: require('./assets/fonts/MaterialIcons.ttf'),
      MaterialCommunityIcons: require('./assets/fonts/MaterialCommunityIcons.ttf'),
      FontAwesome: require('./assets/fonts/FontAwesome.ttf'),
    }).finally(() => setFontsLoaded(true));

    void configureTaskAlertAudio();
    void requestLocationPermissionOnLaunch();
    const teardown = setupNotificationHandlers();
    return teardown;
  }, []);

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#003D9B' }}>
        <Text style={{ color: '#fff' }}>Loading…</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer ref={navigationRef}>
        <RootNavigator />
        <MessageBanner />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
