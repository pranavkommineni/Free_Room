import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Calendar,
  Check,
  Clock,
  Compass,
  Filter,
  Info,
  Maximize2,
  Projector,
  Search,
  Sparkles,
  Users,
  Wind,
} from 'lucide-react';
import { availabilityApi } from '../../api/availability';
import { roomsApi } from '../../api/rooms';
import { bookingsApi } from '../../api/bookings';
import {
  formatDate,
  formatDuration,
  formatTime,
  getCampusToday,
  toCampusISO,
} from '../../utils/datetime';
import type { AvailableRoom, RecommendedRoom } from '../../types';
import { StatusBadge } from '../../components/StatusBadge';
import { CardSkeleton } from '../../components/LoadingSkeleton';
import { ErrorBanner } from '../../components/ErrorBanner';
import { Modal } from '../../components/Modal';

export const FindRooms: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Search filter states
  const [selectedDate, setSelectedDate] = useState<string>(getCampusToday());
  const [startTime, setStartTime] = useState<string>('10:40');
  const [endTime, setEndTime] = useState<string>('12:20');
  const [selectedFloor, setSelectedFloor] = useState<number | ''>('');
  const [minCapacity, setMinCapacity] = useState<number | ''>('');
  const [requireProjector, setRequireProjector] = useState<boolean>(false);
  const [requireAC, setRequireAC] = useState<boolean>(false);
  const [showRecommendations, setShowRecommendations] = useState<boolean>(true);

  // Booking Modal State
  const [bookingRoom, setBookingRoom] = useState<AvailableRoom | null>(null);
  const [purpose, setPurpose] = useState<string>('');
  const [bookingSuccess, setBookingSuccess] = useState<boolean>(false);
  const [bookingError, setBookingError] = useState<unknown>(null);

  // Parse query params if navigated with pre-filled interval
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const startParam = params.get('start');
    const endParam = params.get('end');

    if (startParam && endParam) {
      try {
        const startDate = new Date(startParam);
        const endDate = new Date(endParam);
        if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
          // Format date as YYYY-MM-DD in local time
          const yyyy = startDate.getFullYear();
          const mm = String(startDate.getMonth() + 1).padStart(2, '0');
          const dd = String(startDate.getDate()).padStart(2, '0');
          setSelectedDate(`${yyyy}-${mm}-${dd}`);

          const sh = String(startDate.getHours()).padStart(2, '0');
          const sm = String(startDate.getMinutes()).padStart(2, '0');
          setStartTime(`${sh}:${sm}`);

          const eh = String(endDate.getHours()).padStart(2, '0');
          const em = String(endDate.getMinutes()).padStart(2, '0');
          setEndTime(`${eh}:${em}`);
        }
      } catch (err) {
        console.warn('Could not parse interval params:', err);
      }
    }
  }, [location.search]);

  // Construct ISO strings
  const startISO = useMemo(
    () => toCampusISO(selectedDate, startTime),
    [selectedDate, startTime]
  );
  const endISO = useMemo(
    () => toCampusISO(selectedDate, endTime),
    [selectedDate, endTime]
  );

  // Fetch Buildings & Floors
  const { data: buildings } = useQuery({
    queryKey: ['buildings'],
    queryFn: () => roomsApi.getBuildings(),
  });

  const ab3Building = buildings?.find((b) => b.code === 'AB3') || buildings?.[0];
  const availableFloors = ab3Building?.floors || [];

  // Query Availability API
  const {
    data: availabilityData,
    isLoading: loadingAvailability,
    error: availabilityError,
    refetch: refetchAvailability,
  } = useQuery({
    queryKey: [
      'availability',
      startISO,
      endISO,
      selectedFloor,
      minCapacity,
      requireProjector,
      requireAC,
    ],
    queryFn: () =>
      availabilityApi.searchAvailable({
        start_datetime: startISO,
        end_datetime: endISO,
        floor_id: selectedFloor ? Number(selectedFloor) : undefined,
        minimum_capacity: minCapacity ? Number(minCapacity) : undefined,
        has_projector: requireProjector || undefined,
        has_ac: requireAC || undefined,
      }),
    enabled: Boolean(startISO && endISO && startTime < endTime),
  });

  // Query Recommendations API (when enabled)
  const { data: recommendationsData } = useQuery({
    queryKey: [
      'recommendations',
      startISO,
      endISO,
      minCapacity,
      requireProjector,
      requireAC,
    ],
    queryFn: () =>
      availabilityApi.getRecommendations({
        start_datetime: startISO,
        end_datetime: endISO,
        expected_attendance: minCapacity ? Number(minCapacity) : undefined,
        has_projector: requireProjector,
        has_ac: requireAC,
        limit: 10,
      }),
    enabled: Boolean(
      showRecommendations && startISO && endISO && startTime < endTime
    ),
  });

  // Map recommended rooms for badge lookup
  const recommendationScores = useMemo(() => {
    const map = new Map<number, RecommendedRoom>();
    if (recommendationsData?.rooms) {
      recommendationsData.rooms.forEach((r) => map.set(r.room_id, r));
    }
    return map;
  }, [recommendationsData]);

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
      // Invalidate queries according to master architecture
      queryClient.invalidateQueries({ queryKey: ['availability'] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (err) => {
      setBookingError(err);
    },
  });

  const handleOpenBooking = (room: AvailableRoom) => {
    setBookingRoom(room);
    setPurpose('');
    setBookingSuccess(false);
    setBookingError(null);
  };

  const handleConfirmBooking = () => {
    if (!bookingRoom) return;
    setBookingError(null);
    bookingMutation.mutate({
      room_id: bookingRoom.room_id,
      start_datetime: startISO,
      end_datetime: endISO,
      purpose: purpose.trim() || undefined,
    });
  };

  const roomsList = availabilityData?.rooms || [];

  return (
    <div className="space-y-6">
      {/* Title & Overview */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Compass className="w-6 h-6 text-brand-600" />
            Find Free Classrooms
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Search 77 classrooms in Academic Block 3 for your free periods.
          </p>
        </div>

        <button
          onClick={() => setShowRecommendations(!showRecommendations)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
            showRecommendations
              ? 'bg-brand-50 border-brand-300 text-brand-700 shadow-2xs'
              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-brand-600" />
          Smart Recommendations {showRecommendations ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* Filter Control Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Date Picker */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-brand-600" /> Date
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="block w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-hidden bg-slate-50/50"
            />
          </div>

          {/* Start Time */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-brand-600" /> Start Time
            </label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="block w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-hidden bg-slate-50/50"
            />
          </div>

          {/* End Time */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-brand-600" /> End Time
            </label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="block w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-hidden bg-slate-50/50"
            />
          </div>

          {/* Floor Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-brand-600" /> Floor
            </label>
            <select
              value={selectedFloor}
              onChange={(e) =>
                setSelectedFloor(e.target.value ? Number(e.target.value) : '')
              }
              className="block w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-hidden bg-slate-50/50"
            >
              <option value="">All 7 Floors</option>
              {availableFloors.map((f) => (
                <option key={f.id} value={f.id}>
                  Floor {f.floor_number}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Secondary Facilities & Capacity Row */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4 text-sm">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-semibold text-slate-700">Min Capacity:</span>
              <input
                type="number"
                min={1}
                max={150}
                placeholder="Any"
                value={minCapacity}
                onChange={(e) =>
                  setMinCapacity(e.target.value ? Number(e.target.value) : '')
                }
                className="w-20 px-2 py-1 text-xs border border-slate-300 rounded-md focus:ring-brand-500 focus:outline-hidden"
              />
            </div>

            <label className="inline-flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={requireProjector}
                onChange={(e) => setRequireProjector(e.target.checked)}
                className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              <span className="text-xs font-medium text-slate-700 flex items-center gap-1">
                <Projector className="w-3.5 h-3.5 text-slate-500" /> Projector
              </span>
            </label>

            <label className="inline-flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={requireAC}
                onChange={(e) => setRequireAC(e.target.checked)}
                className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              <span className="text-xs font-medium text-slate-700 flex items-center gap-1">
                <Wind className="w-3.5 h-3.5 text-slate-500" /> Air Conditioning
              </span>
            </label>
          </div>

          <button
            onClick={() => refetchAvailability()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs transition shadow-xs"
          >
            <Search className="w-3.5 h-3.5" />
            Apply Filters
          </button>
        </div>
      </div>

      {/* Result Status Banner */}
      <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <p className="text-sm font-bold text-slate-900">
            {availabilityData?.total_available ?? 0} rooms available
          </p>
          <span className="text-slate-400">·</span>
          <p className="text-sm font-semibold text-emerald-800">
            {formatTime(startISO)} – {formatTime(endISO)}
          </p>
          <span className="text-xs text-slate-500">
            ({formatDuration(startISO, endISO)})
          </span>
        </div>
        <p className="text-xs text-slate-500 font-medium">
          Date: {formatDate(selectedDate)}
        </p>
      </div>

      {availabilityError && <ErrorBanner error={availabilityError} onRetry={refetchAvailability} />}

      {/* Rooms Grid */}
      {loadingAvailability ? (
        <CardSkeleton count={6} />
      ) : roomsList.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {roomsList.map((room) => {
            const recommendation = recommendationScores.get(room.room_id);

            return (
              <div
                key={room.room_id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:shadow-md transition flex flex-col justify-between relative group"
              >
                {/* Recommendation Badge */}
                {recommendation && (
                  <div className="absolute -top-2.5 right-4 z-10">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-400 text-amber-950 shadow-xs">
                      <Sparkles className="w-3 h-3 text-amber-900" />
                      Recommended ({Math.round(recommendation.score * 100)}%)
                    </span>
                  </div>
                )}

                <div>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">
                          Room {room.room_number}
                        </h3>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          Floor {room.floor}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {room.display_name} · AB3
                      </p>
                    </div>
                    <StatusBadge status="AVAILABLE" size="sm" />
                  </div>

                  {/* Room Details & Facilities */}
                  <div className="grid grid-cols-2 gap-2 my-3 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      <span>Capacity: <strong className="text-slate-800">{room.capacity}</strong></span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Projector className="w-3.5 h-3.5 text-slate-400" />
                      <span>Projector: <strong>{room.has_projector ? 'Yes' : 'No'}</strong></span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Wind className="w-3.5 h-3.5 text-slate-400" />
                      <span>AC: <strong>{room.has_ac ? 'Yes' : 'No'}</strong></span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span>Access: <strong>Students</strong></span>
                    </div>
                  </div>

                  {/* Available Until */}
                  <div className="text-xs text-slate-500 flex items-center justify-between">
                    <span>Available until:</span>
                    <span className="font-semibold text-slate-800">
                      {formatTime(room.available_until)}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2">
                  <button
                    onClick={() => navigate(`/student/rooms/${room.room_id}`)}
                    className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition text-center"
                  >
                    View Details
                  </button>
                  <button
                    onClick={() => handleOpenBooking(room)}
                    className="flex-1 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs text-center"
                  >
                    Book Room
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-lg mx-auto">
          <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4">
            <Info className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-1">
            No classrooms free for this exact interval
          </h3>
          <p className="text-xs text-slate-500 mb-6">
            All rooms are currently occupied by recurring lectures, approved schedule changes, or bookings. Try adjusting your interval or floor filter.
          </p>
          <button
            onClick={() => {
              setStartTime('13:00');
              setEndTime('13:50');
              setSelectedFloor('');
            }}
            className="text-xs font-semibold text-brand-600 hover:text-brand-700 hover:underline"
          >
            Check Lunch Period (1:00 PM – 1:50 PM)
          </button>
        </div>
      )}

      {/* Booking Modal */}
      <Modal
        isOpen={Boolean(bookingRoom)}
        onClose={() => setBookingRoom(null)}
        title={
          bookingSuccess
            ? 'Booking Confirmed'
            : `Book Room ${bookingRoom?.room_number || ''}`
        }
      >
        {bookingSuccess ? (
          <div className="text-center py-4 space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <Check className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-lg font-bold text-slate-900">
                Reservation Successful!
              </h4>
              <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                Room {bookingRoom?.room_number} is reserved for {formatDate(selectedDate)} ({formatTime(startISO)} – {formatTime(endISO)}).
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setBookingRoom(null)}
                className="flex-1 py-2 px-3 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
              >
                Keep Searching
              </button>
              <button
                onClick={() => {
                  setBookingRoom(null);
                  navigate('/student/bookings');
                }}
                className="flex-1 py-2 px-3 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition"
              >
                View My Bookings
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <ErrorBanner error={bookingError} />

            {/* Room Info Summary */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
              <div className="flex justify-between font-medium">
                <span className="text-slate-500">Classroom:</span>
                <span className="font-bold text-slate-900">
                  {bookingRoom?.room_number} (Floor {bookingRoom?.floor}, AB3)
                </span>
              </div>
              <div className="flex justify-between font-medium">
                <span className="text-slate-500">Date:</span>
                <span className="text-slate-800">{formatDate(selectedDate)}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span className="text-slate-500">Interval:</span>
                <span className="font-bold text-brand-600">
                  {formatTime(startISO)} – {formatTime(endISO)} ({formatDuration(startISO, endISO)})
                </span>
              </div>
              <div className="flex justify-between font-medium">
                <span className="text-slate-500">Capacity:</span>
                <span className="text-slate-800">{bookingRoom?.capacity} seats</span>
              </div>
            </div>

            {/* Purpose Input */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Booking Purpose (Optional)
              </label>
              <textarea
                rows={2}
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="e.g. Group study for Database Systems, project discussion"
                className="block w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-hidden"
                maxLength={500}
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Max 500 characters. Visible to campus administrators.
              </p>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setBookingRoom(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={bookingMutation.isPending}
                onClick={handleConfirmBooking}
                className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition shadow-xs disabled:opacity-50"
              >
                {bookingMutation.isPending ? 'Verifying Lock...' : 'Confirm Reservation'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
