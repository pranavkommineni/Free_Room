import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  GraduationCap,
  KeyRound,
  Mail,
  Plus,
  Shield,
  UserCheck,
  UserX,
  Users,
} from 'lucide-react';
import { usersApi } from '../../api/users';
import { formatDate } from '../../utils/datetime';
import { StatusBadge } from '../../components/StatusBadge';
import { TableSkeleton } from '../../components/LoadingSkeleton';
import { EmptyState } from '../../components/EmptyState';
import { ErrorBanner } from '../../components/ErrorBanner';
import { Modal } from '../../components/Modal';
import type { AdminUserCreate, Role, UserOut } from '../../types';

export const AdminUsers: React.FC = () => {
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState<Role | ''>('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [actionError, setActionError] = useState<unknown>(null);

  // Form states
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('Password123!');
  const [formRole, setFormRole] = useState<Role>('FACULTY');
  const [formDept, setFormDept] = useState('CSE');
  const [formRollNo, setFormRollNo] = useState('');
  const [formYear, setFormYear] = useState<number>(2);
  const [formFacultyCode, setFormFacultyCode] = useState('');
  const [formDesignation, setFormDesignation] = useState('Assistant Professor');

  // Fetch users
  const {
    data: usersData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['admin', 'users', page, roleFilter],
    queryFn: () =>
      usersApi.getUsers({
        page,
        page_size: 25,
        role: roleFilter || undefined,
      }),
  });

  // Create user mutation
  const createMutation = useMutation({
    mutationFn: (data: AdminUserCreate) => usersApi.createUser(data),
    onSuccess: () => {
      setIsCreateOpen(false);
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (err) => setActionError(err),
  });

  // Toggle user active status
  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) =>
      usersApi.updateUser(id, { is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (err) => setActionError(err),
  });

  const handleOpenCreate = () => {
    setActionError(null);
    setFormName('');
    setFormEmail('');
    setFormPassword('Password123!');
    setFormRole('FACULTY');
    setFormDept('CSE');
    setFormFacultyCode('FAC003');
    setFormDesignation('Associate Professor');
    setIsCreateOpen(true);
  };

  const handleSaveCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);

    const payload: AdminUserCreate = {
      name: formName.trim(),
      email: formEmail.trim(),
      password: formPassword,
      role: formRole,
      department: formDept.trim() || undefined,
      student_roll_no:
        formRole === 'STUDENT' ? formRollNo.trim() : undefined,
      year: formRole === 'STUDENT' ? Number(formYear) : undefined,
      faculty_code:
        formRole === 'FACULTY' ? formFacultyCode.trim() : undefined,
      designation:
        formRole === 'ADMIN' ? formDesignation.trim() : undefined,
    };

    createMutation.mutate(payload);
  };

  const usersList = usersData?.items || [];
  const totalPages = Math.ceil((usersData?.total ?? 0) / 25);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-brand-600" />
            University User Directory
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Administer verified Student, Faculty, and Staff accounts.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs transition shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Create User Account
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        {['', 'STUDENT', 'FACULTY', 'ADMIN'].map((r) => (
          <button
            key={r}
            onClick={() => {
              setRoleFilter(r as Role | '');
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              roleFilter === r
                ? 'bg-brand-600 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {r === '' ? 'All Roles' : r}
          </button>
        ))}
      </div>

      {error && <ErrorBanner error={error} onRetry={refetch} />}

      {isLoading ? (
        <TableSkeleton rows={8} cols={5} />
      ) : usersList.length > 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3.5">User</th>
                  <th className="px-6 py-3.5">Email</th>
                  <th className="px-6 py-3.5">Role</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5">Created At</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {usersList.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/60 transition">
                    <td className="px-6 py-4 font-bold text-slate-900 flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-xs">
                        {u.name.charAt(0)}
                      </div>
                      <div>
                        <span>{u.name}</span>
                        <span className="text-[11px] font-mono text-slate-400 block">
                          ID #{u.id}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 font-medium">
                      {u.email}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-block px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-700 uppercase">
                        {u.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge
                        status={u.is_active ? 'ACTIVE' : 'INACTIVE'}
                        size="sm"
                      />
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500">
                      {formatDate(u.created_at)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() =>
                          toggleActiveMutation.mutate({
                            id: u.id,
                            is_active: !u.is_active,
                          })
                        }
                        className={`text-xs font-semibold px-2.5 py-1 rounded-md transition ${
                          u.is_active
                            ? 'text-rose-600 hover:bg-rose-50'
                            : 'text-emerald-700 hover:bg-emerald-50'
                        }`}
                      >
                        {u.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="px-3 py-1.5 rounded border border-slate-200 disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-slate-500">
                Page {page} of {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="px-3 py-1.5 rounded border border-slate-200 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </div>
      ) : (
        <EmptyState
          icon={Users}
          title="No users found"
          description="Try changing the role filter."
        />
      )}

      {/* Create User Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create University User"
      >
        <form onSubmit={handleSaveCreate} className="space-y-4">
          <ErrorBanner error={actionError} />

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Role
            </label>
            <select
              value={formRole}
              onChange={(e) => setFormRole(e.target.value as Role)}
              className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg bg-white"
            >
              <option value="STUDENT">STUDENT</option>
              <option value="FACULTY">FACULTY</option>
              <option value="ADMIN">ADMIN</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Full Name
              </label>
              <input
                type="text"
                required
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Dr. S. Raman"
                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email
              </label>
              <input
                type="email"
                required
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="s.raman@vit.ac.in"
                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Password (min 10 characters)
            </label>
            <input
              type="password"
              required
              minLength={10}
              value={formPassword}
              onChange={(e) => setFormPassword(e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Department
            </label>
            <input
              type="text"
              required
              value={formDept}
              onChange={(e) => setFormDept(e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          {formRole === 'STUDENT' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Roll Number
                </label>
                <input
                  type="text"
                  required
                  value={formRollNo}
                  onChange={(e) => setFormRollNo(e.target.value)}
                  placeholder="23BCE1050"
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Year
                </label>
                <select
                  value={formYear}
                  onChange={(e) => setFormYear(Number(e.target.value))}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                  <option value={4}>4</option>
                </select>
              </div>
            </div>
          )}

          {formRole === 'FACULTY' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Faculty Code
              </label>
              <input
                type="text"
                required
                value={formFacultyCode}
                onChange={(e) => setFormFacultyCode(e.target.value)}
                placeholder="FAC009"
                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          )}

          {formRole === 'ADMIN' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Designation
              </label>
              <input
                type="text"
                value={formDesignation}
                onChange={(e) => setFormDesignation(e.target.value)}
                placeholder="Systems Administrator"
                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-5 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition"
            >
              {createMutation.isPending ? 'Saving...' : 'Create Account'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
