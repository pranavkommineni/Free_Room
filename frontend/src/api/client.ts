import axios from 'axios';
import { API_BASE_URL } from '../constants';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  paramsSerializer: (params) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.append(key, String(value));
      }
    });
    return searchParams.toString();
  },
});

// Interceptor to inject JWT token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('freeroom_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor to handle 401 Unauthorized / Token Expiration
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const isAuthEndpoint =
        error.config?.url?.includes('/auth/login') ||
        error.config?.url?.includes('/auth/register');
      if (!isAuthEndpoint) {
        localStorage.removeItem('freeroom_token');
        localStorage.removeItem('freeroom_user');
        window.dispatchEvent(new Event('auth:unauthorized'));
      }
    }
    return Promise.reject(error);
  }
);
