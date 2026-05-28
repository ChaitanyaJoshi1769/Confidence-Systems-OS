import axios, { AxiosInstance, AxiosError } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { AuthStore } from '../store/auth';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

class APIServiceClass {
  private instance: AxiosInstance;
  private authToken: string | null = null;

  constructor() {
    this.instance = axios.create({
      baseURL: API_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Response interceptor for token refresh
    this.instance.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && originalRequest) {
          try {
            const { refreshAuthToken } = AuthStore.getState();
            await refreshAuthToken();

            // Retry original request
            return this.instance(originalRequest);
          } catch (refreshError) {
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      },
    );
  }

  setAuthToken(token: string) {
    this.authToken = token;
    this.instance.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  clearAuthToken() {
    this.authToken = null;
    delete this.instance.defaults.headers.common['Authorization'];
  }

  async get<T>(url: string, config = {}) {
    return this.instance.get<T>(url, config);
  }

  async post<T>(url: string, data?: any, config = {}) {
    return this.instance.post<T>(url, data, config);
  }

  async put<T>(url: string, data?: any, config = {}) {
    return this.instance.put<T>(url, data, config);
  }

  async delete<T>(url: string, config = {}) {
    return this.instance.delete<T>(url, config);
  }

  async uploadFile<T>(
    url: string,
    file: {
      uri: string;
      name: string;
      type: string;
    },
    additionalData?: Record<string, any>,
  ) {
    const formData = new FormData();
    formData.append('file', {
      uri: file.uri,
      name: file.name,
      type: file.type,
    } as any);

    if (additionalData) {
      Object.entries(additionalData).forEach(([key, value]) => {
        formData.append(key, value);
      });
    }

    return this.instance.post<T>(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  }
}

export const APIService = new APIServiceClass();
