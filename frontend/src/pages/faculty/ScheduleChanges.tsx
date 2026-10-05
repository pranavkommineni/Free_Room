import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Calendar,
  CheckCircle2,
  Clock,
  FileEdit,
  History,
  Info,
  RefreshCw,
  Trash2,
  XCircle,
} from 'lucide-react';
import { scheduleChangesApi } from '../../api/scheduleChanges';
import { formatDate, formatTime } from '../../utils/datetime';
import { StatusBadge } from '../../components/StatusBadge';
import { TableSkeleton } from '../../components/LoadingSkeleton';
import { EmptyState } from '../../components/EmptyState';
import { ErrorBanner } from '../../components/ErrorBanner';
import { Modal } from '../../components/Modal';
import type { ScheduleChangeOut } from '../../types';

export const ScheduleChanges: React.FC = () => {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [withdrawingChange, setWithdrawingChange] =
    useState<ScheduleChangeOut | null>(null);
  const [actionError, setActionError] = useState<unknown>(null);

  // Fetch changes
  const {
    data: changesData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['schedule-changes', 'list', statusFilter],
    queryFn: () =>
      scheduleChangesApi.getChanges({
        status: statusFilter || undefined,
        page_size: 50,
      }),
  });

  // Withdraw mutation
  const withdrawMutation = useMutation({
    mutationFn: (id: number) => scheduleChangesApi.withdrawChange(id),
    onSuccess: () => {
      setWithdrawingChange(null);
      queryClient.invalidateQueries({ queryKey: ['schedule-changes'] });
      queryClient.invalidateQueries({ queryKey: ['timetable'] });
      queryClient.invalidateQueries({ queryKey: ['availability'] });
    },
    onError: (err) => {
      setActionError(err);
    },
  });

  const changesList = changesData?.items || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <RefreshCw className="w-6 h-6 text-brand-600" />
            Schedule Change Requests
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Track your one-off reschedule and class cancellation requests.
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        {['', 'PENDING', 'APPROVED', 'REJECTED'].map((st) => (
          <button
            key={st}
            onClick={() => setStatusFilter(st)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              statusFilter === st
                ? 'bg-brand-600 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {st === '' ? 'All Changes' : st}
          </button>
        ))}
      </div>

      {error && <ErrorBanner error={error} onRetry={refetch} />}

      {isLoading ? (
        <TableSkeleton rows={4} cols={5} />
      ) : changesList.length > 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3.5">Type</th>
                  <th className="px-6 py-3.5">Original Lecture</th>
                  <th className="px-6 py-3.5">Proposed Change</th>
                  <th className="px-6 py-3.5">Reason & Note</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {changesList.map((ch) => {
                  const isPending = ch.status === 'PENDING';
                  return (
                    <tr key={ch.id} className="hover:bg-slate-50/60 transition">
                      <td className="px-6 py-4 font-bold text-slate-900">
                        {ch.change_type}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        <span className="font-semibold text-slate-800 block">
                          {formatDate(ch.original_date)}
                        </span>
                        <span className="text-xs text-slate-500 block">
                          {formatTime(ch.original_start_time)} – {formatTime(ch.original_end_time)}
                        </span>
                        <span className="text-xs text-slate-400 block">
                          Room #{ch.original_room_id}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-700">
                        {ch.new_date ? (
                          <>
                            <span className="font-bold text-brand-600 block">
                              {formatDate(ch.new_date)}
                            </span>
                            <span className="text-xs text-slate-600 block">
                              {formatTime(ch.new_start_time)} – {formatTime(ch.new_end_time)}
                            </span>
                            {ch.new_room_id && (
                              <span className="text-xs font-semibold text-slate-700 block">
                                Room #{ch.new_room_id}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-xs text-slate-400">Class Cancelled</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-600 max-w-xs">
                        {ch.reason && <p className="italic mb-1">"{ch.reason}"</p>}
                        {ch.decision_note && (
                          <p className="text-brand-700 font-medium">
                            Decision: {ch.decision_note}
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={ch.status} size="sm" />
                      </td>
                      <td className="px-6 py-4 text-right">
                        {isPending && (
                          <button
                            onClick={() => {
                              setWithdrawingChange(ch);
                              setActionError(null);
                            }}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-800 p-1 hover:bg-rose-50 rounded-md"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Withdraw
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
          icon={RefreshCw}
          title="No schedule changes"
          description={
            statusFilter
              ? `No requests found with status "${statusFilter}".`
              : 'You have not submitted any class reschedule or cancellation requests.'
          }
        />
      )}

      {/* Withdraw Modal */}
      <Modal
        isOpen={Boolean(withdrawingChange)}
        onClose={() => setWithdrawingChange(null)}
        title="Withdraw Request"
      >
        <div className="space-y-4">
          <ErrorBanner error={actionError} />

          <p className="text-sm text-slate-600">
            Are you sure you want to withdraw this pending schedule change request for{' '}
            <strong>{formatDate(withdrawingChange?.original_date)}</strong>?
          </p>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              onClick={() => setWithdrawingChange(null)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
            >
              Cancel
            </button>
            <button
              disabled={withdrawMutation.isPending}
              onClick={() =>
                withdrawingChange &&
                withdrawMutation.mutate(withdrawingChange.id)
              }
              className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition disabled:opacity-50"
            >
              {withdrawMutation.isPending ? 'Withdrawing...' : 'Confirm Withdraw'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
