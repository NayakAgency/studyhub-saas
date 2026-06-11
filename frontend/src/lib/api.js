// ============================================================
// Axios API Client
// Auto-injects auth token, handles refresh, tenant context
// ============================================================

import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

// Request interceptor — inject auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor — handle token expiry + tenant errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status === 401 &&
      error.response?.data?.error === 'TOKEN_EXPIRED' &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true;
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) throw new Error('No refresh token');

        const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);

        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(originalRequest);
      } catch {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('studyhub-auth');
        const path = window.location.pathname;
        if (path.startsWith('/super-admin')) window.location.href = '/super-admin/login';
        else if (path.startsWith('/admin')) window.location.href = '/admin/login';
        return Promise.reject(error);
      }
    }

    if (
      error.response?.status === 403 &&
      ['TENANT_SUSPENDED', 'TRIAL_EXPIRED'].includes(error.response?.data?.error)
    ) {
      window.dispatchEvent(new CustomEvent('tenant:restricted', { detail: error.response.data }));
      return Promise.reject(error);
    }

    return Promise.reject(error);
  }
);

export const getErrorMessage = (error) => {
  if (error?.response?.data?.message) return error.response.data.message;
  if (error?.response?.data?.error) return error.response.data.error;
  if (error?.message) return error.message;
  return 'Something went wrong. Please try again.';
};
