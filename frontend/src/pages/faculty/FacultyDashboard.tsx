import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Calendar,
  CheckCircle2,
  Clock,
  Compass,
  FileEdit,
  GraduationCap,
  MapPin,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { timetableApi } from '../../api/timetable';
import { scheduleChangesApi } from '../../api/scheduleChanges';
import { roomsApi } from '../../api/rooms';
import {
  formatDate,
  formatDuration,
  formatTime,
  getCampusToday,
} from '../../utils/datetime';
import { StatusBadge } from '../../components/StatusBadge';
import { CardSkeleton } from '../../components/LoadingSkeleton';
import { ErrorBanner } from '../../components/ErrorBanner';
import { Modal } from '../../components/Modal';
import type { OccurrenceOut } from '../../types';

export const FacultyDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const todayStr = getCampusToday();

  // Reschedule & Cancel Modal States
  const [selectedOccurrence, setSelectedOccurrence] =
    useState<OccurrenceOut | null>(null);
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  // Form states
  const [newDate, setNewDate] = useState(todayStr);
  const [newStartTime, setNewStartTime] = useState('11:20');
  const [newEndTime, setNewEndTime] = useState('12:10');
  const [newRoomId, setNewRoomId] = useState<number | ''>('');
  const [reason, setReason] = useState('');
  const [actionError, setActionError] = useState<unknown>(null);
  const [actionSuccess, setActionSuccess] = useState(false);

  // 1. Fetch Today's Teaching Schedule
  const {
    data: todayClasses,
    isLoading: loadingClasses,
    error: classesError,
  } = useQuery({
    queryKey: ['timetable', 'faculty', todayStr],
    queryFn: () => timetableApi.getMyTimetable(todayStr, todayStr),
  });

  // 2. Fetch Pending/Recent Schedule Changes
  const { data: changesData, isLoading: loadingChanges } = useQuery({
    queryKey: ['schedule-changes', 'faculty'],
    queryFn: () => scheduleChangesApi.getChanges({ page_size: 5 }),
  });

  // 3. Fetch rooms for reschedule room picker
  const { data: roomsData } = useQuery({
    queryKey: ['rooms', 'picker'],
    queryFn: () => roomsApi.getRooms({ page_size: 100 }),
    enabled: isRescheduling,
  });

  // Reschedule mutation
  const rescheduleMutation = useMutation({
    mutationFn: (data: {
      timetable_slot_id: number;
      original_date: string;
      new_date: string;
      new_start_time: string;
      new_end_time: string;
      new_room_id?: number | null;
      reason?: string;
    }) =>
      scheduleChangesApi.requestChange({
        timetable_slot_id: data.timetable_slot_id,
        original_date: data.original_date,
        change_type: 'RESCHEDULED',
        new_date: data.new_date,
        new_start_time: `${data.new_start_time}:00`,
        new_end_time: `${data.new_end_time}:00`,
        new_room_id: data.new_room_id || null,
        reason: data.reason || null,
      }),
    onSuccess: () => {
      setActionSuccess(true);
      queryClient.invalidateQueries({ queryKey: ['timetable'] });
      queryClient.invalidateQueries({ queryKey: ['schedule-changes'] });
      queryClient.invalidateQueries({ queryKey: ['availability'] });
    },
    onError: (err) => {
      setActionError(err);
    },
  });

  // Cancel occurrence mutation
  const cancelOccurrenceMutation = useMutation({
    mutationFn: (data: {
      timetable_slot_id: number;
      original_date: string;
      reason?: string;
    }) =>
      scheduleChangesApi.cancelOccurrence({
        timetable_slot_id: data.timetable_slot_id,
        original_date: data.original_date,
        reason: data.reason || null,
      }),
    onSuccess: () => {
      setActionSuccess(true);
      queryClient.invalidateQueries({ queryKey: ['timetable'] });
      queryClient.invalidateQueries({ queryKey: ['schedule-changes'] });
      queryClient.invalidateQueries({ queryKey: ['availability'] });
    },
    onError: (err) => {
      setActionError(err);
    },
  });

  const handleStartReschedule = (occ: OccurrenceOut) => {
    setSelectedOccurrence(occ);
    setIsRescheduling(true);
    setIsCancelling(false);
    setActionSuccess(false);
    setActionError(null);
    setNewDate(occ.start.split('T')[0]);
    setNewStartTime('14:00');
    setNewEndTime('14:50');
    setNewRoomId(occ.room_id || '');
    setReason('');
  };

  const handleStartCancel = (occ: OccurrenceOut) => {
    setSelectedOccurrence(occ);
    setIsCancelling(true);
    setIsRescheduling(false);
    setActionSuccess(false);
    setActionError(null);
    setReason('');
  };

  const submitReschedule = () => {
    if (!selectedOccurrence) return;
    setActionError(null);
    rescheduleMutation.mutate({
      timetable_slot_id: selectedOccurrence.slot_id,
      original_date: selectedOccurrence.start.split('T')[0],
      new_date: newDate,
      new_start_time: newStartTime,
      new_end_time: newEndTime,
      new_room_id: newRoomId ? Number(newRoomId) : null,
      reason: reason.trim() || undefined,
    });
  };

  const submitCancel = () => {
    if (!selectedOccurrence) return;
    setActionError(null);
    cancelOccurrenceMutation.mutate({
      timetable_slot_id: selectedOccurrence.slot_id,
      original_date: selectedOccurrence.start.split('T')[0],
      reason: reason.trim() || undefined,
    });
  };

  const changesList = changesData?.items || [];
  const roomsList = roomsData?.items || [];

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-brand-950 rounded-2xl p-6 md:p-8 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/20 text-brand-200 border border-brand-400/20 text-xs font-semibold uppercase tracking-wider mb-3">
            <GraduationCap className="w-3.5 h-3.5" />
            Faculty Portal · VIT Chennai AB3
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            Welcome, {user?.name || 'Professor'}
          </h2>
          <p className="text-slate-300 text-sm mt-1">
            Faculty Code: <span className="font-mono text-brand-200">{user?.faculty_code || 'N/A'}</span> · Manage your classes, reschedules, and room bookings.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => navigate('/faculty/schedule-changes')}
            className="px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs shadow-md transition"
          >
            Manage Schedule Changes
          </button>
        </div>
      </div>

      {/* Grid: Today's Classes & Pending Changes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Lectures (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-brand-600" />
                Today's Teaching Schedule
              </h3>
              <p className="text-xs text-slate-500">{formatDate(todayStr)}</p>
            </div>
            <button
              onClick={() => navigate('/faculty/timetable')}
              className="text-xs font-semibold text-brand-600 hover:text-brand-700"
            >
              Full Timetable
            </button>
          </div>

          {loadingClasses ? (
            <CardSkeleton count={2} />
          ) : classesError ? (
            <ErrorBanner error={classesError} />
          ) : todayClasses && todayClasses.length > 0 ? (
            <div className="space-y-3">
              {todayClasses.map((occ) => {
                const isCancelled = occ.source === 'CANCELLED';
                const isRescheduled = occ.source === 'RESCHEDULED';

                return (
                  <div
                    key={occ.slot_id + occ.start}
                    className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition ${
                      isCancelled
                        ? 'bg-rose-50/50 border-rose-200'
                        : isRescheduled
                        ? 'bg-amber-50/50 border-amber-200'
                        : 'bg-slate-50/50 border-slate-200 hover:bg-white'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-white border border-slate-200">
                          {occ.course_code}
                        </span>
                        <h4 className="font-bold text-sm text-slate-900">
                          {occ.course_name}
                        </h4>
                        {isCancelled && (
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-rose-600 text-white uppercase">
                            CANCELLED
                          </span>
                        )}
                        {isRescheduled && (
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-amber-500 text-white uppercase">
                            RESCHEDULED
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-4 text-xs text-slate-500 mt-2">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {formatTime(occ.start)} – {formatTime(occ.end)}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          Room: <strong className="text-slate-800">{occ.room || 'TBD'}</strong>
                        </span>
                      </div>
                    </div>

                    {!isCancelled && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleStartReschedule(occ)}
                          className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition"
                        >
                          Reschedule
                        </button>
                        <button
                          onClick={() => handleStartCancel(occ)}
                          className="px-3 py-1.5 rounded-lg border border-rose-200 bg-white hover:bg-rose-50 text-xs font-semibold text-rose-600 transition"
                        >
                          Cancel Class
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center text-slate-500 text-sm">
              No lectures scheduled for you today.
            </div>
          )}
        </div>

        {/* Schedule Requests Overview (1 col) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-brand-600" />
                Schedule Changes
              </h3>
              <button
                onClick={() => navigate('/faculty/schedule-changes')}
                className="text-xs font-semibold text-brand-600 hover:text-brand-700"
              >
                View All
              </button>
            </div>

            {loadingChanges ? (
              <div className="space-y-3">
                <div className="h-16 bg-slate-100 rounded-lg animate-pulse" />
              </div>
            ) : changesList.length > 0 ? (
              <div className="space-y-3">
                {changesList.map((ch) => (
                  <div
                    key={ch.id}
                    className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white transition"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold uppercase text-slate-800">
                        {ch.change_type}
                      </span>
                      <StatusBadge status={ch.status} size="sm" />
                    </div>
                    <p className="text-xs text-slate-500">
                      Original: {formatDate(ch.original_date)} ({formatTime(ch.original_start_time)})
                    </p>
                    {ch.new_date && (
                      <p className="text-xs text-brand-600 font-semibold mt-0.5">
                        New: {formatDate(ch.new_date)} ({formatTime(ch.new_start_time)})
                      </p>
                    )}
                    {ch.decision_note && (
                      <p className="text-[11px] text-slate-500 italic mt-1 border-t border-slate-100 pt-1">
                        Note: {ch.decision_note}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-xs text-slate-500">
                  No active or past reschedule requests.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reschedule Modal */}
      <Modal
        isOpen={isRescheduling}
        onClose={() => setIsRescheduling(false)}
        title={
          actionSuccess
            ? 'Reschedule Submitted'
            : `Reschedule ${selectedOccurrence?.course_code || 'Class'}`
        }
      >
        {actionSuccess ? (
          <div className="text-center py-4 space-y-4">
            <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
            <div>
              <h4 className="text-lg font-bold text-slate-900">
                Reschedule Request Created!
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                Your request has been validated for conflicts and submitted to the campus administrator for approval.
              </p>
            </div>
            <button
              onClick={() => {
                setIsRescheduling(false);
                navigate('/faculty/schedule-changes');
              }}
              className="w-full py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition"
            >
              View Change Requests
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <ErrorBanner error={actionError} />

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1">
              <p className="font-bold text-slate-900">
                {selectedOccurrence?.course_name} ({selectedOccurrence?.course_code})
              </p>
              <p className="text-slate-500">
                Original Occurrence: {formatDate(selectedOccurrence?.start)} (
                {formatTime(selectedOccurrence?.start)} – {formatTime(selectedOccurrence?.end)})
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  New Date
                </label>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  New Classroom (AB3)
                </label>
                <select
                  value={newRoomId}
                  onChange={(e) =>
                    setNewRoomId(e.target.value ? Number(e.target.value) : '')
                  }
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  <option value="">Keep Original Room</option>
                  {roomsList.map((r) => (
                    <option key={r.id} value={r.id}>
                      Room {r.room_number} (Floor {r.floor_number}, Cap: {r.capacity})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  New Start Time
                </label>
                <input
                  type="time"
                  value={newStartTime}
                  onChange={(e) => setNewStartTime(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  New End Time
                </label>
                <input
                  type="time"
                  value={newEndTime}
                  onChange={(e) => setNewEndTime(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Reason for Rescheduling
              </label>
              <textarea
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Faculty conference conflict, compensatory class"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-hidden"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsRescheduling(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={rescheduleMutation.isPending}
                onClick={submitReschedule}
                className="px-5 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition disabled:opacity-50"
              >
                {rescheduleMutation.isPending ? 'Validating Conflicts...' : 'Submit Request'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Cancel Occurrence Modal */}
      <Modal
        isOpen={isCancelling}
        onClose={() => setIsCancelling(false)}
        title={actionSuccess ? 'Class Cancelled' : 'Cancel Class Occurrence'}
      >
        {actionSuccess ? (
          <div className="text-center py-4 space-y-4">
            <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
            <div>
              <h4 className="text-lg font-bold text-slate-900">
                Class Occurrence Cancelled!
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                The class occurrence is cancelled immediately, the classroom has been freed, and students will see this reflected on their timetable.
              </p>
            </div>
            <button
              onClick={() => setIsCancelling(false)}
              className="w-full py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition"
            >
              Close
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <ErrorBanner error={actionError} />

            <p className="text-sm text-slate-600">
              Are you sure you want to cancel the lecture for{' '}
              <strong className="text-slate-900">
                {selectedOccurrence?.course_name} ({selectedOccurrence?.course_code})
              </strong>{' '}
              on {formatDate(selectedOccurrence?.start)}?
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Cancellation Reason
              </label>
              <textarea
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Faculty unwell, departmental meeting"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-hidden"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsCancelling(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
              >
                Keep Class
              </button>
              <button
                type="button"
                disabled={cancelOccurrenceMutation.isPending}
                onClick={submitCancel}
                className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition disabled:opacity-50"
              >
                {cancelOccurrenceMutation.isPending ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
