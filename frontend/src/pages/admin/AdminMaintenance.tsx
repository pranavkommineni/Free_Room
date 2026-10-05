import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Calendar,
  Clock,
  DoorOpen,
  Plus,
  Trash2,
  Wrench,
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
import type { MaintenanceCreate, MaintenanceOut } from '../../types';

export const AdminMaintenance: React.FC = () => {
  const queryClient = useQueryClient();
  const todayStr = getCampusToday();

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');

  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [actionError, setActionError] = useState<unknown>(null);

  // Form states
  const [roomId, setRoomId] = useState<number>(1);
  const [startDate, setStartDate] = useState(todayStr);
  const [startTime, setStartTime] = useState('08:00');
  const [endDate, setEndDate] = useState(todayStr);
  const [endTime, setEndTime] = useState('17:00');
  const [reason, setReason] = useState('');

  // Fetch maintenance list
  const {
    data: maintenanceData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['admin', 'maintenance', page, statusFilter],
    queryFn: () =>
      maintenanceApi.getMaintenanceList({
        page,
        page_size: 25,
        status: statusFilter || undefined,
      }),
  });

  // Fetch rooms list for picker
  const { data: roomsData } = useQuery({
    queryKey: ['rooms', 'admin-all'],
    queryFn: () => roomsApi.getRooms({ page_size: 100 }),
  });

  // Create maintenance mutation
  const createMutation = useMutation({
    mutationFn: (data: MaintenanceCreate) =>
      maintenanceApi.createMaintenance(data),
    onSuccess: () => {
      setIsCreateOpen(false);
      queryClient.invalidateQueries({ queryKey: ['admin', 'maintenance'] });
      queryClient.invalidateQueries({ queryKey: ['availability'] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
    onError: (err) => setActionError(err),
  });

  // Cancel maintenance mutation
  const cancelMutation = useMutation({
    mutationFn: (id: number) => maintenanceApi.cancelMaintenance(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'maintenance'] });
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

  const maintenanceList = maintenanceData?.items || [];
  const rooms = roomsData?.items || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Wrench className="w-6 h-6 text-brand-600" />
            Classroom Maintenance
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Schedule repairs, equipment maintenance, and facility upgrades in AB3.
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
          Schedule Maintenance
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        {['', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].map((st) => (
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
            {st === '' ? 'All Maintenance' : st}
          </button>
        ))}
      </div>

      {error && <ErrorBanner error={error} onRetry={refetch} />}

      {isLoading ? (
        <TableSkeleton rows={6} cols={5} />
      ) : maintenanceList.length > 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3.5">ID</th>
                  <th className="px-6 py-3.5">Room</th>
                  <th className="px-6 py-3.5">Interval</th>
                  <th className="px-6 py-3.5">Reason</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {maintenanceList.map((m) => {
                  const isActive =
                    m.status === 'SCHEDULED' || m.status === 'IN_PROGRESS';
                  return (
                    <tr key={m.id} className="hover:bg-slate-50/60 transition">
                      <td className="px-6 py-4 font-mono font-bold text-slate-700">
                        #{m.id}
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-900">
                        Room #{m.room_id}
                      </td>
                      <td className="px-6 py-4 text-slate-600 text-xs">
                        <span className="font-semibold text-slate-800 block">
                          {formatDate(m.start_datetime)}
                        </span>
                        {formatTime(m.start_datetime)} – {formatTime(m.end_datetime)} ({formatDuration(m.start_datetime, m.end_datetime)})
                      </td>
                      <td className="px-6 py-4 text-slate-700 max-w-sm truncate text-xs">
                        {m.reason}
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={m.status} size="sm" />
                      </td>
                      <td className="px-6 py-4 text-right">
                        {isActive && (
                          <button
                            onClick={() => {
                              if (window.confirm('Cancel this maintenance period?')) {
                                cancelMutation.mutate(m.id);
                              }
                            }}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-800 p-1 hover:bg-rose-50 rounded-md"
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
          icon={Wrench}
          title="No maintenance scheduled"
          description="All classrooms are operational and clear of maintenance blocks."
        />
      )}

      {/* Create Maintenance Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Schedule Classroom Maintenance"
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
              Maintenance Reason
            </label>
            <textarea
              required
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Projector bulb replacement, electrical repairs"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-hidden"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Scheduling maintenance automatically cancels overlapping student bookings and notifies owners.
            </p>
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
              className="px-5 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition"
            >
              {createMutation.isPending ? 'Scheduling...' : 'Confirm Maintenance'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
