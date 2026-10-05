import { apiClient } from './client';
import type { BookingCreate, BookingOut, PageResponse } from '../types';

export interface BookingFilterParams {
  page?: number;
  page_size?: number;
  room_id?: number;
  status?: string;
  from_datetime?: string;
  to_datetime?: string;
  mine?: boolean;
}

export const bookingsApi = {
  createBooking: async (data: BookingCreate): Promise<BookingOut> => {
    const res = await apiClient.post<BookingOut>('/bookings', data);
    return res.data;
  },

  getBookings: async (
    params?: BookingFilterParams
  ): Promise<PageResponse<BookingOut>> => {
    const res = await apiClient.get<PageResponse<BookingOut>>('/bookings', {
      params,
    });
    return res.data;
  },

  getBooking: async (bookingId: number): Promise<BookingOut> => {
    const res = await apiClient.get<BookingOut>(`/bookings/${bookingId}`);
    return res.data;
  },

  cancelBooking: async (bookingId: number): Promise<BookingOut> => {
    const res = await apiClient.delete<BookingOut>(`/bookings/${bookingId}`);
    return res.data;
  },
};
