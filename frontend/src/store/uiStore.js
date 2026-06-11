// ============================================================
// UI Store (Zustand)
// Manages sidebar state, modals, etc.
// ============================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useUIStore = create(
  persist(
    (set, get) => ({
      sidebarOpen: true,
      sidebarCollapsed: false,

      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      toggleCollapsed: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),

      // Tenant restriction state
      tenantRestriction: null,
      setTenantRestriction: (restriction) => set({ tenantRestriction: restriction }),
      clearTenantRestriction: () => set({ tenantRestriction: null }),
    }),
    {
      name: 'studyhub-ui',
      partialize: (state) => ({ sidebarCollapsed: state.sidebarCollapsed }),
    }
  )
);

export default useUIStore;
