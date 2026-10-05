import { apiClient } from './client';
import type {
  AdminUserCreate,
  PageResponse,
  Role,
  UserOut,
  UserUpdate,
} from '../types';

export interface UserFilterParams {
  page?: number;
  page_size?: number;
  role?: Role;
  is_active?: boolean;
}

export const usersApi = {
  getUsers: async (
    params?: UserFilterParams
  ): Promise<PageResponse<UserOut>> => {
    const res = await apiClient.get<PageResponse<UserOut>>('/users', {
      params,
    });
    return res.data;
  },

  createUser: async (data: AdminUserCreate): Promise<UserOut> => {
    const res = await apiClient.post<UserOut>('/users', data);
    return res.data;
  },

  updateUser: async (userId: number, data: UserUpdate): Promise<UserOut> => {
    const res = await apiClient.put<UserOut>(`/users/${userId}`, data);
    return res.data;
  },
};
