import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DoorOpen,
  Edit2,
  Filter,
  Layers,
  Plus,
  Projector,
  Search,
  Trash2,
  Users,
  Wind,
} from 'lucide-react';
import { roomsApi } from '../../api/rooms';
import { StatusBadge } from '../../components/StatusBadge';
import { TableSkeleton } from '../../components/LoadingSkeleton';
import { EmptyState } from '../../components/EmptyState';
import { ErrorBanner } from '../../components/ErrorBanner';
import { Modal } from '../../components/Modal';
import type { RoomCreate, RoomOut, RoomUpdate } from '../../types';

export const AdminRooms: React.FC = () => {
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [selectedFloor, setSelectedFloor] = useState<number | ''>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Create & Edit Modal States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<RoomOut | null>(null);
  const [actionError, setActionError] = useState<unknown>(null);

  // Form states for Create/Edit
  const [formFloorId, setFormFloorId] = useState<number>(1);
  const [formRoomNumber, setFormRoomNumber] = useState('');
  const [formCapacity, setFormCapacity] = useState(70);
  const [formType, setFormType] = useState('CLASSROOM');
  const [formHasProjector, setFormHasProjector] = useState(true);
  const [formHasAC, setFormHasAC] = useState(false);
  const [formStudentAccessible, setFormStudentAccessible] = useState(true);
  const [formStatus, setFormStatus] = useState('ACTIVE');

  // Fetch buildings and floors
  const { data: buildings } = useQuery({
    queryKey: ['buildings'],
    queryFn: () => roomsApi.getBuildings(),
  });

  const ab3 = buildings?.find((b) => b.code === 'AB3') || buildings?.[0];
  const floors = ab3?.floors || [];

  // Fetch rooms list
  const {
    data: roomsData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['admin', 'rooms', page, selectedFloor, statusFilter],
    queryFn: () =>
      roomsApi.getRooms({
        page,
        page_size: 20,
        floor_id: selectedFloor ? Number(selectedFloor) : undefined,
        status: statusFilter || undefined,
      }),
  });

  // Create room mutation
  const createMutation = useMutation({
    mutationFn: (data: RoomCreate) => roomsApi.createRoom(data),
    onSuccess: () => {
      setIsCreateOpen(false);
      queryClient.invalidateQueries({ queryKey: ['admin', 'rooms'] });
      queryClient.invalidateQueries({ queryKey: ['availability'] });
    },
    onError: (err) => setActionError(err),
  });

  // Update room mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: RoomUpdate }) =>
      roomsApi.updateRoom(id, data),
    onSuccess: () => {
      setEditingRoom(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'rooms'] });
      queryClient.invalidateQueries({ queryKey: ['availability'] });
    },
    onError: (err) => setActionError(err),
  });

  // Delete / deactivate room mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => roomsApi.deleteRoom(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'rooms'] });
      queryClient.invalidateQueries({ queryKey: ['availability'] });
    },
    onError: (err) => setActionError(err),
  });

  const handleOpenCreate = () => {
    setActionError(null);
    setFormFloorId(floors[0]?.id || 1);
    setFormRoomNumber('');
    setFormCapacity(70);
    setFormType('CLASSROOM');
    setFormHasProjector(true);
    setFormHasAC(false);
    setFormStudentAccessible(true);
    setFormStatus('ACTIVE');
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (room: RoomOut) => {
    setActionError(null);
    setEditingRoom(room);
    setFormRoomNumber(room.room_number);
    setFormCapacity(room.capacity);
    setFormHasProjector(room.has_projector);
    setFormHasAC(room.has_ac);
    setFormStudentAccessible(room.student_accessible);
    setFormStatus(room.status);
  };

  const handleSaveCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      floor_id: formFloorId,
      room_number: formRoomNumber.trim(),
      capacity: Number(formCapacity),
      room_type: formType as any,
      has_projector: formHasProjector,
      has_ac: formHasAC,
      student_accessible: formStudentAccessible,
      status: formStatus as any,
    });
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRoom) return;
    updateMutation.mutate({
      id: editingRoom.id,
      data: {
        room_number: formRoomNumber.trim(),
        capacity: Number(formCapacity),
        has_projector: formHasProjector,
        has_ac: formHasAC,
        student_accessible: formStudentAccessible,
        status: formStatus as any,
      },
    });
  };

  const roomsList = roomsData?.items || [];
  const totalPages = Math.ceil((roomsData?.total ?? 0) / 20);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Layers className="w-6 h-6 text-brand-600" />
            Classroom & Floor Management
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Configure rooms, capacities, and facilities for Academic Block 3.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs transition shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Add Classroom
        </button>
      </div>

      {/* Filter Controls */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-semibold text-slate-600">Floor:</span>
          <select
            value={selectedFloor}
            onChange={(e) => {
              setSelectedFloor(e.target.value ? Number(e.target.value) : '');
              setPage(1);
            }}
            className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-slate-50 focus:ring-brand-500"
          >
            <option value="">All Floors</option>
            {floors.map((f) => (
              <option key={f.id} value={f.id}>
                Floor {f.floor_number}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-600">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-slate-50 focus:ring-brand-500"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
          </select>
        </div>

        <div className="ml-auto text-xs text-slate-500">
          Showing {roomsList.length} of {roomsData?.total ?? 0} total rooms
        </div>
      </div>

      {error && <ErrorBanner error={error} onRetry={refetch} />}

      {/* Rooms Table */}
      {isLoading ? (
        <TableSkeleton rows={8} cols={6} />
      ) : roomsList.length > 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3.5">Room</th>
                  <th className="px-6 py-3.5">Floor</th>
                  <th className="px-6 py-3.5">Capacity</th>
                  <th className="px-6 py-3.5">Facilities</th>
                  <th className="px-6 py-3.5">Student Access</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {roomsList.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/60 transition">
                    <td className="px-6 py-4 font-bold text-slate-900">
                      Room {r.room_number}
                      <span className="text-[11px] font-normal text-slate-400 block">
                        {r.display_name}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      Floor {r.floor_number}
                    </td>
                    <td className="px-6 py-4 text-slate-700 font-semibold">
                      {r.capacity} seats
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-xs">
                        {r.has_projector && (
                          <span className="inline-flex items-center gap-1 text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                            <Projector className="w-3 h-3 text-brand-600" /> Projector
                          </span>
                        )}
                        {r.has_ac && (
                          <span className="inline-flex items-center gap-1 text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                            <Wind className="w-3 h-3 text-blue-600" /> AC
                          </span>
                        )}
                        {!r.has_projector && !r.has_ac && (
                          <span className="text-slate-400 text-xs">Standard</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {r.student_accessible ? (
                        <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          Yes
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                          Faculty Only
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={r.status} size="sm" />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenEdit(r)}
                          className="p-1.5 text-slate-500 hover:text-brand-600 hover:bg-slate-100 rounded-md transition"
                          title="Edit Room"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {r.status === 'ACTIVE' && (
                          <button
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Deactivate Room ${r.room_number}? Future bookings will be safely cancelled.`
                                )
                              ) {
                                deleteMutation.mutate(r.id);
                              }
                            }}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-md transition"
                            title="Deactivate Room"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
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
          title="No classrooms found"
          description="Try adjusting floor or status filters."
        />
      )}

      {/* Create Room Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create New Classroom"
      >
        <form onSubmit={handleSaveCreate} className="space-y-4">
          <ErrorBanner error={actionError} />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Floor
              </label>
              <select
                value={formFloorId}
                onChange={(e) => setFormFloorId(Number(e.target.value))}
                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg bg-white"
              >
                {floors.map((f) => (
                  <option key={f.id} value={f.id}>
                    Floor {f.floor_number}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Room Number
              </label>
              <input
                type="text"
                required
                value={formRoomNumber}
                onChange={(e) => setFormRoomNumber(e.target.value)}
                placeholder="e.g. 305"
                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Capacity
              </label>
              <input
                type="number"
                min={1}
                required
                value={formCapacity}
                onChange={(e) => setFormCapacity(Number(e.target.value))}
                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Room Type
              </label>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option value="CLASSROOM">CLASSROOM</option>
                <option value="LAB">LAB</option>
                <option value="SEMINAR_HALL">SEMINAR_HALL</option>
                <option value="AUDITORIUM">AUDITORIUM</option>
              </select>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-100">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formHasProjector}
                onChange={(e) => setFormHasProjector(e.target.checked)}
                className="rounded border-slate-300 text-brand-600"
              />
              <span className="text-xs font-medium text-slate-700">
                Equipped with Projector
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formHasAC}
                onChange={(e) => setFormHasAC(e.target.checked)}
                className="rounded border-slate-300 text-brand-600"
              />
              <span className="text-xs font-medium text-slate-700">
                Air Conditioned
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formStudentAccessible}
                onChange={(e) => setFormStudentAccessible(e.target.checked)}
                className="rounded border-slate-300 text-brand-600"
              />
              <span className="text-xs font-medium text-slate-700">
                Student Accessible for Free Period Booking
              </span>
            </label>
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
              {createMutation.isPending ? 'Saving...' : 'Create Room'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Room Modal */}
      <Modal
        isOpen={Boolean(editingRoom)}
        onClose={() => setEditingRoom(null)}
        title={`Edit Room ${editingRoom?.room_number || ''}`}
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <ErrorBanner error={actionError} />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Room Number
              </label>
              <input
                type="text"
                required
                value={formRoomNumber}
                onChange={(e) => setFormRoomNumber(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Capacity
              </label>
              <input
                type="number"
                min={1}
                required
                value={formCapacity}
                onChange={(e) => setFormCapacity(Number(e.target.value))}
                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-100">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formHasProjector}
                onChange={(e) => setFormHasProjector(e.target.checked)}
                className="rounded border-slate-300 text-brand-600"
              />
              <span className="text-xs font-medium text-slate-700">Projector</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formHasAC}
                onChange={(e) => setFormHasAC(e.target.checked)}
                className="rounded border-slate-300 text-brand-600"
              />
              <span className="text-xs font-medium text-slate-700">Air Conditioned</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formStudentAccessible}
                onChange={(e) => setFormStudentAccessible(e.target.checked)}
                className="rounded border-slate-300 text-brand-600"
              />
              <span className="text-xs font-medium text-slate-700">Student Accessible</span>
            </label>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Status
            </label>
            <select
              value={formStatus}
              onChange={(e) => setFormStatus(e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg bg-white"
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setEditingRoom(null)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="px-5 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition"
            >
              {updateMutation.isPending ? 'Saving...' : 'Update Room'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
