import { apiClient } from './client';
import type { MessageResponse, NotificationOut, PageResponse } from '../types';

export const notificationsApi = {
  getNotifications: async (
    page = 1,
    pageSize = 20,
    unreadOnly = false
  ): Promise<PageResponse<NotificationOut>> => {
    const res = await apiClient.get<PageResponse<NotificationOut>>(
      '/notifications',
      {
        params: {
          page,
          page_size: pageSize,
          unread_only: unreadOnly,
        },
      }
    );
    return res.data;
  },

  getUnreadCount: async (): Promise<{ unread: number }> => {
    const res = await apiClient.get<{ unread: number }>(
      '/notifications/unread-count'
    );
    return res.data;
  },

  markAllRead: async (): Promise<MessageResponse> => {
    const res = await apiClient.put<MessageResponse>('/notifications/read-all');
    return res.data;
  },

  markRead: async (notificationId: number): Promise<NotificationOut> => {
    const res = await apiClient.put<NotificationOut>(
      `/notifications/${notificationId}/read`
    );
    return res.data;
  },
};
