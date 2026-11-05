import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { User } from '../types';
import authService from '../services/authService';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (nip_nim: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Architectural Note:
  // Initialize authentication state from persistent storage, then asynchronously
  // verify with the /accounts/me/ endpoint to ensure the token remains valid.
  useEffect(() => {
    const initializeAuth = async () => {
      const token = authService.getToken();
      const cachedUser = authService.getCurrentUser();

      if (token && cachedUser) {
        setUser(cachedUser);
        try {
          const freshUser = await authService.getMe();
          setUser(freshUser);
        } catch {
          setUser(null);
        }
      }
      setIsLoading(false);
    };

    initializeAuth();
  }, []);

  const login = async (nip_nim: string, pass: string) => {
    setIsLoading(true);
    try {
      const response = await authService.login(nip_nim, pass);
      setUser(response.user);
      try {
        const fullUser = await authService.getMe();
        setUser(fullUser);
      } catch {
        // Fallback to basic user
      }
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await authService.logout();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshUser = async () => {
    try {
      const updatedUser = await authService.getMe();
      setUser(updatedUser);
    } catch {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
