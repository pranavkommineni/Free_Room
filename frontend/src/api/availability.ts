import { apiClient } from './client';
import type {
  AvailabilityResponse,
  BreakResponse,
  RecommendationResponse,
  RoomCheckResponse,
} from '../types';

export interface AvailabilitySearchParams {
  start_datetime: string;
  end_datetime: string;
  floor_id?: number;
  building_id?: number;
  minimum_capacity?: number;
  has_projector?: boolean;
  has_ac?: boolean;
}

export interface BreakSearchParams extends AvailabilitySearchParams {
  student_id?: number;
}

export interface RecommendationParams {
  start_datetime: string;
  end_datetime: string;
  expected_attendance?: number;
  has_projector?: boolean;
  has_ac?: boolean;
  preferred_floor?: number;
  limit?: number;
}

export const availabilityApi = {
  searchAvailable: async (
    params: AvailabilitySearchParams
  ): Promise<AvailabilityResponse> => {
    const res = await apiClient.get<AvailabilityResponse>('/availability', {
      params,
    });
    return res.data;
  },

  searchBreak: async (params: BreakSearchParams): Promise<BreakResponse> => {
    const res = await apiClient.get<BreakResponse>('/availability/break', {
      params,
    });
    return res.data;
  },

  checkRoom: async (
    roomId: number,
    startDatetime: string,
    endDatetime: string
  ): Promise<RoomCheckResponse> => {
    const res = await apiClient.get<RoomCheckResponse>(
      `/availability/rooms/${roomId}`,
      {
        params: {
          start_datetime: startDatetime,
          end_datetime: endDatetime,
        },
      }
    );
    return res.data;
  },

  getRecommendations: async (
    params: RecommendationParams
  ): Promise<RecommendationResponse> => {
    const res = await apiClient.get<RecommendationResponse>(
      '/availability/recommendations',
      { params }
    );
    return res.data;
  },
};
