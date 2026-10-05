import { apiClient } from './client';
import type {
  MaintenanceCreate,
  MaintenanceOut,
  MaintenanceUpdate,
  PageResponse,
  RestrictionCreate,
  RestrictionOut,
} from '../types';

export interface MaintenanceFilterParams {
  page?: number;
  page_size?: number;
  room_id?: number;
  status?: string;
}

export const maintenanceApi = {
  createMaintenance: async (
    data: MaintenanceCreate
  ): Promise<MaintenanceOut> => {
    const res = await apiClient.post<MaintenanceOut>('/maintenance', data);
    return res.data;
  },

  getMaintenanceList: async (
    params?: MaintenanceFilterParams
  ): Promise<PageResponse<MaintenanceOut>> => {
    const res = await apiClient.get<PageResponse<MaintenanceOut>>(
      '/maintenance',
      { params }
    );
    return res.data;
  },

  updateMaintenance: async (
    id: number,
    data: MaintenanceUpdate
  ): Promise<MaintenanceOut> => {
    const res = await apiClient.put<MaintenanceOut>(`/maintenance/${id}`, data);
    return res.data;
  },

  cancelMaintenance: async (id: number): Promise<void> => {
    await apiClient.delete(`/maintenance/${id}`);
  },

  // Restrictions
  createRestriction: async (
    data: RestrictionCreate
  ): Promise<RestrictionOut> => {
    const res = await apiClient.post<RestrictionOut>('/restrictions', data);
    return res.data;
  },

  getRestrictionsList: async (
    params?: MaintenanceFilterParams
  ): Promise<PageResponse<RestrictionOut>> => {
    const res = await apiClient.get<PageResponse<RestrictionOut>>(
      '/restrictions',
      { params }
    );
    return res.data;
  },

  liftRestriction: async (id: number): Promise<void> => {
    await apiClient.delete(`/restrictions/${id}`);
  },
};
