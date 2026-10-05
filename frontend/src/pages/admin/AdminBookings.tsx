import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen,
  Calendar,
  Clock,
  DoorOpen,
  Filter,
  Trash2,
} from 'lucide-react';
import { bookingsApi } from '../../api/bookings';
import { formatDate, formatDuration, formatTime } from '../../utils/datetime';
import { StatusBadge } from '../../components/StatusBadge';
import { TableSkeleton } from '../../components/LoadingSkeleton';
import { EmptyState } from '../../components/EmptyState';
import { ErrorBanner } from '../../components/ErrorBanner';
import { Modal } from '../../components/Modal';
import type { BookingOut } from '../../types';

export const AdminBookings: React.FC = () => {
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [cancellingBooking, setCancellingBooking] = useState<BookingOut | null>(
    null
  );
  const [actionError, setActionError] = useState<unknown>(null);

  const {
    data: bookingsData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['admin', 'bookings', page, statusFilter],
    queryFn: () =>
      bookingsApi.getBookings({
        page,
        page_size: 25,
        status: statusFilter || undefined,
        mine: false,
      }),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: number) => bookingsApi.cancelBooking(id),
    onSuccess: () => {
      setCancellingBooking(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'bookings'] });
      queryClient.invalidateQueries({ queryKey: ['availability'] });
    },
    onError: (err) => setActionError(err),
  });

  const bookingsList = bookingsData?.items || [];
  const totalPages = Math.ceil((bookingsData?.total ?? 0) / 25);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-brand-600" />
            Campus Booking Management
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Monitor and administer student & faculty classroom reservations.
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        {['', 'CONFIRMED', 'CANCELLED'].map((st) => (
          <button
            key={st}
            onClick={() => {
              setStatusFilter(st);
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              statusFilter === st
                ? 'bg-brand-600 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {st === '' ? 'All Bookings' : st}
          </button>
        ))}
        <span className="ml-auto text-xs text-slate-400">
          Total: {bookingsData?.total ?? 0}
        </span>
      </div>

      {error && <ErrorBanner error={error} onRetry={refetch} />}

      {isLoading ? (
        <TableSkeleton rows={8} cols={6} />
      ) : bookingsList.length > 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3.5">Booking ID</th>
                  <th className="px-6 py-3.5">Room</th>
                  <th className="px-6 py-3.5">User ID</th>
                  <th className="px-6 py-3.5">Interval</th>
                  <th className="px-6 py-3.5">Purpose</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bookingsList.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/60 transition">
                    <td className="px-6 py-4 font-mono font-bold text-slate-700">
                      #{b.id}
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-900">
                      Room #{b.room_id}
                    </td>
                    <td className="px-6 py-4 text-slate-600 font-mono text-xs">
                      User #{b.user_id}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      <span className="font-semibold text-slate-800 block">
                        {formatDate(b.start_datetime)}
                      </span>
                      <span className="text-xs text-slate-500 block">
                        {formatTime(b.start_datetime)} – {formatTime(b.end_datetime)} ({formatDuration(b.start_datetime, b.end_datetime)})
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500 max-w-xs truncate text-xs">
                      {b.purpose || <span className="text-slate-300 italic">None</span>}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={b.status} size="sm" />
                    </td>
                    <td className="px-6 py-4 text-right">
                      {b.status === 'CONFIRMED' && (
                        <button
                          onClick={() => {
                            setCancellingBooking(b);
                            setActionError(null);
                          }}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-800 p-1 hover:bg-rose-50 rounded-md"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="px-3 py-1.5 rounded border border-slate-200 disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-slate-500">
                Page {page} of {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="px-3 py-1.5 rounded border border-slate-200 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </div>
      ) : (
        <EmptyState
          icon={DoorOpen}
          title="No bookings recorded"
          description="There are currently no bookings matching your filter."
        />
      )}

      {/* Cancel Modal */}
      <Modal
        isOpen={Boolean(cancellingBooking)}
        onClose={() => setCancellingBooking(null)}
        title="Admin Override: Cancel Booking"
      >
        <div className="space-y-4">
          <ErrorBanner error={actionError} />
          <p className="text-sm text-slate-600">
            Cancel booking <strong className="text-slate-900">#{cancellingBooking?.id}</strong> for Room #{cancellingBooking?.room_id} on {formatDate(cancellingBooking?.start_datetime)}?
          </p>
          <p className="text-xs text-slate-400">
            The user will be notified of this cancellation automatically.
          </p>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              onClick={() => setCancellingBooking(null)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
            >
              Back
            </button>
            <button
              disabled={cancelMutation.isPending}
              onClick={() =>
                cancellingBooking && cancelMutation.mutate(cancellingBooking.id)
              }
              className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition disabled:opacity-50"
            >
              {cancelMutation.isPending ? 'Processing...' : 'Confirm Override'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
