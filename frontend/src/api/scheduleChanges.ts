import { apiClient } from './client';
import type {
  CancelOccurrence,
  Decision,
  PageResponse,
  ScheduleChangeCreate,
  ScheduleChangeOut,
} from '../types';

export interface ScheduleChangeFilterParams {
  page?: number;
  page_size?: number;
  status?: string;
  timetable_slot_id?: number;
}

export const scheduleChangesApi = {
  requestChange: async (
    data: ScheduleChangeCreate
  ): Promise<ScheduleChangeOut> => {
    const res = await apiClient.post<ScheduleChangeOut>(
      '/schedule-changes',
      data
    );
    return res.data;
  },

  cancelOccurrence: async (
    data: CancelOccurrence
  ): Promise<ScheduleChangeOut> => {
    const res = await apiClient.post<ScheduleChangeOut>(
      '/schedule-changes/cancel-occurrence',
      data
    );
    return res.data;
  },

  getChanges: async (
    params?: ScheduleChangeFilterParams
  ): Promise<PageResponse<ScheduleChangeOut>> => {
    const res = await apiClient.get<PageResponse<ScheduleChangeOut>>(
      '/schedule-changes',
      { params }
    );
    return res.data;
  },

  getChange: async (changeId: number): Promise<ScheduleChangeOut> => {
    const res = await apiClient.get<ScheduleChangeOut>(
      `/schedule-changes/${changeId}`
    );
    return res.data;
  },

  approveChange: async (
    changeId: number,
    note?: string | null
  ): Promise<ScheduleChangeOut> => {
    const body: Decision | undefined = note ? { note } : undefined;
    const res = await apiClient.put<ScheduleChangeOut>(
      `/schedule-changes/${changeId}/approve`,
      body
    );
    return res.data;
  },

  rejectChange: async (
    changeId: number,
    note?: string | null
  ): Promise<ScheduleChangeOut> => {
    const body: Decision | undefined = note ? { note } : undefined;
    const res = await apiClient.put<ScheduleChangeOut>(
      `/schedule-changes/${changeId}/reject`,
      body
    );
    return res.data;
  },

  withdrawChange: async (changeId: number): Promise<ScheduleChangeOut> => {
    const res = await apiClient.delete<ScheduleChangeOut>(
      `/schedule-changes/${changeId}`
    );
    return res.data;
  },
};
