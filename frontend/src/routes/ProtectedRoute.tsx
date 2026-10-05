import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { Role } from '../types';

interface ProtectedRouteProps {
  children: React.ReactElement;
  allowedRoles?: Role[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
}) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-brand-200 border-t-brand-600 rounded-full animate-spin"></div>
          <p className="text-sm font-medium text-slate-500">Checking campus credentials...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect to user's authorized role home
    const roleHome = `/${user.role.toLowerCase()}/dashboard`;
    return <Navigate to={roleHome} replace />;
  }

  return children;
};
