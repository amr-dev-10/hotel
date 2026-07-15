import {create} from 'zustand';

import type {ScreenKey} from '../navigation/types';

type UiState = {
  activeScreen: ScreenKey;
  drawerOpen: boolean;
  screenStack: ScreenKey[];
  closeDrawer: () => void;
  openDrawer: () => void;
  popScreen: () => void;
  pushScreen: (screen: ScreenKey) => void;
  resetNavigation: () => void;
  setActiveScreen: (screen: ScreenKey) => void;
};

export const useUiStore = create<UiState>(set => ({
  activeScreen: 'dashboard',
  drawerOpen: false,
  screenStack: [],
  closeDrawer: () => set({drawerOpen: false}),
  openDrawer: () => set({drawerOpen: true}),
  popScreen: () =>
    set(state => ({
      activeScreen: state.screenStack[state.screenStack.length - 1] ?? 'dashboard',
      screenStack: state.screenStack.slice(0, -1),
    })),
  pushScreen: screen =>
    set(state => ({
      activeScreen: screen,
      screenStack: [...state.screenStack, state.activeScreen],
    })),
  resetNavigation: () =>
    set({
      activeScreen: 'dashboard',
      drawerOpen: false,
      screenStack: [],
    }),
  setActiveScreen: activeScreen => set({activeScreen, drawerOpen: false}),
}));
