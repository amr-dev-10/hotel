import type {QueryClient} from '@tanstack/react-query';

import {featureFlags} from '../../config/featureFlags';
import {logger} from '../logger';

type QueryCacheEvent = {
  query?: {
    queryKey: readonly unknown[];
    state: {
      error?: unknown;
      fetchStatus?: string;
      status?: string;
    };
  };
  type: string;
};

let unsubscribeQueryCache: (() => void) | null = null;

export function configureDevelopmentDiagnostics(queryClient: QueryClient) {
  if (!isDevelopment() || !featureFlags.enableQueryDiagnostics) {
    return undefined;
  }

  if (unsubscribeQueryCache) {
    return undefined;
  }

  unsubscribeQueryCache = queryClient.getQueryCache().subscribe(event => {
    const queryEvent = event as QueryCacheEvent;

    if (queryEvent.type !== 'updated' || !queryEvent.query) {
      return;
    }

    const {queryKey, state} = queryEvent.query;
    if (state.status === 'error') {
      logger.error('[query:error]', formatQueryKey(queryKey), state.error);
      return;
    }

    if (state.fetchStatus === 'fetching') {
      logger.debug('[query:fetching]', formatQueryKey(queryKey));
    }
  });

  return () => {
    unsubscribeQueryCache?.();
    unsubscribeQueryCache = null;
  };
}

function isDevelopment() {
  return typeof __DEV__ !== 'undefined' && __DEV__;
}

function formatQueryKey(queryKey: readonly unknown[]) {
  try {
    return JSON.stringify(queryKey);
  } catch {
    return String(queryKey);
  }
}
