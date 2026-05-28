const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export const apiClient = {
  async fetch(endpoint: string, options: RequestInit = {}) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok && response.status === 401) {
      localStorage.removeItem('accessToken');
      window.location.href = '/auth/login';
    }

    return response;
  },

  async get(endpoint: string) {
    return this.fetch(endpoint);
  },

  async post(endpoint: string, data: any) {
    return this.fetch(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async put(endpoint: string, data: any) {
    return this.fetch(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async delete(endpoint: string) {
    return this.fetch(endpoint, { method: 'DELETE' });
  },
};
