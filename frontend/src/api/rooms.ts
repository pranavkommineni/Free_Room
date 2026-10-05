import { apiClient } from './client';
import type {
  BuildingOut,
  PageResponse,
  RoomCreate,
  RoomOut,
  RoomUpdate,
} from '../types';

export interface RoomFilterParams {
  page?: number;
  page_size?: number;
  building_id?: number;
  floor_id?: number;
  status?: string;
  minimum_capacity?: number;
  has_projector?: boolean;
  has_ac?: boolean;
}

export const roomsApi = {
  getBuildings: async (): Promise<BuildingOut[]> => {
    const res = await apiClient.get<BuildingOut[]>('/buildings');
    return res.data;
  },

  getRooms: async (params?: RoomFilterParams): Promise<PageResponse<RoomOut>> => {
    const res = await apiClient.get<PageResponse<RoomOut>>('/rooms', { params });
    return res.data;
  },

  getRoom: async (roomId: number): Promise<RoomOut> => {
    const res = await apiClient.get<RoomOut>(`/rooms/${roomId}`);
    return res.data;
  },

  createRoom: async (data: RoomCreate): Promise<RoomOut> => {
    const res = await apiClient.post<RoomOut>('/rooms', data);
    return res.data;
  },

  updateRoom: async (roomId: number, data: RoomUpdate): Promise<RoomOut> => {
    const res = await apiClient.put<RoomOut>(`/rooms/${roomId}`, data);
    return res.data;
  },

  deleteRoom: async (roomId: number): Promise<void> => {
    await apiClient.delete(`/rooms/${roomId}`);
  },
};
