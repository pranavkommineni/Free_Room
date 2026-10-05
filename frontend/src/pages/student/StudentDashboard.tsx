import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Compass,
  DoorOpen,
  GraduationCap,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { timetableApi } from '../../api/timetable';
import { bookingsApi } from '../../api/bookings';
import { availabilityApi } from '../../api/availability';
import {
  formatDate,
  formatDuration,
  formatTime,
  getCampusToday,
} from '../../utils/datetime';
import { StatusBadge } from '../../components/StatusBadge';
import { CardSkeleton, StatSkeleton } from '../../components/LoadingSkeleton';
import { ErrorBanner } from '../../components/ErrorBanner';

export const StudentDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const todayStr = getCampusToday();

  // 1. Fetch today's effective classes
  const {
    data: todayClasses,
    isLoading: loadingClasses,
    error: classesError,
  } = useQuery({
    queryKey: ['timetable', 'me', todayStr],
    queryFn: () => timetableApi.getMyTimetable(todayStr, todayStr),
  });

  // 2. Fetch free periods detection
  const {
    data: freePeriodsData,
    isLoading: loadingFree,
    error: freeError,
  } = useQuery({
    queryKey: ['timetable', 'free-periods', todayStr],
    queryFn: () => timetableApi.getFreePeriods(todayStr),
  });

  // 3. Fetch upcoming student bookings
  const {
    data: bookingsData,
    isLoading: loadingBookings,
  } = useQuery({
    queryKey: ['bookings', 'mine', 'upcoming'],
    queryFn: () => bookingsApi.getBookings({ mine: true, status: 'CONFIRMED' }),
  });

  // Determine current class status & next class
  const { currentClass, nextClass, isCurrentlyFree, currentFreeInterval } =
    useMemo(() => {
      const nowMs = new Date().getTime();
      let current = null;
      let next = null;

      if (todayClasses && todayClasses.length > 0) {
        // Sort by start time
        const sorted = [...todayClasses].sort(
          (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
        );

        for (const occ of sorted) {
          const start = new Date(occ.start).getTime();
          const end = new Date(occ.end).getTime();
          if (nowMs >= start && nowMs < end) {
            current = occ;
          } else if (start > nowMs && !next) {
            next = occ;
          }
        }
      }

      // Check if current time falls in a free interval
      let freeNow = false;
      let freeInterval = null;
      if (freePeriodsData?.free_intervals) {
        for (const interval of freePeriodsData.free_intervals) {
          const start = new Date(interval.start).getTime();
          const end = new Date(interval.end).getTime();
          if (nowMs >= start && nowMs < end) {
            freeNow = true;
            freeInterval = interval;
            break;
          }
        }
      }

      return {
        currentClass: current,
        nextClass: next,
        isCurrentlyFree: freeNow,
        currentFreeInterval: freeInterval,
      };
    }, [todayClasses, freePeriodsData]);

  const handleFindRoomForInterval = (start: string, end: string) => {
    navigate(
      `/student/find-rooms?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`
    );
  };

  return (
    <div className="space-y-8">
      {/* Welcome & Live Status Header */}
      <div className="bg-gradient-to-r from-brand-900 via-indigo-900 to-slate-900 rounded-2xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/20 text-brand-200 border border-brand-400/20 text-xs font-semibold uppercase tracking-wider mb-3">
              <GraduationCap className="w-3.5 h-3.5" />
              VIT Chennai · Academic Block 3
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              Hello, {user?.name?.split(' ')[0] || 'Student'}!
            </h2>
            <p className="text-slate-300 text-sm mt-1 max-w-xl">
              {formatDate(new Date().toISOString())} · Real-time schedule and classroom availability engine.
            </p>
          </div>

          {/* Quick Action Button */}
          <button
            onClick={() => navigate('/student/find-rooms')}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/20 transition transform active:scale-95"
          >
            <Compass className="w-4 h-4" />
            Find Empty Classrooms
          </button>
        </div>
      </div>

      {/* Hero: Active Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Current Class / Status Card */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-brand-600" />
                Current Status
              </span>
              {currentClass ? (
                <StatusBadge status="OCCUPIED" />
              ) : isCurrentlyFree ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  <Sparkles className="w-3 h-3 mr-1 text-emerald-600" /> Free Now
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                  Between Intervals
                </span>
              )}
            </div>

            {loadingClasses ? (
              <div className="h-16 bg-slate-100 rounded-lg animate-pulse" />
            ) : currentClass ? (
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {currentClass.course_name}
                </h3>
                <p className="text-sm font-medium text-brand-600">
                  {currentClass.course_code} · Room {currentClass.room || 'TBD'}
                </p>
                <p className="text-xs text-slate-500 mt-2">
                  {formatTime(currentClass.start)} – {formatTime(currentClass.end)}
                </p>
              </div>
            ) : isCurrentlyFree && currentFreeInterval ? (
              <div>
                <h3 className="text-lg font-bold text-emerald-700">
                  You are in a Free Period
                </h3>
                <p className="text-sm text-slate-600 mt-1">
                  Free until {formatTime(currentFreeInterval.end)} ({formatDuration(new Date().toISOString(), currentFreeInterval.end)} left)
                </p>
                <div className="mt-3">
                  <button
                    onClick={() =>
                      handleFindRoomForInterval(
                        new Date().toISOString(),
                        currentFreeInterval.end
                      )
                    }
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 rounded-lg transition shadow-xs"
                  >
                    Find a Room Right Now <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <h3 className="text-base font-semibold text-slate-800">
                  No active class right now
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Enjoy your time or locate a quiet study classroom in AB3.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Next Scheduled Class Card */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-electric-600" />
                Up Next Today
              </span>
              {nextClass && <StatusBadge status="PENDING" />}
            </div>

            {loadingClasses ? (
              <div className="h-16 bg-slate-100 rounded-lg animate-pulse" />
            ) : nextClass ? (
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {nextClass.course_name}
                </h3>
                <p className="text-sm font-medium text-electric-600">
                  {nextClass.course_code} · Room {nextClass.room || 'TBD'}
                </p>
                <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  Starts at {formatTime(nextClass.start)} ({formatTime(nextClass.start)} – {formatTime(nextClass.end)})
                </p>
              </div>
            ) : (
              <div>
                <h3 className="text-base font-semibold text-slate-800">
                  No more classes scheduled today
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  You are all done with lectures for the rest of today!
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Priority Section: Automatically Identified Free Periods */}
      <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-brand-600" />
              Identified Free Periods Today
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Computed automatically from your registered section timetable and approved changes.
            </p>
          </div>
        </div>

        {loadingFree ? (
          <CardSkeleton count={2} />
        ) : freeError ? (
          <ErrorBanner error={freeError} />
        ) : freePeriodsData?.free_intervals && freePeriodsData.free_intervals.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {freePeriodsData.free_intervals.map((interval, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-5 flex flex-col justify-between hover:border-emerald-300 transition"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                      FREE PERIOD
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                      {formatDuration(interval.start, interval.end)} available
                    </span>
                  </div>
                  <p className="text-xl font-extrabold text-slate-900 tracking-tight">
                    {formatTime(interval.start)} – {formatTime(interval.end)}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-emerald-100 flex items-center justify-between">
                  <span className="text-xs text-slate-500">AB3 Classrooms</span>
                  <button
                    onClick={() =>
                      handleFindRoomForInterval(interval.start, interval.end)
                    }
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 transition shadow-xs"
                  >
                    FIND A ROOM <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-6 text-center text-slate-500 text-sm">
            No free intervals detected for today. You have a continuous class schedule!
          </div>
        )}
      </section>

      {/* Two Column Grid: Today's Full Schedule & Upcoming Bookings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Timetable (2 columns) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-brand-600" />
                Today's Schedule
              </h3>
              <p className="text-xs text-slate-500">
                Periods & classes for Section {user?.student_roll_no || ''}
              </p>
            </div>
            <button
              onClick={() => navigate('/student/timetable')}
              className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1"
            >
              Full Week <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {loadingFree ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : freePeriodsData?.periods && freePeriodsData.periods.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {freePeriodsData.periods.map((p) => {
                const isFree = p.status === 'FREE';
                return (
                  <div
                    key={p.period_number}
                    className="py-3 flex items-center justify-between text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center font-mono text-xs font-semibold text-slate-600">
                        P{p.period_number}
                      </span>
                      <div>
                        <p className="font-semibold text-slate-900">
                          {isFree ? (
                            <span className="text-emerald-700 font-medium">Free Period</span>
                          ) : (
                            p.course_code || 'Lecture'
                          )}
                        </p>
                        <p className="text-xs text-slate-400">
                          {formatTime(p.start)} – {formatTime(p.end)}
                        </p>
                      </div>
                    </div>
                    <div>
                      {isFree ? (
                        <button
                          onClick={() => handleFindRoomForInterval(p.start, p.end)}
                          className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md hover:bg-emerald-100 transition"
                        >
                          Find Room
                        </button>
                      ) : (
                        <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md">
                          Room {p.room || 'TBD'}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-500 py-4 text-center">
              No periods configured for today.
            </p>
          )}
        </div>

        {/* Upcoming Bookings (1 column) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-brand-600" />
                My Bookings
              </h3>
              <button
                onClick={() => navigate('/student/bookings')}
                className="text-xs font-semibold text-brand-600 hover:text-brand-700"
              >
                View All
              </button>
            </div>

            {loadingBookings ? (
              <div className="space-y-3">
                <div className="h-16 bg-slate-100 rounded-lg animate-pulse" />
              </div>
            ) : bookingsData?.items && bookingsData.items.length > 0 ? (
              <div className="space-y-3">
                {bookingsData.items.slice(0, 3).map((b) => (
                  <div
                    key={b.id}
                    className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white transition"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-sm text-slate-900">
                        Room #{b.room_id}
                      </span>
                      <StatusBadge status={b.status} size="sm" />
                    </div>
                    <p className="text-xs text-slate-500">
                      {formatDate(b.start_datetime)} · {formatTime(b.start_datetime)} – {formatTime(b.end_datetime)}
                    </p>
                    {b.purpose && (
                      <p className="text-xs text-slate-600 italic mt-1 truncate">
                        "{b.purpose}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <DoorOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-medium text-slate-500">
                  No active room bookings.
                </p>
                <button
                  onClick={() => navigate('/student/find-rooms')}
                  className="mt-3 text-xs font-semibold text-brand-600 hover:text-brand-700 hover:underline"
                >
                  Book an empty classroom
                </button>
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100">
            <div className="rounded-lg bg-brand-50 p-3 flex items-start gap-2.5 text-brand-900 text-xs">
              <CheckCircle2 className="w-4 h-4 text-brand-600 flex-shrink-0 mt-0.5" />
              <span>
                All bookings are guaranteed with PostgreSQL row locks and conflict checks.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
