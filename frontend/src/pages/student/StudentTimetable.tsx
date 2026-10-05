import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Compass,
  MapPin,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { timetableApi } from '../../api/timetable';
import {
  formatDate,
  formatDuration,
  formatTime,
  getCampusToday,
} from '../../utils/datetime';
import { SHORT_WEEKDAYS, WEEKDAYS } from '../../constants';
import { TableSkeleton } from '../../components/LoadingSkeleton';
import { ErrorBanner } from '../../components/ErrorBanner';

export const StudentTimetable: React.FC = () => {
  const navigate = useNavigate();

  // Selected date for day view and base week
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());

  // Compute Monday of the current week
  const { weekStartStr, weekEndStr, daysOfWeek } = useMemo(() => {
    const d = new Date(currentDate);
    const day = d.getDay(); // 0 is Sunday
    const diffToMonday = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diffToMonday));

    const days = [];
    for (let i = 0; i < 7; i++) {
      const nextDay = new Date(monday);
      nextDay.setDate(monday.getDate() + i);
      const yyyy = nextDay.getFullYear();
      const mm = String(nextDay.getMonth() + 1).padStart(2, '0');
      const dd = String(nextDay.getDate()).padStart(2, '0');
      days.push({
        date: nextDay,
        dateStr: `${yyyy}-${mm}-${dd}`,
        dayName: WEEKDAYS[i],
        shortDay: SHORT_WEEKDAYS[i],
        isToday: `${yyyy}-${mm}-${dd}` === getCampusToday(),
      });
    }

    return {
      weekStartStr: days[0].dateStr,
      weekEndStr: days[6].dateStr,
      daysOfWeek: days,
    };
  }, [currentDate]);

  const [activeDateStr, setActiveDateStr] = useState<string>(getCampusToday());

  // Query weekly schedule from backend
  const {
    data: occurrences,
    isLoading: loadingSchedule,
    error: scheduleError,
    refetch,
  } = useQuery({
    queryKey: ['timetable', 'me', weekStartStr, weekEndStr],
    queryFn: () => timetableApi.getMyTimetable(weekStartStr, weekEndStr),
  });

  // Query free periods for the active selected day
  const { data: freePeriodsData, isLoading: loadingFree } = useQuery({
    queryKey: ['timetable', 'free-periods', activeDateStr],
    queryFn: () => timetableApi.getFreePeriods(activeDateStr),
  });

  // Filter occurrences for the active selected day
  const activeDayOccurrences = useMemo(() => {
    if (!occurrences) return [];
    return occurrences
      .filter((occ) => occ.start.startsWith(activeDateStr))
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  }, [occurrences, activeDateStr]);

  const handlePrevWeek = () => {
    const prev = new Date(currentDate);
    prev.setDate(prev.getDate() - 7);
    setCurrentDate(prev);
  };

  const handleNextWeek = () => {
    const next = new Date(currentDate);
    next.setDate(next.getDate() + 7);
    setCurrentDate(next);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
    setActiveDateStr(getCampusToday());
  };

  return (
    <div className="space-y-6">
      {/* Header & Week Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Calendar className="w-6 h-6 text-brand-600" />
            My Academic Timetable
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Effective schedule including lecture occurrences, cancellations, and reschedules.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleToday}
            className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 shadow-2xs transition"
          >
            Today
          </button>
          <div className="flex items-center bg-white border border-slate-200 rounded-lg shadow-2xs p-0.5">
            <button
              onClick={handlePrevWeek}
              className="p-1.5 text-slate-500 hover:text-slate-900 rounded-md hover:bg-slate-100 transition"
              aria-label="Previous week"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-semibold px-2 text-slate-700">
              {formatDate(weekStartStr)} – {formatDate(weekEndStr)}
            </span>
            <button
              onClick={handleNextWeek}
              className="p-1.5 text-slate-500 hover:text-slate-900 rounded-md hover:bg-slate-100 transition"
              aria-label="Next week"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {scheduleError && <ErrorBanner error={scheduleError} onRetry={refetch} />}

      {/* Week Day Pills */}
      <div className="grid grid-cols-7 gap-2">
        {daysOfWeek.map((d) => {
          const isSelected = d.dateStr === activeDateStr;
          return (
            <button
              key={d.dateStr}
              onClick={() => setActiveDateStr(d.dateStr)}
              className={`p-3 rounded-xl border text-center transition flex flex-col items-center justify-center relative ${
                isSelected
                  ? 'bg-brand-600 border-brand-600 text-white shadow-sm'
                  : d.isToday
                  ? 'bg-brand-50/60 border-brand-200 text-brand-900 hover:bg-brand-100/50'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {d.isToday && !isSelected && (
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-brand-600"></span>
              )}
              <span className={`text-[11px] font-bold uppercase tracking-wider ${isSelected ? 'text-brand-100' : 'text-slate-400'}`}>
                {d.shortDay}
              </span>
              <span className="text-base font-extrabold mt-0.5">
                {d.date.getDate()}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active Day View */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Classes for the Selected Day (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-slate-900">
                Lectures for {formatDate(activeDateStr)}
              </h3>
              <span className="text-xs text-slate-500 font-medium">
                {activeDayOccurrences.length} scheduled item(s)
              </span>
            </div>

            {loadingSchedule ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : activeDayOccurrences.length > 0 ? (
              <div className="space-y-3">
                {activeDayOccurrences.map((occ) => {
                  const isCancelled = occ.source === 'CANCELLED';
                  const isRescheduled = occ.source === 'RESCHEDULED';

                  return (
                    <div
                      key={occ.slot_id + occ.start}
                      className={`p-4 rounded-xl border transition ${
                        isCancelled
                          ? 'bg-rose-50/50 border-rose-200 text-rose-900'
                          : isRescheduled
                          ? 'bg-amber-50/50 border-amber-200 text-amber-900'
                          : 'bg-slate-50/50 border-slate-200 text-slate-900 hover:bg-white'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-800">
                              {occ.course_code}
                            </span>
                            <h4 className="font-bold text-sm">{occ.course_name}</h4>

                            {isCancelled && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded bg-rose-600 text-white uppercase tracking-wider">
                                CANCELLED
                              </span>
                            )}
                            {isRescheduled && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded bg-amber-500 text-white uppercase tracking-wider">
                                RESCHEDULED
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-2">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                              {formatTime(occ.start)} – {formatTime(occ.end)}
                            </span>
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-slate-400" />
                              Room: <strong className="text-slate-700">{occ.room || 'TBD'}</strong>
                            </span>
                          </div>
                        </div>

                        {/* If class was cancelled, show note that room is liberated */}
                        {isCancelled && (
                          <div className="text-right">
                            <span className="text-xs font-medium text-emerald-700 bg-emerald-100 px-2 py-1 rounded-md">
                              Room freed for study
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500 text-sm">
                No classes scheduled for this date.
              </div>
            )}
          </div>
        </div>

        {/* Free Intervals & Period Grid (1 col) */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              Free Intervals
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Gaps between lectures ready for study or room booking.
            </p>

            {loadingFree ? (
              <div className="space-y-2">
                <div className="h-14 bg-slate-100 rounded-lg animate-pulse" />
              </div>
            ) : freePeriodsData?.free_intervals && freePeriodsData.free_intervals.length > 0 ? (
              <div className="space-y-3">
                {freePeriodsData.free_intervals.map((interval, i) => (
                  <div
                    key={i}
                    className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/60 flex flex-col justify-between gap-3"
                  >
                    <div>
                      <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                        FREE WINDOW
                      </span>
                      <p className="font-extrabold text-slate-900 text-base mt-0.5">
                        {formatTime(interval.start)} – {formatTime(interval.end)}
                      </p>
                      <span className="text-xs text-slate-500">
                        {formatDuration(interval.start, interval.end)} duration
                      </span>
                    </div>
                    <button
                      onClick={() =>
                        navigate(
                          `/student/find-rooms?start=${encodeURIComponent(
                            interval.start
                          )}&end=${encodeURIComponent(interval.end)}`
                        )
                      }
                      className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 transition"
                    >
                      <Compass className="w-3.5 h-3.5" /> Find Room
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 text-center py-4">
                No free intervals identified for this day.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
