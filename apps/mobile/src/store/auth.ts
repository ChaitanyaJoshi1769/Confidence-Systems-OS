import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { APIService } from '../services/api.service';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  organizationId: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuthToken: () => Promise<void>;
  initialize: () => Promise<void>;
  setUser: (user: User | null) => void;
}

export const AuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      const response = await APIService.post('/auth/login', {
        email,
        password,
      });

      const { user, accessToken, refreshToken } = response.data;

      // Store tokens securely
      await SecureStore.setItemAsync('accessToken', accessToken);
      await SecureStore.setItemAsync('refreshToken', refreshToken);

      set({
        user,
        accessToken,
        refreshToken,
        isAuthenticated: true,
        isLoading: false,
      });

      // Set API default header
      APIService.setAuthToken(accessToken);
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  logout: async () => {
    try {
      await APIService.post('/auth/logout', {});
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear stored tokens
      await SecureStore.deleteItemAsync('accessToken');
      await SecureStore.deleteItemAsync('refreshToken');

      set({
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
      });

      // Clear API header
      APIService.clearAuthToken();
    }
  },

  refreshAuthToken: async () => {
    try {
      const refreshToken = await SecureStore.getItemAsync('refreshToken');

      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await APIService.post('/auth/refresh', {
        refreshToken,
      });

      const { accessToken } = response.data;

      await SecureStore.setItemAsync('accessToken', accessToken);
      APIService.setAuthToken(accessToken);

      set({ accessToken });
    } catch (error) {
      // Clear auth on refresh failure
      const { logout } = AuthStore.getState();
      await logout();
      throw error;
    }
  },

  initialize: async () => {
    try {
      const accessToken = await SecureStore.getItemAsync('accessToken');

      if (!accessToken) {
        set({ isLoading: false });
        return;
      }

      // Verify token by fetching current user
      APIService.setAuthToken(accessToken);
      const response = await APIService.get('/auth/me');

      const { user } = response.data;

      set({
        user,
        accessToken,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      console.error('Initialization error:', error);
      set({
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },

  setUser: (user) => set({ user }),
}));
