import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Building,
  Calendar,
  CheckCircle2,
  Clock,
  DoorOpen,
  Layers,
  Projector,
  Shield,
  Users,
  Wind,
  XCircle,
} from 'lucide-react';
import { roomsApi } from '../../api/rooms';
import { availabilityApi } from '../../api/availability';
import { bookingsApi } from '../../api/bookings';
import {
  formatDate,
  formatDuration,
  formatTime,
  getCampusToday,
  toCampusISO,
} from '../../utils/datetime';
import { StatusBadge } from '../../components/StatusBadge';
import { ErrorBanner } from '../../components/ErrorBanner';
import { Modal } from '../../components/Modal';

export const RoomDetails: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const id = Number(roomId);

  // Interval check state
  const [checkDate, setCheckDate] = useState<string>(getCampusToday());
  const [startTime, setStartTime] = useState<string>('10:40');
  const [endTime, setEndTime] = useState<string>('12:20');

  // Booking modal state
  const [bookingOpen, setBookingOpen] = useState(false);
  const [purpose, setPurpose] = useState('');
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [bookingError, setBookingError] = useState<unknown>(null);

  const startISO = toCampusISO(checkDate, startTime);
  const endISO = toCampusISO(checkDate, endTime);

  // Fetch Room Info
  const {
    data: room,
    isLoading: loadingRoom,
    error: roomError,
  } = useQuery({
    queryKey: ['room', id],
    queryFn: () => roomsApi.getRoom(id),
    enabled: !isNaN(id),
  });

  // Check specific availability
  const {
    data: checkData,
    isLoading: loadingCheck,
    error: checkError,
    refetch: refetchCheck,
  } = useQuery({
    queryKey: ['room-check', id, startISO, endISO],
    queryFn: () => availabilityApi.checkRoom(id, startISO, endISO),
    enabled: Boolean(!isNaN(id) && startISO && endISO && startTime < endTime),
  });

  // Booking Mutation
  const bookingMutation = useMutation({
    mutationFn: (data: {
      room_id: number;
      start_datetime: string;
      end_datetime: string;
      purpose?: string;
    }) => bookingsApi.createBooking(data),
    onSuccess: () => {
      setBookingSuccess(true);
      queryClient.invalidateQueries({ queryKey: ['availability'] });
      queryClient.invalidateQueries({ queryKey: ['room-check', id] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (err) => {
      setBookingError(err);
    },
  });

  const handleBook = () => {
    setBookingError(null);
    bookingMutation.mutate({
      room_id: id,
      start_datetime: startISO,
      end_datetime: endISO,
      purpose: purpose.trim() || undefined,
    });
  };

  if (loadingRoom) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-6 bg-slate-200 rounded w-24"></div>
        <div className="h-40 bg-white rounded-2xl border border-slate-200"></div>
        <div className="h-64 bg-white rounded-2xl border border-slate-200"></div>
      </div>
    );
  }

  if (roomError || !room) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <ErrorBanner error={roomError || 'Room not found.'} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div>
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Search
        </button>
      </div>

      {/* Main Room Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-brand-50 text-brand-700 border border-brand-200">
                {room.building_code} · Academic Block 3
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                Floor {room.floor_number}
              </span>
            </div>
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
              Room {room.room_number}
              <StatusBadge status={room.status} size="md" />
            </h2>
            <p className="text-sm text-slate-500 mt-1">{room.display_name}</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setBookingOpen(true);
                setBookingSuccess(false);
                setBookingError(null);
                setPurpose('');
              }}
              disabled={checkData && !checkData.available}
              className="px-5 py-2.5 rounded-xl font-bold text-sm text-white bg-emerald-600 hover:bg-emerald-700 transition shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Book This Room
            </button>
          </div>
        </div>

        {/* Room Specifications Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1 flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-slate-500" /> Capacity
            </span>
            <span className="text-lg font-bold text-slate-900">{room.capacity} Seats</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1 flex items-center gap-1">
              <DoorOpen className="w-3.5 h-3.5 text-slate-500" /> Type
            </span>
            <span className="text-lg font-bold text-slate-900">{room.room_type}</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1 flex items-center gap-1">
              <Projector className="w-3.5 h-3.5 text-slate-500" /> Projector
            </span>
            <span className="text-lg font-bold text-slate-900">
              {room.has_projector ? 'Equipped' : 'None'}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1 flex items-center gap-1">
              <Wind className="w-3.5 h-3.5 text-slate-500" /> Air Conditioning
            </span>
            <span className="text-lg font-bold text-slate-900">
              {room.has_ac ? 'Equipped' : 'Natural Air'}
            </span>
          </div>
        </div>
      </div>

      {/* Real-time Conflict & Availability Inspector */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
        <div>
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-brand-600" />
            Live Interval Inspector
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Test any interval to verify timetable classes, bookings, restrictions, or maintenance.
          </p>
        </div>

        {/* Interval Selector */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Date
            </label>
            <input
              type="date"
              value={checkDate}
              onChange={(e) => setCheckDate(e.target.value)}
              className="block w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Start Time
            </label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="block w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              End Time
            </label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="block w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg bg-white"
            />
          </div>
        </div>

        {/* Availability Result */}
        {loadingCheck ? (
          <div className="p-6 text-center text-slate-400 text-xs">
            Evaluating effective timetable and active bookings...
          </div>
        ) : checkError ? (
          <ErrorBanner error={checkError} onRetry={refetchCheck} />
        ) : checkData ? (
          <div
            className={`p-5 rounded-xl border ${
              checkData.available
                ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                : 'bg-rose-50/70 border-rose-200 text-rose-900'
            }`}
          >
            <div className="flex items-center gap-3">
              {checkData.available ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0" />
              ) : (
                <XCircle className="w-6 h-6 text-rose-600 flex-shrink-0" />
              )}
              <div>
                <h4 className="text-base font-bold">
                  {checkData.available
                    ? 'Room is Available for this Interval!'
                    : 'Room is Occupied or Unavailable'}
                </h4>
                <p className="text-xs mt-0.5 opacity-90">
                  {formatDate(checkDate)} · {formatTime(startISO)} – {formatTime(endISO)} ({formatDuration(startISO, endISO)})
                </p>
              </div>
            </div>

            {/* List Conflicts If Any */}
            {!checkData.available && checkData.conflicts.length > 0 && (
              <div className="mt-4 pt-3 border-t border-rose-200 space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider block">
                  Conflicting Blocker(s):
                </span>
                {checkData.conflicts.map((c, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg bg-white border border-rose-200 text-xs text-rose-800"
                  >
                    <p className="font-semibold">{c.message}</p>
                    {c.start && c.end && (
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {formatTime(c.start)} – {formatTime(c.end)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Booking Modal */}
      <Modal
        isOpen={bookingOpen}
        onClose={() => setBookingOpen(false)}
        title={bookingSuccess ? 'Booking Confirmed' : `Reserve Room ${room.room_number}`}
      >
        {bookingSuccess ? (
          <div className="text-center py-4 space-y-4">
            <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
            <div>
              <h4 className="text-lg font-bold text-slate-900">
                Reservation Confirmed!
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                Room {room.room_number} is reserved for {formatDate(checkDate)} ({formatTime(startISO)} – {formatTime(endISO)}).
              </p>
            </div>
            <button
              onClick={() => {
                setBookingOpen(false);
                navigate('/student/bookings');
              }}
              className="w-full py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition"
            >
              Go to My Bookings
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <ErrorBanner error={bookingError} />

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Room:</span>
                <span className="font-bold text-slate-900">
                  {room.room_number} (Floor {room.floor_number}, AB3)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Date & Time:</span>
                <span className="font-bold text-brand-600">
                  {formatDate(checkDate)} · {formatTime(startISO)} – {formatTime(endISO)}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Purpose of Reservation
              </label>
              <textarea
                rows={2}
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="e.g. Preparing seminar presentation"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-hidden"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setBookingOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={bookingMutation.isPending}
                onClick={handleBook}
                className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition disabled:opacity-50"
              >
                {bookingMutation.isPending ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
