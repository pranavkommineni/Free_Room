import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  FileText,
  Filter,
  Plus,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import { adminApi } from '../../api/admin';
import { timetableApi } from '../../api/timetable';
import { roomsApi } from '../../api/rooms';
import { WEEKDAYS } from '../../constants';
import { formatTime } from '../../utils/datetime';
import { TableSkeleton } from '../../components/LoadingSkeleton';
import { EmptyState } from '../../components/EmptyState';
import { ErrorBanner } from '../../components/ErrorBanner';
import { Modal } from '../../components/Modal';
import type { ImportPreview, SlotCreate, SlotOut } from '../../types';

export const AdminTimetable: React.FC = () => {
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'slots' | 'import'>('slots');
  const [selectedDay, setSelectedDay] = useState<number | ''>('');

  // CSV Import States
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importError, setImportError] = useState<unknown>(null);
  const [importSuccessMsg, setImportSuccessMsg] = useState<string | null>(null);

  // Create Slot Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [slotError, setSlotError] = useState<unknown>(null);
  const [courseId, setCourseId] = useState<number>(1);
  const [facultyId, setFacultyId] = useState<number>(1);
  const [roomId, setRoomId] = useState<number>(1);
  const [sectionId, setSectionId] = useState<number>(1);
  const [dayOfWeek, setDayOfWeek] = useState<number>(0);
  const [periodNumber, setPeriodNumber] = useState<number>(1);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('08:50');
  const [academicYear, setAcademicYear] = useState('2026-27');
  const [semester, setSemester] = useState('WINTER');

  // Fetch slots
  const {
    data: slotsData,
    isLoading: loadingSlots,
    error: slotsError,
    refetch: refetchSlots,
  } = useQuery({
    queryKey: ['admin', 'slots', selectedDay],
    queryFn: () =>
      timetableApi.getSlots({
        day_of_week: selectedDay !== '' ? Number(selectedDay) : undefined,
        page_size: 50,
      }),
  });

  // Fetch references
  const { data: coursesData } = useQuery({
    queryKey: ['admin', 'courses'],
    queryFn: () => adminApi.getCourses(1, 100),
  });
  const { data: sectionsData } = useQuery({
    queryKey: ['admin', 'sections'],
    queryFn: () => adminApi.getSections(1, 100),
  });
  const { data: roomsData } = useQuery({
    queryKey: ['rooms', 'admin-all'],
    queryFn: () => roomsApi.getRooms({ page_size: 100 }),
  });

  // Import Preview Mutation
  const previewMutation = useMutation({
    mutationFn: (file: File) => adminApi.importTimetablePreview(file),
    onSuccess: (data) => {
      setImportPreview(data);
      setImportError(null);
    },
    onError: (err) => setImportError(err),
  });

  // Confirm Import Mutation
  const confirmMutation = useMutation({
    mutationFn: ({
      importId,
      allowPartial,
    }: {
      importId: number;
      allowPartial: boolean;
    }) => adminApi.confirmTimetableImport(importId, allowPartial),
    onSuccess: (res) => {
      setImportSuccessMsg(
        `Import completed successfully: ${res.inserted} slots inserted, ${res.skipped} skipped.`
      );
      setImportPreview(null);
      setSelectedFile(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'slots'] });
      queryClient.invalidateQueries({ queryKey: ['timetable'] });
      queryClient.invalidateQueries({ queryKey: ['availability'] });
    },
    onError: (err) => setImportError(err),
  });

  // Create slot mutation
  const createSlotMutation = useMutation({
    mutationFn: (data: SlotCreate) => timetableApi.createSlot(data),
    onSuccess: () => {
      setIsCreateOpen(false);
      queryClient.invalidateQueries({ queryKey: ['admin', 'slots'] });
      queryClient.invalidateQueries({ queryKey: ['timetable'] });
      queryClient.invalidateQueries({ queryKey: ['availability'] });
    },
    onError: (err) => setSlotError(err),
  });

  // Deactivate slot mutation
  const deleteSlotMutation = useMutation({
    mutationFn: (id: number) => timetableApi.deleteSlot(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'slots'] });
      queryClient.invalidateQueries({ queryKey: ['timetable'] });
      queryClient.invalidateQueries({ queryKey: ['availability'] });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setImportSuccessMsg(null);
      previewMutation.mutate(file);
    }
  };

  const handleSaveSlot = (e: React.FormEvent) => {
    e.preventDefault();
    setSlotError(null);
    createSlotMutation.mutate({
      course_id: courseId,
      faculty_id: facultyId,
      room_id: roomId,
      section_id: sectionId,
      day_of_week: dayOfWeek,
      period_number: periodNumber,
      start_time: `${startTime}:00`,
      end_time: `${endTime}:00`,
      academic_year: academicYear,
      semester: semester,
    });
  };

  const slotsList = slotsData?.items || [];
  const courses = coursesData?.items || [];
  const sections = sectionsData?.items || [];
  const rooms = roomsData?.items || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-brand-600" />
            Timetable Operations
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage recurring timetable slots and import academic schedules via CSV.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('slots')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'slots'
                ? 'bg-brand-600 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            Recurring Slots
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'import'
                ? 'bg-brand-600 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            CSV Timetable Import
          </button>
        </div>
      </div>

      {/* Tab 1: Slots Management */}
      {activeTab === 'slots' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-semibold text-slate-600">Day:</span>
              <select
                value={selectedDay}
                onChange={(e) =>
                  setSelectedDay(e.target.value ? Number(e.target.value) : '')
                }
                className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-slate-50"
              >
                <option value="">All Weekdays</option>
                {WEEKDAYS.map((name, i) => (
                  <option key={i} value={i}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => {
                setSlotError(null);
                if (courses[0]) setCourseId(courses[0].id);
                if (sections[0]) setSectionId(sections[0].id);
                if (rooms[0]) setRoomId(rooms[0].id);
                setIsCreateOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs transition shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Recurring Slot
            </button>
          </div>

          {slotsError && <ErrorBanner error={slotsError} onRetry={refetchSlots} />}

          {loadingSlots ? (
            <TableSkeleton rows={6} cols={6} />
          ) : slotsList.length > 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-3.5">Day & Period</th>
                      <th className="px-6 py-3.5">Time</th>
                      <th className="px-6 py-3.5">Room</th>
                      <th className="px-6 py-3.5">Course ID</th>
                      <th className="px-6 py-3.5">Section ID</th>
                      <th className="px-6 py-3.5">Term</th>
                      <th className="px-6 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {slotsList.map((slot) => (
                      <tr key={slot.id} className="hover:bg-slate-50/60 transition">
                        <td className="px-6 py-4 font-bold text-slate-900">
                          {WEEKDAYS[slot.day_of_week]} · Period {slot.period_number}
                        </td>
                        <td className="px-6 py-4 text-slate-600 font-mono text-xs">
                          {formatTime(slot.start_time)} – {formatTime(slot.end_time)}
                        </td>
                        <td className="px-6 py-4 font-semibold text-brand-600">
                          Room #{slot.room_id}
                        </td>
                        <td className="px-6 py-4 text-slate-600">
                          Course #{slot.course_id}
                        </td>
                        <td className="px-6 py-4 text-slate-600">
                          Section #{slot.section_id}
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-500">
                          {slot.academic_year} · {slot.semester}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => {
                              if (window.confirm('Deactivate this recurring slot?')) {
                                deleteSlotMutation.mutate(slot.id);
                              }
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition"
                            title="Deactivate slot"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <EmptyState
              icon={FileText}
              title="No timetable slots found"
              description="Add slots manually or use the CSV Timetable Import to batch load."
            />
          )}
        </div>
      )}

      {/* Tab 2: CSV Timetable Import Flow */}
      {activeTab === 'import' && (
        <div className="space-y-6">
          {importSuccessMsg && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <p className="text-sm font-semibold">{importSuccessMsg}</p>
            </div>
          )}

          <ErrorBanner error={importError} />

          {/* Upload Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center max-w-2xl mx-auto shadow-xs">
            <div className="w-14 h-14 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mx-auto mb-4 border border-brand-100">
              <UploadCloud className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">
              Upload Timetable CSV
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-6">
              Required columns: <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">course_code, faculty, room, day, period, start_time, end_time, section, academic_year, semester</code>
            </p>

            <label className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm cursor-pointer shadow-sm transition">
              <FileSpreadsheet className="w-4 h-4" />
              Select CSV File
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>

            {previewMutation.isPending && (
              <p className="text-xs text-slate-400 mt-4 animate-pulse">
                Parsing CSV and validating database integrity...
              </p>
            )}
          </div>

          {/* Staged Import Preview */}
          {importPreview && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">
                    Import Staging Review
                  </span>
                  <h3 className="text-xl font-extrabold text-slate-900">
                    {importPreview.filename}
                  </h3>
                </div>

                <div className="flex items-center gap-4 text-xs font-semibold">
                  <span className="text-slate-600">
                    Total: <strong>{importPreview.total_rows}</strong>
                  </span>
                  <span className="text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200">
                    Valid: {importPreview.valid_rows}
                  </span>
                  <span
                    className={`px-2 py-1 rounded-md border ${
                      importPreview.error_count > 0
                        ? 'text-rose-700 bg-rose-50 border-rose-200'
                        : 'text-slate-500 bg-slate-50 border-slate-200'
                    }`}
                  >
                    Errors: {importPreview.error_count}
                  </span>
                </div>
              </div>

              {/* Error Breakdown If Any */}
              {importPreview.errors.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-rose-700 font-bold text-sm">
                    <AlertTriangle className="w-4 h-4" />
                    Validation Conflicts Detected ({importPreview.errors.length}):
                  </div>
                  <div className="max-h-60 overflow-y-auto border border-rose-200 rounded-xl divide-y divide-rose-100 bg-rose-50/30">
                    {importPreview.errors.map((err, idx) => (
                      <div key={idx} className="p-3 text-xs flex items-start gap-3">
                        <span className="font-mono font-bold text-rose-900 bg-rose-100 px-1.5 py-0.5 rounded">
                          Row {err.row}
                        </span>
                        <div>
                          <p className="font-semibold text-rose-800">
                            {err.message}
                          </p>
                          {err.field && (
                            <span className="text-[11px] text-slate-500">
                              Field: {err.field} · Code: {err.code}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-3 text-emerald-900">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                  <p className="text-sm font-semibold">
                    All {importPreview.total_rows} rows passed validation with zero conflicts!
                  </p>
                </div>
              )}

              {/* Confirm Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  onClick={() => setImportPreview(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
                >
                  Discard
                </button>

                {importPreview.error_count > 0 && importPreview.valid_rows > 0 && (
                  <button
                    disabled={confirmMutation.isPending}
                    onClick={() =>
                      confirmMutation.mutate({
                        importId: importPreview.import_id,
                        allowPartial: true,
                      })
                    }
                    className="px-4 py-2 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-lg transition"
                  >
                    Commit Valid Rows Only ({importPreview.valid_rows})
                  </button>
                )}

                <button
                  disabled={
                    confirmMutation.isPending ||
                    (!importPreview.can_commit && importPreview.error_count > 0)
                  }
                  onClick={() =>
                    confirmMutation.mutate({
                      importId: importPreview.import_id,
                      allowPartial: false,
                    })
                  }
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition disabled:opacity-40"
                >
                  {confirmMutation.isPending ? 'Committing...' : 'Confirm & Commit All'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create Slot Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create Recurring Timetable Slot"
      >
        <form onSubmit={handleSaveSlot} className="space-y-4">
          <ErrorBanner error={slotError} />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Course
              </label>
              <select
                value={courseId}
                onChange={(e) => setCourseId(Number(e.target.value))}
                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg bg-white"
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.course_code} - {c.course_name}
                  </option>
                ))}
              </select>
            </div>
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
                    Room {r.room_number} (Floor {r.floor_number})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Day of Week
              </label>
              <select
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(Number(e.target.value))}
                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg bg-white"
              >
                {WEEKDAYS.map((w, idx) => (
                  <option key={idx} value={idx}>
                    {w}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Period Number
              </label>
              <input
                type="number"
                min={1}
                max={12}
                value={periodNumber}
                onChange={(e) => setPeriodNumber(Number(e.target.value))}
                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Start Time
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                End Time
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
              />
            </div>
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
              disabled={createSlotMutation.isPending}
              className="px-5 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition"
            >
              {createSlotMutation.isPending ? 'Creating...' : 'Create Slot'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
