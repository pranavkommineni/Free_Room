import React, { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Bell,
  BookOpen,
  Calendar,
  CheckSquare,
  Clock,
  Compass,
  FileSpreadsheet,
  FileText,
  History,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  PieChart,
  Shield,
  ShieldAlert,
  User,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { notificationsApi } from '../api/notifications';

export const Layout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Poll unread notification count every 30 seconds
  const { data: unreadData } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => notificationsApi.getUnreadCount(),
    refetchInterval: 30000,
    enabled: !!user,
  });

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const role = user?.role || 'STUDENT';

  const navItems = {
    STUDENT: [
      { to: '/student/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/student/find-rooms', label: 'Find Rooms', icon: Compass },
      { to: '/student/timetable', label: 'My Timetable', icon: Calendar },
      { to: '/student/bookings', label: 'My Bookings', icon: BookOpen },
      { to: '/student/notifications', label: 'Notifications', icon: Bell, badge: unreadData?.unread },
      { to: '/student/profile', label: 'Profile', icon: User },
    ],
    FACULTY: [
      { to: '/faculty/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/faculty/find-rooms', label: 'Find Rooms', icon: Compass },
      { to: '/faculty/timetable', label: 'My Timetable', icon: Calendar },
      { to: '/faculty/schedule-changes', label: 'Schedule Changes', icon: Clock },
      { to: '/faculty/notifications', label: 'Notifications', icon: Bell, badge: unreadData?.unread },
      { to: '/faculty/profile', label: 'Profile', icon: User },
    ],
    ADMIN: [
      { to: '/admin/dashboard', label: 'Overview', icon: LayoutDashboard },
      { to: '/admin/rooms', label: 'Rooms & Floors', icon: Layers },
      { to: '/admin/timetable', label: 'Timetable & Import', icon: FileSpreadsheet },
      { to: '/admin/bookings', label: 'Bookings', icon: BookOpen },
      { to: '/admin/schedule-requests', label: 'Schedule Requests', icon: CheckSquare },
      { to: '/admin/maintenance', label: 'Maintenance', icon: Wrench },
      { to: '/admin/restrictions', label: 'Restrictions', icon: ShieldAlert },
      { to: '/admin/users', label: 'Users', icon: Users },
      { to: '/admin/analytics', label: 'Analytics', icon: PieChart },
      { to: '/admin/audit-logs', label: 'Audit Logs', icon: History },
      { to: '/admin/notifications', label: 'Notifications', icon: Bell, badge: unreadData?.unread },
    ],
  }[role] || [];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Mobile Header */}
      <header className="md:hidden bg-slate-900 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-30 shadow-md">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center font-bold text-white shadow-xs">
            FR
          </div>
          <div>
            <span className="font-semibold text-base tracking-tight">FreeRoom</span>
            <span className="text-[11px] text-slate-400 block -mt-1">VIT Chennai · AB3</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to={`/${role.toLowerCase()}/notifications`}
            className="relative p-2 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800 transition"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5" />
            {!!unreadData?.unread && unreadData.unread > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500"></span>
            )}
          </Link>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800 transition"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </header>

      {/* Sidebar Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900 text-slate-300 border-r border-slate-800 sticky top-0 h-screen select-none z-20">
        {/* Brand */}
        <div className="p-5 border-b border-slate-800/80 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-electric-500 flex items-center justify-center font-bold text-white shadow-md">
            FR
          </div>
          <div>
            <h1 className="font-bold text-base text-white tracking-tight flex items-center gap-1.5">
              FreeRoom
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-900/80 text-brand-300 border border-brand-700/50 uppercase font-mono">
                {role}
              </span>
            </h1>
            <p className="text-xs text-slate-400">VIT Chennai · AB3</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition group ${
                    isActive
                      ? 'bg-brand-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`
                }
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="px-1.5 py-0.5 text-xs font-semibold rounded-full bg-rose-500 text-white">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* User Footer */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/40">
          <div className="flex items-center justify-between px-2 py-2 rounded-lg bg-slate-800/40 mb-2">
            <div className="min-w-0 pr-2">
              <p className="text-xs font-semibold text-white truncate">{user?.name}</p>
              <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" title="Connected"></span>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-slate-900/70 backdrop-blur-xs flex">
          <div className="w-64 bg-slate-900 text-slate-300 h-full flex flex-col p-4 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <span className="font-semibold text-white">Navigation</span>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 py-4 space-y-1 overflow-y-auto">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                        isActive
                          ? 'bg-brand-600 text-white'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                      }`
                    }
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </div>
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className="px-1.5 py-0.5 text-xs font-semibold rounded-full bg-rose-500 text-white">
                        {item.badge}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </nav>
            <div className="pt-4 border-t border-slate-800">
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-rose-400 hover:bg-rose-950/30 transition"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>
          <div className="flex-1" onClick={() => setMobileMenuOpen(false)} />
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
