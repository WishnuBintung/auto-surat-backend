import axios from 'axios';
import type { AxiosError, InternalAxiosRequestConfig } from 'axios';

// Architectural Note:
// Centralized Axios instance with Bearer token injection and global error interceptor.
// In production or cross-origin setups, VITE_API_BASE_URL can point to the backend domain.
// In development, empty string defaults to Vite's reverse-proxy to avoid CORS issues.

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('access_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response && error.response.status === 401) {
      // Architectural Note:
      // When the token is invalid or expired, automatically clear local credentials
      // and redirect to the login page without crashing application state.
      const currentPath = window.location.pathname;
      if (!currentPath.includes('/login') && !currentPath.includes('/verify')) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user_info');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
