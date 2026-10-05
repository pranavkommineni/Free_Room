import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Calendar,
  CheckCircle2,
  CheckSquare,
  Clock,
  Filter,
  RefreshCw,
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

export const AdminScheduleRequests: React.FC = () => {
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [selectedChange, setSelectedChange] = useState<ScheduleChangeOut | null>(
    null
  );
  const [decisionMode, setDecisionMode] = useState<'approve' | 'reject' | null>(
    null
  );
  const [decisionNote, setDecisionNote] = useState('');
  const [actionError, setActionError] = useState<unknown>(null);

  const {
    data: changesData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['admin', 'schedule-requests', statusFilter],
    queryFn: () =>
      scheduleChangesApi.getChanges({
        status: statusFilter || undefined,
        page_size: 50,
      }),
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, note }: { id: number; note?: string | null }) =>
      scheduleChangesApi.approveChange(id, note),
    onSuccess: () => {
      setSelectedChange(null);
      setDecisionMode(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'schedule-requests'] });
      queryClient.invalidateQueries({ queryKey: ['timetable'] });
      queryClient.invalidateQueries({ queryKey: ['availability'] });
    },
    onError: (err) => setActionError(err),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, note }: { id: number; note?: string | null }) =>
      scheduleChangesApi.rejectChange(id, note),
    onSuccess: () => {
      setSelectedChange(null);
      setDecisionMode(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'schedule-requests'] });
      queryClient.invalidateQueries({ queryKey: ['timetable'] });
      queryClient.invalidateQueries({ queryKey: ['availability'] });
    },
    onError: (err) => setActionError(err),
  });

  const handleOpenDecision = (
    change: ScheduleChangeOut,
    mode: 'approve' | 'reject'
  ) => {
    setSelectedChange(change);
    setDecisionMode(mode);
    setDecisionNote('');
    setActionError(null);
  };

  const handleConfirmDecision = () => {
    if (!selectedChange || !decisionMode) return;
    if (decisionMode === 'approve') {
      approveMutation.mutate({
        id: selectedChange.id,
        note: decisionNote.trim() || null,
      });
    } else {
      rejectMutation.mutate({
        id: selectedChange.id,
        note: decisionNote.trim() || null,
      });
    }
  };

  const changesList = changesData?.items || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <CheckSquare className="w-6 h-6 text-brand-600" />
            Faculty Schedule Requests
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Review and adjudicate lecture reschedule and room shift applications.
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        {['PENDING', 'APPROVED', 'REJECTED', ''].map((st) => (
          <button
            key={st}
            onClick={() => setStatusFilter(st)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              statusFilter === st
                ? 'bg-brand-600 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {st === '' ? 'All Requests' : st}
          </button>
        ))}
      </div>

      {error && <ErrorBanner error={error} onRetry={refetch} />}

      {isLoading ? (
        <TableSkeleton rows={5} cols={6} />
      ) : changesList.length > 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3.5">Req #</th>
                  <th className="px-6 py-3.5">Change Type</th>
                  <th className="px-6 py-3.5">Original Slot</th>
                  <th className="px-6 py-3.5">Target Slot & Room</th>
                  <th className="px-6 py-3.5">Reason & Decision</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {changesList.map((ch) => {
                  const isPending = ch.status === 'PENDING';
                  return (
                    <tr key={ch.id} className="hover:bg-slate-50/60 transition">
                      <td className="px-6 py-4 font-mono font-bold text-slate-700">
                        #{ch.id}
                      </td>
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
                          <p className="text-brand-700 font-semibold">
                            Admin Note: {ch.decision_note}
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={ch.status} size="sm" />
                      </td>
                      <td className="px-6 py-4 text-right">
                        {isPending && (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleOpenDecision(ch, 'approve')}
                              className="px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md border border-emerald-200 transition"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleOpenDecision(ch, 'reject')}
                              className="px-2.5 py-1 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-md border border-rose-200 transition"
                            >
                              Reject
                            </button>
                          </div>
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
          icon={CheckSquare}
          title="No schedule requests"
          description="There are currently no requests matching this status."
        />
      )}

      {/* Decision Modal */}
      <Modal
        isOpen={Boolean(selectedChange && decisionMode)}
        onClose={() => setSelectedChange(null)}
        title={
          decisionMode === 'approve'
            ? 'Approve Schedule Request'
            : 'Reject Schedule Request'
        }
      >
        <div className="space-y-4">
          <ErrorBanner error={actionError} />

          <p className="text-sm text-slate-600">
            {decisionMode === 'approve'
              ? 'Approve this request? The room lock will be re-validated under transaction, and the effective timetable will update immediately for all students and faculty.'
              : 'Reject this request? The faculty member will be notified with your feedback.'}
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Decision Note (Optional)
            </label>
            <textarea
              rows={2}
              value={decisionNote}
              onChange={(e) => setDecisionNote(e.target.value)}
              placeholder="e.g. Approved. Room 304 assigned."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-hidden"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              onClick={() => setSelectedChange(null)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
            >
              Cancel
            </button>
            <button
              disabled={approveMutation.isPending || rejectMutation.isPending}
              onClick={handleConfirmDecision}
              className={`px-5 py-2 text-xs font-bold text-white rounded-lg transition ${
                decisionMode === 'approve'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-rose-600 hover:bg-rose-700'
              }`}
            >
              {approveMutation.isPending || rejectMutation.isPending
                ? 'Processing...'
                : decisionMode === 'approve'
                ? 'Confirm Approval'
                : 'Confirm Rejection'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
