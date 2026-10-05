import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BookOpen,
  Calendar,
  CheckSquare,
  Clock,
  DoorOpen,
  FileSpreadsheet,
  History,
  Layers,
  PieChart,
  ShieldAlert,
  Users,
  Wrench,
} from 'lucide-react';
import { adminApi } from '../../api/admin';
import { maintenanceApi } from '../../api/maintenance';
import { scheduleChangesApi } from '../../api/scheduleChanges';
import { StatSkeleton } from '../../components/LoadingSkeleton';
import { ErrorBanner } from '../../components/ErrorBanner';

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();

  // 1. Room analytics KPI
  const {
    data: roomAnalytics,
    isLoading: loadingRooms,
    error: roomsError,
  } = useQuery({
    queryKey: ['admin', 'analytics', 'rooms'],
    queryFn: () => adminApi.getRoomAnalytics(),
  });

  // 2. Booking analytics KPI
  const { data: bookingAnalytics, isLoading: loadingBookings } = useQuery({
    queryKey: ['admin', 'analytics', 'bookings'],
    queryFn: () => adminApi.getBookingAnalytics(),
  });

  // 3. Maintenance count
  const { data: maintenanceData } = useQuery({
    queryKey: ['admin', 'maintenance', 'scheduled'],
    queryFn: () => maintenanceApi.getMaintenanceList({ status: 'SCHEDULED' }),
  });

  // 4. Pending schedule changes count
  const { data: pendingChanges } = useQuery({
    queryKey: ['admin', 'schedule-changes', 'pending'],
    queryFn: () => scheduleChangesApi.getChanges({ status: 'PENDING' }),
  });

  const totalRooms = roomAnalytics?.total_rooms ?? 0;
  const availableNow = roomAnalytics?.available_now ?? 0;
  const activeBookings = bookingAnalytics?.active_bookings_now ?? 0;
  const maintenanceCount = maintenanceData?.total ?? 0;
  const pendingRequests = pendingChanges?.total ?? 0;

  const quickLinks = [
    {
      title: 'Classrooms & Floors',
      desc: 'CRUD rooms, facilities, capacities & active status in AB3.',
      icon: Layers,
      to: '/admin/rooms',
      color: 'text-brand-600 bg-brand-50 border-brand-200',
    },
    {
      title: 'Timetable & CSV Import',
      desc: 'Manage recurring slots and stage CSV timetable imports.',
      icon: FileSpreadsheet,
      to: '/admin/timetable',
      color: 'text-electric-600 bg-blue-50 border-blue-200',
    },
    {
      title: 'Schedule Requests',
      desc: 'Approve or reject faculty class reschedules.',
      icon: CheckSquare,
      to: '/admin/schedule-requests',
      badge: pendingRequests,
      color: 'text-amber-600 bg-amber-50 border-amber-200',
    },
    {
      title: 'Room Maintenance',
      desc: 'Schedule repairs and release conflicts automatically.',
      icon: Wrench,
      to: '/admin/maintenance',
      badge: maintenanceCount,
      color: 'text-orange-600 bg-orange-50 border-orange-200',
    },
    {
      title: 'Campus Restrictions',
      desc: 'Enforce temporary restrictions on classrooms.',
      icon: ShieldAlert,
      to: '/admin/restrictions',
      color: 'text-purple-600 bg-purple-50 border-purple-200',
    },
    {
      title: 'Campus Analytics',
      desc: 'Room utilization graphs, peak hours, and booking metrics.',
      icon: PieChart,
      to: '/admin/analytics',
      color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    },
    {
      title: 'User Management',
      desc: 'Manage student, faculty, and administrative accounts.',
      icon: Users,
      to: '/admin/users',
      color: 'text-indigo-600 bg-indigo-50 border-indigo-200',
    },
    {
      title: 'Audit Trail',
      desc: 'Immutable logs of system modifications and permissions.',
      icon: History,
      to: '/admin/audit-logs',
      color: 'text-slate-600 bg-slate-50 border-slate-200',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Overview Title */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
          Campus Operations & Administration
        </h2>
        <p className="text-sm text-slate-500 mt-0.5">
          VIT Chennai · Academic Block 3 Live Control Panel
        </p>
      </div>

      {roomsError && <ErrorBanner error={roomsError} />}

      {/* KPI Cards (Real API Data) */}
      {loadingRooms || loadingBookings ? (
        <StatSkeleton />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              Total Classrooms
            </span>
            <p className="text-3xl font-extrabold text-slate-900 mt-2">
              {totalRooms}
            </p>
            <span className="text-[11px] text-slate-400 mt-1 block">
              AB3 7 Floors
            </span>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider block">
              Available Now
            </span>
            <p className="text-3xl font-extrabold text-emerald-600 mt-2">
              {availableNow}
            </p>
            <span className="text-[11px] text-emerald-600 font-medium mt-1 block">
              Genuinely Empty
            </span>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider block">
              Active Bookings
            </span>
            <p className="text-3xl font-extrabold text-blue-600 mt-2">
              {activeBookings}
            </p>
            <span className="text-[11px] text-slate-400 mt-1 block">
              Currently Occupied
            </span>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <span className="text-xs font-semibold text-orange-700 uppercase tracking-wider block">
              Maintenance
            </span>
            <p className="text-3xl font-extrabold text-orange-600 mt-2">
              {maintenanceCount}
            </p>
            <span className="text-[11px] text-slate-400 mt-1 block">
              Scheduled Blocks
            </span>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider block">
              Pending Requests
            </span>
            <p className="text-3xl font-extrabold text-amber-600 mt-2">
              {pendingRequests}
            </p>
            <span className="text-[11px] text-slate-400 mt-1 block">
              Faculty Reschedules
            </span>
          </div>
        </div>
      )}

      {/* Quick Navigation Cards */}
      <div>
        <h3 className="text-base font-bold text-slate-900 mb-4">
          Administrative Modules
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickLinks.map((link) => {
            const Icon = link.icon;
            return (
              <button
                key={link.to}
                onClick={() => navigate(link.to)}
                className="bg-white rounded-2xl border border-slate-200 p-5 text-left hover:border-brand-500 hover:shadow-md transition group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center border ${link.color}`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    {link.badge !== undefined && link.badge > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-white">
                        {link.badge} pending
                      </span>
                    )}
                  </div>
                  <h4 className="font-bold text-sm text-slate-900 group-hover:text-brand-600 transition">
                    {link.title}
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                    {link.desc}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-brand-600">
                  <span>Manage</span>
                  <span className="group-hover:translate-x-1 transition-transform">
                    →
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
