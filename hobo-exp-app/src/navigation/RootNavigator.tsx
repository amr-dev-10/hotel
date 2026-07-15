import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { COLORS } from '../utils/constants';

import { SplashScreen } from '../screens/auth/SplashScreen';
import { RoleSelectScreen } from '../screens/auth/RoleSelectScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { SetupProfileScreen } from '../screens/auth/SetupProfileScreen';
import { MainTabNavigator } from './MainTabNavigator';
import { TaskDetailsScreen } from '../screens/shared/TaskDetailsScreen';
import { TaskUpdateScreen } from '../screens/shared/TaskUpdateScreen';
import { CreateTaskScreen } from '../screens/shared/CreateTaskScreen';
import { ChatRoomScreen } from '../screens/shared/ChatRoomScreen';
import { ImageViewerScreen } from '../screens/shared/ImageViewerScreen';
import { ProfileScreen } from '../screens/shared/ProfileScreen';
import { BlockedRoomsScreen } from '../screens/shared/BlockedRoomsScreen';
import { withScreenLoader } from '../components/common/ScreenLoaderWrapper';

const Stack = createNativeStackNavigator<RootStackParamList>();

const SplashWithLoader = withScreenLoader(SplashScreen);
const RoleSelectWithLoader = withScreenLoader(RoleSelectScreen);
const LoginWithLoader = withScreenLoader(LoginScreen);
const MainWithLoader = withScreenLoader(MainTabNavigator);
const ProfileWithLoader = withScreenLoader(ProfileScreen);
const TaskDetailsWithLoader = withScreenLoader(TaskDetailsScreen);
const TaskUpdateWithLoader = withScreenLoader(TaskUpdateScreen);
const CreateTaskWithLoader = withScreenLoader(CreateTaskScreen);
const ChatRoomWithLoader = withScreenLoader(ChatRoomScreen);
const ImageViewerWithLoader = withScreenLoader(ImageViewerScreen);
const BlockedRoomsWithLoader = withScreenLoader(BlockedRoomsScreen);

export function RootNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.PRIMARY },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="Splash" component={SplashWithLoader} options={{ headerShown: false }} />
      <Stack.Screen name="RoleSelect" component={RoleSelectWithLoader} options={{ headerShown: false }} />
      <Stack.Screen name="Login" component={LoginWithLoader} options={{ headerShown: false }} />
      <Stack.Screen name="SetupProfile" component={SetupProfileScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Main" component={MainWithLoader} options={{ headerShown: false }} />
      <Stack.Screen
        name="Profile"
        component={ProfileWithLoader}
        options={{
          title: 'Profile',
          headerStyle: { backgroundColor: '#fff' },
          headerTintColor: '#111',
          headerTitleStyle: { color: '#111', fontWeight: '700' },
        }}
      />
      <Stack.Screen name="TaskDetails" component={TaskDetailsWithLoader} options={{ title: 'Task Details' }} />
      <Stack.Screen name="TaskUpdate" component={TaskUpdateWithLoader} options={{ title: 'Update Task' }} />
      <Stack.Screen name="CreateTask" component={CreateTaskWithLoader} options={{ title: 'Create Task' }} />
      <Stack.Screen
        name="ChatRoom"
        component={ChatRoomWithLoader}
        options={{
          title: 'Chat',
          headerStyle: { backgroundColor: '#FFFFFF' },
          headerTintColor: '#111827',
          headerTitleStyle: { color: '#111827', fontWeight: '700' },
          headerShadowVisible: false,
        }}
      />
      <Stack.Screen name="ImageViewer" component={ImageViewerWithLoader} options={{ headerShown: false }} />
      <Stack.Screen name="BlockedRooms" component={BlockedRoomsWithLoader} options={{ title: 'Blocked Rooms' }} />
    </Stack.Navigator>
  );
}
