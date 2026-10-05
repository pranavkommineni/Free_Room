import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  GraduationCap,
  MapPin,
} from 'lucide-react';
import { timetableApi } from '../../api/timetable';
import {
  formatDate,
  formatTime,
  getCampusToday,
} from '../../utils/datetime';
import { SHORT_WEEKDAYS, WEEKDAYS } from '../../constants';
import { TableSkeleton } from '../../components/LoadingSkeleton';
import { ErrorBanner } from '../../components/ErrorBanner';

export const FacultyTimetable: React.FC = () => {
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());

  const { weekStartStr, weekEndStr, daysOfWeek } = useMemo(() => {
    const d = new Date(currentDate);
    const day = d.getDay();
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

  const {
    data: occurrences,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['timetable', 'faculty', weekStartStr, weekEndStr],
    queryFn: () => timetableApi.getMyTimetable(weekStartStr, weekEndStr),
  });

  const activeOccurrences = useMemo(() => {
    if (!occurrences) return [];
    return occurrences
      .filter((o) => o.start.startsWith(activeDateStr))
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  }, [occurrences, activeDateStr]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Calendar className="w-6 h-6 text-brand-600" />
            Faculty Teaching Timetable
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Your course occurrences, allocated classrooms, and approved schedule changes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setCurrentDate(new Date());
              setActiveDateStr(getCampusToday());
            }}
            className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 shadow-2xs"
          >
            Today
          </button>
          <div className="flex items-center bg-white border border-slate-200 rounded-lg shadow-2xs p-0.5">
            <button
              onClick={() => {
                const prev = new Date(currentDate);
                prev.setDate(prev.getDate() - 7);
                setCurrentDate(prev);
              }}
              className="p-1.5 text-slate-500 hover:text-slate-900 rounded-md hover:bg-slate-100"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-semibold px-2 text-slate-700">
              {formatDate(weekStartStr)} – {formatDate(weekEndStr)}
            </span>
            <button
              onClick={() => {
                const next = new Date(currentDate);
                next.setDate(next.getDate() + 7);
                setCurrentDate(next);
              }}
              className="p-1.5 text-slate-500 hover:text-slate-900 rounded-md hover:bg-slate-100"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {error && <ErrorBanner error={error} onRetry={refetch} />}

      {/* Days of week selector */}
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

      {/* Lectures List for Active Day */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-slate-900">
            Teaching Schedule for {formatDate(activeDateStr)}
          </h3>
          <span className="text-xs text-slate-500 font-medium">
            {activeOccurrences.length} session(s)
          </span>
        </div>

        {isLoading ? (
          <TableSkeleton rows={3} cols={4} />
        ) : activeOccurrences.length > 0 ? (
          <div className="space-y-3">
            {activeOccurrences.map((occ) => {
              const isCancelled = occ.source === 'CANCELLED';
              const isRescheduled = occ.source === 'RESCHEDULED';

              return (
                <div
                  key={occ.slot_id + occ.start}
                  className={`p-4 rounded-xl border transition ${
                    isCancelled
                      ? 'bg-rose-50/50 border-rose-200'
                      : isRescheduled
                      ? 'bg-amber-50/50 border-amber-200'
                      : 'bg-slate-50/50 border-slate-200 hover:bg-white'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
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
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center text-slate-500 text-sm">
            No teaching sessions scheduled for this day.
          </div>
        )}
      </div>
    </div>
  );
};
