// ============================================================
// Auth Store (Zustand)
// Manages authentication state for all roles
// ============================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../lib/api.js';

const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,

      setAuth: (user, accessToken, refreshToken) => {
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', refreshToken);
        set({ user, accessToken, refreshToken, isAuthenticated: true });
      },

      clearAuth: () => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
      },

      loginAdmin: async (email, password) => {
        set({ isLoading: true });
        try {
          const { data } = await api.post('/auth/login-admin', { email, password });
          get().setAuth(data.user, data.accessToken, data.refreshToken);
          return data;
        } finally {
          set({ isLoading: false });
        }
      },

      loginStudent: async (phone, password, tenantSlug) => {
        set({ isLoading: true });
        try {
          const { data } = await api.post('/auth/login-student', { phone, password, tenantSlug });
          get().setAuth(data.user, data.accessToken, data.refreshToken);
          return data;
        } finally {
          set({ isLoading: false });
        }
      },

      logout: async () => {
        try {
          await api.post('/auth/logout');
        } catch {
          // Swallow error — clear locally regardless
        }
        get().clearAuth();
      },

      isRole: (role) => get().user?.role === role,
      isSuperAdmin: () => get().user?.role === 'super_admin',
      isHallAdmin: () => get().user?.role === 'hall_admin',
      isStudent: () => get().user?.role === 'student',
    }),
    {
      name: 'studyhub-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

export default useAuthStore;
