import {focusManager, QueryClient} from '@tanstack/react-query';
import {AppState} from 'react-native';

let focusManagerConfigured = false;
let focusManagerCleanup: (() => void) | undefined;
const isTestRuntime = typeof jest !== 'undefined';

export const mobileQueryClient = new QueryClient({
  defaultOptions: {
    mutations: {
      retry: 0,
    },
    queries: {
      gcTime: isTestRuntime ? Infinity : 5 * 60 * 1000,
      refetchOnMount: false,
      refetchOnReconnect: true,
      retry: 1,
      staleTime: 30 * 1000,
    },
  },
});

export function configureQueryFocusManager() {
  if (focusManagerConfigured) {
    return focusManagerCleanup;
  }

  focusManagerConfigured = true;
  focusManager.setEventListener(handleFocus => {
    const subscription = AppState.addEventListener('change', status => {
      handleFocus(status === 'active');
    });

    focusManagerCleanup = () => {
      subscription.remove();
      focusManagerCleanup = undefined;
      focusManagerConfigured = false;
    };

    return focusManagerCleanup;
  });

  return focusManagerCleanup;
}
