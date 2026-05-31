import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UiState {
  /** Mobile drawer open/closed */
  sidebarOpen: boolean;
  openSidebar: () => void;
  closeSidebar: () => void;
  toggleSidebar: () => void;
  /** Desktop sidebar collapsed (rail hidden) — persisted */
  desktopCollapsed: boolean;
  toggleDesktopCollapsed: () => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarOpen: false,
      openSidebar: () => set({ sidebarOpen: true }),
      closeSidebar: () => set({ sidebarOpen: false }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      desktopCollapsed: false,
      toggleDesktopCollapsed: () =>
        set((state) => ({ desktopCollapsed: !state.desktopCollapsed })),
    }),
    {
      name: 'nova-ui',
      // Only persist the desktop collapse preference.
      partialize: (s) => ({ desktopCollapsed: s.desktopCollapsed }),
    }
  )
);
