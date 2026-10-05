import { apiClient } from './client';
import type {
  AuditLogOut,
  BookingAnalytics,
  BuildingOut,
  CourseCreate,
  CourseOut,
  FloorOut,
  ImportCommitResult,
  ImportPreview,
  PageResponse,
  RoomAnalytics,
  SectionCreate,
  SectionOut,
  UtilizationAnalytics,
} from '../types';

export interface AuditLogParams {
  page?: number;
  page_size?: number;
  entity_type?: string;
  user_id?: number;
  action?: string;
}

export const adminApi = {
  getRoomAnalytics: async (): Promise<RoomAnalytics> => {
    const res = await apiClient.get<RoomAnalytics>('/admin/analytics/rooms');
    return res.data;
  },

  getBookingAnalytics: async (
    startDatetime?: string,
    endDatetime?: string
  ): Promise<BookingAnalytics> => {
    const res = await apiClient.get<BookingAnalytics>(
      '/admin/analytics/bookings',
      {
        params: { start_datetime: startDatetime, end_datetime: endDatetime },
      }
    );
    return res.data;
  },

  getUtilizationAnalytics: async (
    startDatetime?: string,
    endDatetime?: string,
    topN = 5
  ): Promise<UtilizationAnalytics> => {
    const res = await apiClient.get<UtilizationAnalytics>(
      '/admin/analytics/utilization',
      {
        params: {
          start_datetime: startDatetime,
          end_datetime: endDatetime,
          top_n: topN,
        },
      }
    );
    return res.data;
  },

  getAuditLogs: async (
    params?: AuditLogParams
  ): Promise<PageResponse<AuditLogOut>> => {
    const res = await apiClient.get<PageResponse<AuditLogOut>>(
      '/admin/audit-logs',
      { params }
    );
    return res.data;
  },

  importTimetablePreview: async (file: File): Promise<ImportPreview> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiClient.post<ImportPreview>(
      '/admin/timetable/import',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return res.data;
  },

  confirmTimetableImport: async (
    importId: number,
    allowPartial = false
  ): Promise<ImportCommitResult> => {
    const res = await apiClient.post<ImportCommitResult>(
      `/admin/timetable/import/${importId}/confirm`,
      null,
      {
        params: { allow_partial: allowPartial },
      }
    );
    return res.data;
  },

  getCourses: async (
    page = 1,
    pageSize = 50
  ): Promise<PageResponse<CourseOut>> => {
    const res = await apiClient.get<PageResponse<CourseOut>>('/admin/courses', {
      params: { page, page_size: pageSize },
    });
    return res.data;
  },

  createCourse: async (data: CourseCreate): Promise<CourseOut> => {
    const res = await apiClient.post<CourseOut>('/admin/courses', data);
    return res.data;
  },

  getSections: async (
    page = 1,
    pageSize = 50
  ): Promise<PageResponse<SectionOut>> => {
    const res = await apiClient.get<PageResponse<SectionOut>>(
      '/admin/sections',
      {
        params: { page, page_size: pageSize },
      }
    );
    return res.data;
  },

  createSection: async (data: SectionCreate): Promise<SectionOut> => {
    const res = await apiClient.post<SectionOut>('/admin/sections', data);
    return res.data;
  },

  createBuilding: async (data: {
    name: string;
    code: string;
  }): Promise<BuildingOut> => {
    const res = await apiClient.post<BuildingOut>('/admin/buildings', data);
    return res.data;
  },

  createFloor: async (
    buildingId: number,
    data: { floor_number: number }
  ): Promise<FloorOut> => {
    const res = await apiClient.post<FloorOut>(
      `/admin/buildings/${buildingId}/floors`,
      data
    );
    return res.data;
  },
};
