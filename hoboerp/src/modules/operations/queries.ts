import type {ApiEnvelope} from '../../types/api';
import type {ArcadiaRecord} from '../../types/domain';
import {resourcePaths} from './constants';
import type {ResourceKey} from './types';

type RequestFn = <T>(
  path: string,
  options?: RequestInit,
  token?: string,
) => Promise<ApiEnvelope<T>>;

export type OperationsResourcePayload = {
  items: ArcadiaRecord[];
  total: number;
};

export const operationsQueryKeys = {
  all: ['operations'] as const,
  hotel: (hotelId: string) => [...operationsQueryKeys.all, hotelId] as const,
  resource: (hotelId: string, resource: ResourceKey) =>
    [...operationsQueryKeys.hotel(hotelId), resource] as const,
};

export async function fetchOperationsResource(
  resource: ResourceKey,
  request: RequestFn,
  token: string,
  hotelId: string,
): Promise<OperationsResourcePayload> {
  const payload = await request<ArcadiaRecord[]>(
    resourcePaths[resource](hotelId),
    {},
    token,
  );
  const items = Array.isArray(payload.data) ? payload.data : [];

  return {
    items,
    total: payload.meta?.total ?? items.length,
  };
}
