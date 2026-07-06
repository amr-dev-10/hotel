import type {ApiEnvelope} from '../../../../types/api';

export type RequestFn = <T>(
  path: string,
  options?: RequestInit,
) => Promise<ApiEnvelope<T>>;
