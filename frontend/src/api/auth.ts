import { apiClient } from './client';
import type {
  LoginRequest,
  MeResponse,
  MessageResponse,
  RegisterRequest,
  TokenResponse,
  UserOut,
} from '../types';

export const authApi = {
  login: async (data: LoginRequest): Promise<TokenResponse> => {
    const res = await apiClient.post<TokenResponse>('/auth/login', data);
    return res.data;
  },

  register: async (data: RegisterRequest): Promise<UserOut> => {
    const res = await apiClient.post<UserOut>('/auth/register', data);
    return res.data;
  },

  getMe: async (): Promise<MeResponse> => {
    const res = await apiClient.get<MeResponse>('/auth/me');
    return res.data;
  },

  logout: async (): Promise<MessageResponse> => {
    const res = await apiClient.post<MessageResponse>('/auth/logout');
    return res.data;
  },
};
