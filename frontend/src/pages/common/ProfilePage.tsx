import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  Building2,
  Calendar,
  GraduationCap,
  Mail,
  Shield,
  User,
} from 'lucide-react';
import { StatusBadge } from '../../components/StatusBadge';

export const ProfilePage: React.FC = () => {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <User className="w-6 h-6 text-brand-600" />
          Campus Profile
        </h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Your authenticated university identity and permissions.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-xs space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-brand-600 to-electric-500 flex items-center justify-center font-bold text-2xl text-white shadow-md">
            {user.name.charAt(0)}
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
              {user.name}
              <StatusBadge status={user.is_active ? 'ACTIVE' : 'INACTIVE'} size="sm" />
            </h3>
            <p className="text-sm text-slate-500">{user.email}</p>
            <span className="inline-block mt-1 text-[11px] font-mono px-2 py-0.5 rounded bg-brand-50 text-brand-700 border border-brand-200 uppercase font-semibold">
              Role: {user.role}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-6 border-t border-slate-100 text-sm">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-slate-500" /> Academic Email
            </span>
            <p className="font-semibold text-slate-800">{user.email}</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-slate-500" /> Campus & Block
            </span>
            <p className="font-semibold text-slate-800">VIT Chennai · AB3</p>
          </div>

          {user.role === 'STUDENT' && (
            <>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5 text-slate-500" /> Roll Number
                </span>
                <p className="font-semibold text-slate-800">
                  {user.student_roll_no || 'N/A'}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-slate-500" /> Booking Authorization
                </span>
                <p className="font-semibold text-emerald-700">
                  Classrooms Accessible (Capacity ≤ 70)
                </p>
              </div>
            </>
          )}

          {user.role === 'FACULTY' && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5 text-slate-500" /> Faculty Code
              </span>
              <p className="font-semibold text-slate-800">
                {user.faculty_code || 'N/A'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
