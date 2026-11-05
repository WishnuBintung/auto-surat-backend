import api from './api';
import type { AuthResponse, User } from '../types';

// Architectural Note:
// Encapsulates authentication interactions and JWT token lifecycle management.
// Tokens and user profile are safely mirrored in localStorage for session persistence across refreshes.

export const authService = {
  async login(nip_nim: string, password: string): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/accounts/login/', {
      nip_nim,
      password,
    });
    const data = response.data;
    if (data.access) {
      localStorage.setItem('access_token', data.access);
      localStorage.setItem('refresh_token', data.refresh);
      localStorage.setItem('user_info', JSON.stringify(data.user));
    }
    return data;
  },

  async logout(): Promise<void> {
    const refreshToken = localStorage.getItem('refresh_token');
    try {
      if (refreshToken) {
        await api.post('/accounts/logout/', { refresh: refreshToken });
      }
    } catch {
      // Proceed with local cleanup even if the backend token blacklist call fails
    } finally {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user_info');
    }
  },

  async getMe(): Promise<User> {
    const response = await api.get<User>('/accounts/me/');
    localStorage.setItem('user_info', JSON.stringify(response.data));
    return response.data;
  },

  getToken(): string | null {
    return localStorage.getItem('access_token');
  },

  getRefreshToken(): string | null {
    return localStorage.getItem('refresh_token');
  },

  getCurrentUser(): User | null {
    const raw = localStorage.getItem('user_info');
    if (!raw) return null;
    try {
      return JSON.parse(raw) as User;
    } catch {
      return null;
    }
  },
};

export default authService;
