import {useCallback, useEffect, useMemo, useRef, useState} from 'react';

import {formatErrorDetails} from '../../../services/api';
import type {ApiEnvelope} from '../../../types/api';
import type {ArcadiaRecord} from '../../../types/domain';
import type {EscalatedTicket, EscalationScope} from '../types';
import {normalizeEscalations} from '../utils';

type RequestFn = <T>(
  path: string,
  options?: RequestInit,
) => Promise<ApiEnvelope<T>>;

export function useEscalations({
  hotelId,
  initialRows,
  request,
  scope,
}: {
  hotelId: string;
  initialRows: ArcadiaRecord[];
  request: RequestFn;
  scope: EscalationScope;
}) {
  const fallbackRows = useMemo(() => normalizeEscalations(initialRows), [initialRows]);
  const [rows, setRows] = useState<EscalatedTicket[]>(fallbackRows);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!hotelId) {
      return;
    }

    if (!mountedRef.current) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const payload = await request<ArcadiaRecord[]>(
        `/api/v1/hotels/${hotelId}/tickets/escalations?scope=${encodeURIComponent(scope)}&limit=50`,
      );
      if (mountedRef.current) {
        setRows(normalizeEscalations(Array.isArray(payload.data) ? payload.data : []));
      }
    } catch (nextError) {
      if (mountedRef.current) {
        setError(formatErrorDetails(nextError, 'Unable to load escalations.'));
        setRows(current => (current.length ? current : fallbackRows));
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [fallbackRows, hotelId, request, scope]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!active) {
        return;
      }
      await refresh();
    };

    load();
    const interval = setInterval(load, 15000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [refresh]);

  return {
    error,
    loading,
    refresh,
    rows,
  };
}
