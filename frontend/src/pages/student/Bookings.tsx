import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen,
  Calendar,
  Clock,
  Compass,
  DoorOpen,
  Trash2,
  AlertCircle,
} from 'lucide-react';
import { bookingsApi } from '../../api/bookings';
import { formatDate, formatDuration, formatTime } from '../../utils/datetime';
import { StatusBadge } from '../../components/StatusBadge';
import { TableSkeleton } from '../../components/LoadingSkeleton';
import { EmptyState } from '../../components/EmptyState';
import { ErrorBanner } from '../../components/ErrorBanner';
import { Modal } from '../../components/Modal';
import type { BookingOut } from '../../types';

export const Bookings: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<string>('');
  const [cancellingBooking, setCancellingBooking] = useState<BookingOut | null>(
    null
  );
  const [cancelError, setCancelError] = useState<unknown>(null);

  // Fetch bookings
  const {
    data: bookingsData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['bookings', 'mine', statusFilter],
    queryFn: () =>
      bookingsApi.getBookings({
        mine: true,
        status: statusFilter || undefined,
        page_size: 50,
      }),
  });

  // Cancel booking mutation
  const cancelMutation = useMutation({
    mutationFn: (id: number) => bookingsApi.cancelBooking(id),
    onSuccess: () => {
      setCancellingBooking(null);
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['availability'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (err) => {
      setCancelError(err);
    },
  });

  const bookingsList = bookingsData?.items || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-brand-600" />
            My Room Bookings
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage your classroom reservations in Academic Block 3.
          </p>
        </div>

        <button
          onClick={() => navigate('/student/find-rooms')}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs transition shadow-sm"
        >
          <Compass className="w-4 h-4" />
          Book Another Room
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        {['', 'CONFIRMED', 'CANCELLED'].map((st) => (
          <button
            key={st}
            onClick={() => setStatusFilter(st)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              statusFilter === st
                ? 'bg-brand-600 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {st === '' ? 'All Bookings' : st}
          </button>
        ))}
      </div>

      {error && <ErrorBanner error={error} onRetry={refetch} />}

      {/* Bookings List */}
      {isLoading ? (
        <TableSkeleton rows={5} cols={5} />
      ) : bookingsList.length > 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3.5">Room</th>
                  <th className="px-6 py-3.5">Date</th>
                  <th className="px-6 py-3.5">Time Interval</th>
                  <th className="px-6 py-3.5">Purpose</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bookingsList.map((b) => {
                  const isConfirmed = b.status === 'CONFIRMED';
                  return (
                    <tr key={b.id} className="hover:bg-slate-50/60 transition">
                      <td className="px-6 py-4 font-bold text-slate-900">
                        Room #{b.room_id}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {formatDate(b.start_datetime)}
                      </td>
                      <td className="px-6 py-4 text-slate-600 font-medium">
                        {formatTime(b.start_datetime)} – {formatTime(b.end_datetime)}
                        <span className="text-xs text-slate-400 block">
                          ({formatDuration(b.start_datetime, b.end_datetime)})
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-500 max-w-xs truncate">
                        {b.purpose || <span className="text-slate-300 italic">None provided</span>}
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={b.status} size="sm" />
                      </td>
                      <td className="px-6 py-4 text-right">
                        {isConfirmed && (
                          <button
                            onClick={() => {
                              setCancellingBooking(b);
                              setCancelError(null);
                            }}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-800 transition p-1 hover:bg-rose-50 rounded-md"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <EmptyState
          icon={DoorOpen}
          title="No bookings found"
          description={
            statusFilter
              ? `You have no bookings matching status "${statusFilter}".`
              : 'You have not booked any classrooms yet. Explore genuinely free rooms in AB3.'
          }
          actionText="Find a Free Classroom"
          onAction={() => navigate('/student/find-rooms')}
        />
      )}

      {/* Cancel Confirmation Modal */}
      <Modal
        isOpen={Boolean(cancellingBooking)}
        onClose={() => setCancellingBooking(null)}
        title="Cancel Reservation"
      >
        <div className="space-y-4">
          <ErrorBanner error={cancelError} />

          <p className="text-sm text-slate-600">
            Are you sure you want to cancel your reservation for{' '}
            <strong className="text-slate-900">
              Room #{cancellingBooking?.room_id}
            </strong>{' '}
            on{' '}
            <strong>{formatDate(cancellingBooking?.start_datetime)}</strong> (
            {formatTime(cancellingBooking?.start_datetime)} –{' '}
            {formatTime(cancellingBooking?.end_datetime)})?
          </p>

          <p className="text-xs text-slate-400">
            This will immediately release the room lock, freeing it up for other students.
          </p>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              onClick={() => setCancellingBooking(null)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
            >
              Keep Booking
            </button>
            <button
              disabled={cancelMutation.isPending}
              onClick={() =>
                cancellingBooking && cancelMutation.mutate(cancellingBooking.id)
              }
              className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition disabled:opacity-50"
            >
              {cancelMutation.isPending ? 'Cancelling...' : 'Confirm Cancellation'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
