import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Calendar,
  Clock,
  DoorOpen,
  Plus,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { maintenanceApi } from '../../api/maintenance';
import { roomsApi } from '../../api/rooms';
import {
  formatDate,
  formatDuration,
  formatTime,
  getCampusToday,
  toCampusISO,
} from '../../utils/datetime';
import { StatusBadge } from '../../components/StatusBadge';
import { TableSkeleton } from '../../components/LoadingSkeleton';
import { EmptyState } from '../../components/EmptyState';
import { ErrorBanner } from '../../components/ErrorBanner';
import { Modal } from '../../components/Modal';
import type { RestrictionCreate } from '../../types';

export const AdminRestrictions: React.FC = () => {
  const queryClient = useQueryClient();
  const todayStr = getCampusToday();

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('ACTIVE');

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [actionError, setActionError] = useState<unknown>(null);

  // Form states
  const [roomId, setRoomId] = useState<number>(1);
  const [startDate, setStartDate] = useState(todayStr);
  const [startTime, setStartTime] = useState('08:00');
  const [endDate, setEndDate] = useState(todayStr);
  const [endTime, setEndTime] = useState('18:00');
  const [reason, setReason] = useState('');

  // Fetch restrictions
  const {
    data: restrictionsData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['admin', 'restrictions', page, statusFilter],
    queryFn: () =>
      maintenanceApi.getRestrictionsList({
        page,
        page_size: 25,
        status: statusFilter || undefined,
      }),
  });

  // Fetch rooms
  const { data: roomsData } = useQuery({
    queryKey: ['rooms', 'admin-all'],
    queryFn: () => roomsApi.getRooms({ page_size: 100 }),
  });

  // Create restriction mutation
  const createMutation = useMutation({
    mutationFn: (data: RestrictionCreate) =>
      maintenanceApi.createRestriction(data),
    onSuccess: () => {
      setIsCreateOpen(false);
      queryClient.invalidateQueries({ queryKey: ['admin', 'restrictions'] });
      queryClient.invalidateQueries({ queryKey: ['availability'] });
    },
    onError: (err) => setActionError(err),
  });

  // Lift restriction mutation
  const liftMutation = useMutation({
    mutationFn: (id: number) => maintenanceApi.liftRestriction(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'restrictions'] });
      queryClient.invalidateQueries({ queryKey: ['availability'] });
    },
    onError: (err) => setActionError(err),
  });

  const handleSaveCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    const startISO = toCampusISO(startDate, startTime);
    const endISO = toCampusISO(endDate, endTime);

    createMutation.mutate({
      room_id: Number(roomId),
      start_datetime: startISO,
      end_datetime: endISO,
      reason: reason.trim(),
    });
  };

  const restrictionsList = restrictionsData?.items || [];
  const rooms = roomsData?.items || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-brand-600" />
            Temporary Room Restrictions
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Lock classrooms for official exams, campus symposiums, or VIP visits.
          </p>
        </div>

        <button
          onClick={() => {
            setActionError(null);
            if (rooms[0]) setRoomId(rooms[0].id);
            setReason('');
            setIsCreateOpen(true);
          }}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs transition shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Enforce Restriction
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        {['ACTIVE', 'LIFTED', ''].map((st) => (
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
            {st === '' ? 'All Restrictions' : st}
          </button>
        ))}
      </div>

      {error && <ErrorBanner error={error} onRetry={refetch} />}

      {isLoading ? (
        <TableSkeleton rows={5} cols={5} />
      ) : restrictionsList.length > 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3.5">ID</th>
                  <th className="px-6 py-3.5">Room</th>
                  <th className="px-6 py-3.5">Time Interval</th>
                  <th className="px-6 py-3.5">Restricted Purpose</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {restrictionsList.map((res) => {
                  const isActive = res.status === 'ACTIVE';
                  return (
                    <tr key={res.id} className="hover:bg-slate-50/60 transition">
                      <td className="px-6 py-4 font-mono font-bold text-slate-700">
                        #{res.id}
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-900">
                        Room #{res.room_id}
                      </td>
                      <td className="px-6 py-4 text-slate-600 text-xs">
                        <span className="font-semibold text-slate-800 block">
                          {formatDate(res.start_datetime)}
                        </span>
                        {formatTime(res.start_datetime)} – {formatTime(res.end_datetime)} ({formatDuration(res.start_datetime, res.end_datetime)})
                      </td>
                      <td className="px-6 py-4 text-slate-700 max-w-sm truncate text-xs">
                        {res.reason}
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={res.status} size="sm" />
                      </td>
                      <td className="px-6 py-4 text-right">
                        {isActive && (
                          <button
                            onClick={() => {
                              if (
                                window.confirm(
                                  'Lift this restriction? The room will immediately become available for bookings.'
                                )
                              ) {
                                liftMutation.mutate(res.id);
                              }
                            }}
                            className="px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md border border-emerald-200 transition"
                          >
                            Lift Restriction
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
          icon={ShieldAlert}
          title="No restrictions active"
          description="There are currently no temporary administrative blocks applied to AB3 rooms."
        />
      )}

      {/* Create Restriction Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Enforce Temporary Restriction"
      >
        <form onSubmit={handleSaveCreate} className="space-y-4">
          <ErrorBanner error={actionError} />

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Classroom (AB3)
            </label>
            <select
              value={roomId}
              onChange={(e) => setRoomId(Number(e.target.value))}
              className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg bg-white"
            >
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  Room {r.room_number} (Floor {r.floor_number}, Cap: {r.capacity})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Start Time
              </label>
              <input
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                End Date
              </label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                End Time
              </label>
              <input
                type="time"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Reason / Event Name
            </label>
            <textarea
              required
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. End Semester Examinations Hall, University Accreditation Visit"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-hidden"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition"
            >
              {createMutation.isPending ? 'Applying...' : 'Enforce Restriction'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
