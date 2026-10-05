import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ProtectedRoute } from './ProtectedRoute';
import { Layout } from '../components/Layout';

// Auth Pages
import { Login } from '../pages/auth/Login';
import { Register } from '../pages/auth/Register';

// Student Pages
import { StudentDashboard } from '../pages/student/StudentDashboard';
import { FindRooms } from '../pages/student/FindRooms';
import { RoomDetails } from '../pages/student/RoomDetails';
import { StudentTimetable } from '../pages/student/StudentTimetable';
import { Bookings } from '../pages/student/Bookings';

// Faculty Pages
import { FacultyDashboard } from '../pages/faculty/FacultyDashboard';
import { FacultyTimetable } from '../pages/faculty/FacultyTimetable';
import { ScheduleChanges } from '../pages/faculty/ScheduleChanges';

// Admin Pages
import { AdminDashboard } from '../pages/admin/AdminDashboard';
import { AdminRooms } from '../pages/admin/AdminRooms';
import { AdminTimetable } from '../pages/admin/AdminTimetable';
import { AdminBookings } from '../pages/admin/AdminBookings';
import { AdminScheduleRequests } from '../pages/admin/AdminScheduleRequests';
import { AdminMaintenance } from '../pages/admin/AdminMaintenance';
import { AdminRestrictions } from '../pages/admin/AdminRestrictions';
import { AdminUsers } from '../pages/admin/AdminUsers';
import { AdminAnalytics } from '../pages/admin/AdminAnalytics';
import { AdminAuditLogs } from '../pages/admin/AdminAuditLogs';

// Common Pages
import { NotificationsPage } from '../pages/common/NotificationsPage';
import { ProfilePage } from '../pages/common/ProfilePage';

export const AppRoutes: React.FC = () => {
  const { user, isAuthenticated } = useAuth();

  const getHomeRoute = () => {
    if (!isAuthenticated || !user) return '/login';
    return `/${user.role.toLowerCase()}/dashboard`;
  };

  return (
    <Routes>
      {/* Public Authentication Routes */}
      <Route
        path="/login"
        element={
          isAuthenticated && user ? (
            <Navigate to={getHomeRoute()} replace />
          ) : (
            <Login />
          )
        }
      />
      <Route
        path="/register"
        element={
          isAuthenticated && user ? (
            <Navigate to={getHomeRoute()} replace />
          ) : (
            <Register />
          )
        }
      />

      {/* Root redirect */}
      <Route path="/" element={<Navigate to={getHomeRoute()} replace />} />

      {/* STUDENT ROUTES */}
      <Route
        path="/student"
        element={
          <ProtectedRoute allowedRoles={['STUDENT']}>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/student/dashboard" replace />} />
        <Route path="dashboard" element={<StudentDashboard />} />
        <Route path="find-rooms" element={<FindRooms />} />
        <Route path="rooms/:roomId" element={<RoomDetails />} />
        <Route path="timetable" element={<StudentTimetable />} />
        <Route path="bookings" element={<Bookings />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>

      {/* FACULTY ROUTES */}
      <Route
        path="/faculty"
        element={
          <ProtectedRoute allowedRoles={['FACULTY']}>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/faculty/dashboard" replace />} />
        <Route path="dashboard" element={<FacultyDashboard />} />
        <Route path="find-rooms" element={<FindRooms />} />
        <Route path="rooms/:roomId" element={<RoomDetails />} />
        <Route path="timetable" element={<FacultyTimetable />} />
        <Route path="schedule-changes" element={<ScheduleChanges />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>

      {/* ADMIN ROUTES */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={['ADMIN']}>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="rooms" element={<AdminRooms />} />
        <Route path="timetable" element={<AdminTimetable />} />
        <Route path="bookings" element={<AdminBookings />} />
        <Route path="schedule-requests" element={<AdminScheduleRequests />} />
        <Route path="maintenance" element={<AdminMaintenance />} />
        <Route path="restrictions" element={<AdminRestrictions />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="analytics" element={<AdminAnalytics />} />
        <Route path="audit-logs" element={<AdminAuditLogs />} />
        <Route path="notifications" element={<NotificationsPage />} />
      </Route>

      {/* Catch-all 404 Route */}
      <Route path="*" element={<Navigate to={getHomeRoute()} replace />} />
    </Routes>
  );
};
