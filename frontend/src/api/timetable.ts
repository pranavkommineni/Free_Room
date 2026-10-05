import { apiClient } from './client';
import type {
  FreePeriodsResponse,
  OccurrenceOut,
  PageResponse,
  PeriodCreate,
  PeriodOut,
  SlotCreate,
  SlotOut,
  SlotUpdate,
} from '../types';

export interface SlotFilterParams {
  page?: number;
  page_size?: number;
  room_id?: number;
  faculty_id?: number;
  section_id?: number;
  day_of_week?: number;
  active_only?: boolean;
}

export const timetableApi = {
  getMyTimetable: async (
    fromDate?: string,
    toDate?: string
  ): Promise<OccurrenceOut[]> => {
    const res = await apiClient.get<OccurrenceOut[]>('/timetable/me', {
      params: { from_date: fromDate, to_date: toDate },
    });
    return res.data;
  },

  getFreePeriods: async (
    dateStr: string,
    studentId?: number
  ): Promise<FreePeriodsResponse> => {
    const res = await apiClient.get<FreePeriodsResponse>(
      '/timetable/free-periods',
      {
        params: { date: dateStr, student_id: studentId },
      }
    );
    return res.data;
  },

  getPeriods: async (): Promise<PeriodOut[]> => {
    const res = await apiClient.get<PeriodOut[]>('/timetable/periods');
    return res.data;
  },

  upsertPeriod: async (data: PeriodCreate): Promise<PeriodOut> => {
    const res = await apiClient.put<PeriodOut>('/timetable/periods', data);
    return res.data;
  },

  getSlots: async (
    params?: SlotFilterParams
  ): Promise<PageResponse<SlotOut>> => {
    const res = await apiClient.get<PageResponse<SlotOut>>('/timetable/slots', {
      params,
    });
    return res.data;
  },

  createSlot: async (data: SlotCreate): Promise<SlotOut> => {
    const res = await apiClient.post<SlotOut>('/timetable/slots', data);
    return res.data;
  },

  updateSlot: async (slotId: number, data: SlotUpdate): Promise<SlotOut> => {
    const res = await apiClient.put<SlotOut>(`/timetable/slots/${slotId}`, data);
    return res.data;
  },

  deleteSlot: async (slotId: number): Promise<void> => {
    await apiClient.delete(`/timetable/slots/${slotId}`);
  },
};
