import {QueryClientProvider} from '@tanstack/react-query';
import React, {useEffect} from 'react';

import {configureDevelopmentDiagnostics} from '../services/debug';
import {configureQueryFocusManager, mobileQueryClient} from './queryClient';

type AppProvidersProps = {
  children: React.ReactNode;
};

export function AppProviders({children}: AppProvidersProps) {
  useEffect(() => {
    const unsubscribeFocus = configureQueryFocusManager();
    const unsubscribeDiagnostics =
      configureDevelopmentDiagnostics(mobileQueryClient);

    return () => {
      unsubscribeDiagnostics?.();
      unsubscribeFocus?.();
    };
  }, []);

  return (
    <QueryClientProvider client={mobileQueryClient}>
      {children}
    </QueryClientProvider>
  );
}
