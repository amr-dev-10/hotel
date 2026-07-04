import {create} from 'zustand';

import {
  initialResources,
} from '../modules/operations/constants';
import type {
  ResourceKey,
  ResourceState,
} from '../modules/operations/types';

type OperationsState = {
  resources: Record<ResourceKey, ResourceState>;
  resetResources: () => void;
  setResource: (resource: ResourceKey, state: ResourceState) => void;
};

export const useOperationsStore = create<OperationsState>(set => ({
  resources: initialResources,
  resetResources: () => set({resources: initialResources}),
  setResource: (resource, state) =>
    set(current => ({
      resources: {
        ...current.resources,
        [resource]: state,
      },
    })),
}));
