import React, { createContext, useContext, useEffect, useState } from 'react';
import { authApi } from '../api/auth';
import type { LoginRequest, MeResponse, RegisterRequest } from '../types';

interface AuthContextType {
  user: MeResponse | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (data: LoginRequest) => Promise<MeResponse>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem('freeroom_token')
  );
  const [user, setUser] = useState<MeResponse | null>(() => {
    const saved = localStorage.getItem('freeroom_user');
    if (!saved) return null;
    try {
      return JSON.parse(saved);
    } catch {
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchProfile = async () => {
    try {
      const profile = await authApi.getMe();
      setUser(profile);
      localStorage.setItem('freeroom_user', JSON.stringify(profile));
    } catch (err) {
      console.error('Failed to restore session:', err);
      setToken(null);
      setUser(null);
      localStorage.removeItem('freeroom_token');
      localStorage.removeItem('freeroom_user');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchProfile();
    } else {
      setIsLoading(false);
    }

    const handleUnauthorized = () => {
      setToken(null);
      setUser(null);
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () =>
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, [token]);

  const login = async (data: LoginRequest): Promise<MeResponse> => {
    const tokenRes = await authApi.login(data);
    localStorage.setItem('freeroom_token', tokenRes.access_token);
    setToken(tokenRes.access_token);

    // Fetch user details immediately
    const profile = await authApi.getMe();
    setUser(profile);
    localStorage.setItem('freeroom_user', JSON.stringify(profile));
    return profile;
  };

  const register = async (data: RegisterRequest): Promise<void> => {
    await authApi.register(data);
  };

  const logout = async (): Promise<void> => {
    try {
      await authApi.logout();
    } catch (err) {
      console.warn('Logout API error:', err);
    } finally {
      localStorage.removeItem('freeroom_token');
      localStorage.removeItem('freeroom_user');
      setToken(null);
      setUser(null);
    }
  };

  const refreshProfile = async (): Promise<void> => {
    if (!token) return;
    try {
      const profile = await authApi.getMe();
      setUser(profile);
      localStorage.setItem('freeroom_user', JSON.stringify(profile));
    } catch (err) {
      console.error('Refresh profile error:', err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        login,
        register,
        logout,
        refreshProfile,
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
