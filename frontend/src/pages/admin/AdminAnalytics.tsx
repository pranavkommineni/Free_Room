import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  Award,
  BookOpen,
  Calendar,
  Layers,
  PieChart as PieIcon,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { adminApi } from '../../api/admin';
import { StatSkeleton } from '../../components/LoadingSkeleton';
import { ErrorBanner } from '../../components/ErrorBanner';

export const AdminAnalytics: React.FC = () => {
  // 1. Room Live Distribution
  const {
    data: roomAnalytics,
    isLoading: loadingRooms,
    error: roomsError,
  } = useQuery({
    queryKey: ['admin', 'analytics', 'rooms'],
    queryFn: () => adminApi.getRoomAnalytics(),
  });

  // 2. Booking Analytics
  const {
    data: bookingAnalytics,
    isLoading: loadingBookings,
    error: bookingsError,
  } = useQuery({
    queryKey: ['admin', 'analytics', 'bookings'],
    queryFn: () => adminApi.getBookingAnalytics(),
  });

  // 3. Utilization Analytics
  const {
    data: utilizationAnalytics,
    isLoading: loadingUtilization,
    error: utilizationError,
  } = useQuery({
    queryKey: ['admin', 'analytics', 'utilization'],
    queryFn: () => adminApi.getUtilizationAnalytics(undefined, undefined, 5),
  });

  const availableCount = roomAnalytics?.available_now ?? 0;
  const occupiedCount = roomAnalytics?.occupied_now ?? 0;
  const inactiveCount = roomAnalytics?.inactive_rooms ?? 0;

  const roomStatusData = [
    { name: 'Available Now', value: availableCount, color: '#10b981' },
    { name: 'Occupied Now', value: occupiedCount, color: '#f43f5e' },
    { name: 'Inactive / Maintenance', value: inactiveCount, color: '#94a3b8' },
  ].filter((d) => d.value > 0);

  const utilizationChartData = (utilizationAnalytics?.most_used || []).map(
    (u) => ({
      name: `Room ${u.display_name.replace('AB3-', '')}`,
      classHours: Number(u.class_hours.toFixed(1)),
      bookedHours: Number(u.booked_hours.toFixed(1)),
      utilizationPct: u.utilization_pct,
    })
  );

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <PieIcon className="w-6 h-6 text-brand-600" />
          Campus Room Analytics & Utilization
        </h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Real-time room occupancy, booking activity, and semester utilization reports.
        </p>
      </div>

      {(roomsError || bookingsError || utilizationError) && (
        <ErrorBanner
          error={roomsError || bookingsError || utilizationError}
        />
      )}

      {/* KPI Overview */}
      {loadingRooms || loadingBookings ? (
        <StatSkeleton />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              Total Campus Bookings
            </span>
            <p className="text-3xl font-extrabold text-slate-900 mt-2">
              {bookingAnalytics?.total_bookings ?? 0}
            </p>
            <span className="text-xs text-slate-400 mt-1 block">
              All time records
            </span>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider block">
              Active Bookings Now
            </span>
            <p className="text-3xl font-extrabold text-emerald-600 mt-2">
              {bookingAnalytics?.active_bookings_now ?? 0}
            </p>
            <span className="text-xs text-emerald-600 font-medium mt-1 block">
              In progress sessions
            </span>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider block">
              Upcoming Bookings
            </span>
            <p className="text-3xl font-extrabold text-blue-600 mt-2">
              {bookingAnalytics?.upcoming_bookings ?? 0}
            </p>
            <span className="text-xs text-slate-400 mt-1 block">
              Future confirmed
            </span>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <span className="text-xs font-semibold text-rose-700 uppercase tracking-wider block">
              Cancellation Rate
            </span>
            <p className="text-3xl font-extrabold text-rose-600 mt-2">
              {((bookingAnalytics?.cancellation_rate ?? 0) * 100).toFixed(1)}%
            </p>
            <span className="text-xs text-slate-400 mt-1 block">
              {bookingAnalytics?.cancellation_count ?? 0} cancelled
            </span>
          </div>
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Room Status Distribution Pie */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 mb-1">
              Live Room Status Distribution
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Real-time snapshot across all 77 classrooms in AB3.
            </p>

            <div className="h-64 flex items-center justify-center">
              {roomStatusData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={roomStatusData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={85}
                      paddingAngle={4}
                    >
                      {roomStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: '0.75rem',
                        border: '1px solid #e2e8f0',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                      }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      formatter={(val) => (
                        <span className="text-xs font-medium text-slate-700">
                          {val}
                        </span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-xs text-slate-400">Loading chart data...</p>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Total: <strong>{roomAnalytics?.total_rooms}</strong> classrooms</span>
            <span className="text-emerald-700 font-semibold">
              {roomAnalytics?.available_now} ready for booking
            </span>
          </div>
        </div>

        {/* Room Utilization Bar Chart */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 mb-1">
              Top Classroom Utilization
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Breakdown of Lecture Class Hours vs Student Booking Hours.
            </p>

            <div className="h-64">
              {utilizationChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={utilizationChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: '#64748b' }}
                    />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '0.75rem',
                        border: '1px solid #e2e8f0',
                        fontSize: '0.75rem',
                      }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      formatter={(val) => (
                        <span className="text-xs font-medium text-slate-700">
                          {val === 'classHours' ? 'Classroom Lectures (hrs)' : 'Student Bookings (hrs)'}
                        </span>
                      )}
                    />
                    <Bar
                      dataKey="classHours"
                      stackId="a"
                      fill="#4f46e5"
                      radius={[0, 0, 4, 4]}
                    />
                    <Bar
                      dataKey="bookedHours"
                      stackId="a"
                      fill="#10b981"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-slate-400">
                  Calculating semester room hours...
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Working days tracked: <strong>{utilizationAnalytics?.working_days ?? 5}</strong></span>
            <span>Capacity baseline: <strong>70 seats</strong></span>
          </div>
        </div>
      </div>

      {/* Most-Used & Least-Used Rooms Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Most-Used Rooms */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">
                Most-Used Classrooms
              </h4>
              <p className="text-[11px] text-slate-500">
                Ranked by combined utilization percentage
              </p>
            </div>
          </div>

          {loadingUtilization ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 bg-slate-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (utilizationAnalytics?.most_used || []).length > 0 ? (
            <div className="divide-y divide-slate-100 text-xs">
              {(utilizationAnalytics?.most_used || []).map((u, idx) => (
                <div key={u.room_id} className="py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center font-bold text-[10px] text-slate-600">
                      {idx + 1}
                    </span>
                    <div>
                      <p className="font-bold text-slate-900">{u.display_name}</p>
                      <span className="text-[11px] text-slate-400">
                        {u.booking_count} bookings · {u.total_hours.toFixed(1)} hrs total
                      </span>
                    </div>
                  </div>
                  <span className="font-extrabold text-emerald-600 text-sm">
                    {u.utilization_pct.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 text-center py-4">
              Utilization metrics will populate as schedules and bookings proceed.
            </p>
          )}
        </div>

        {/* Least-Used Rooms */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
              <TrendingDown className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">
                Least-Used Classrooms
              </h4>
              <p className="text-[11px] text-slate-500">
                Highest availability capacity for allocation
              </p>
            </div>
          </div>

          {loadingUtilization ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 bg-slate-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (utilizationAnalytics?.least_used || []).length > 0 ? (
            <div className="divide-y divide-slate-100 text-xs">
              {(utilizationAnalytics?.least_used || []).map((u, idx) => (
                <div key={u.room_id} className="py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center font-bold text-[10px] text-slate-600">
                      {idx + 1}
                    </span>
                    <div>
                      <p className="font-bold text-slate-900">{u.display_name}</p>
                      <span className="text-[11px] text-slate-400">
                        {u.booking_count} bookings · {u.total_hours.toFixed(1)} hrs total
                      </span>
                    </div>
                  </div>
                  <span className="font-extrabold text-slate-600 text-sm">
                    {u.utilization_pct.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 text-center py-4">
              Utilization metrics will populate as schedules and bookings proceed.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
