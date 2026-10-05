import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Building2, KeyRound, Mail, Sparkles } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { extractErrorMessage } from '../../utils/datetime';
import { ErrorBanner } from '../../components/ErrorBanner';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid academic email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      setError(null);
      setSubmitting(true);
      const user = await login(data);

      // Redirect to intended route or role dashboard
      const from = (location.state as { from?: { pathname: string } })?.from
        ?.pathname;
      if (from) {
        navigate(from, { replace: true });
      } else {
        navigate(`/${user.role.toLowerCase()}/dashboard`, { replace: true });
      }
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickDemo = (email: string) => {
    setValue('email', email);
    setValue('password', 'Password123!');
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-800 via-slate-900 to-slate-950">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-brand-600 to-electric-500 flex items-center justify-center text-white shadow-xl shadow-brand-500/20">
            <Building2 className="w-8 h-8" />
          </div>
        </div>
        <h2 className="mt-4 text-center text-3xl font-extrabold text-white tracking-tight">
          FreeRoom
        </h2>
        <p className="mt-1 text-center text-sm text-slate-400">
          VIT Chennai · AB3 Smart Campus Room Availability
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white py-8 px-6 shadow-2xl rounded-2xl sm:px-10 border border-slate-100">
          <div className="mb-6">
            <h3 className="text-xl font-bold text-slate-900">Sign in</h3>
            <p className="text-xs text-slate-500 mt-1">
              Enter your campus credentials to access genuine room availability.
            </p>
          </div>

          <ErrorBanner error={error} className="mb-6" />

          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1"
              >
                Academic Email
              </label>
              <div className="relative rounded-lg shadow-2xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  {...register('email')}
                  className={`block w-full pl-10 pr-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-hidden transition ${
                    errors.email
                      ? 'border-rose-300 text-rose-900'
                      : 'border-slate-300 text-slate-900'
                  }`}
                  placeholder="student1@freeroom.example"
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-xs text-rose-600">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1"
              >
                Password
              </label>
              <div className="relative rounded-lg shadow-2xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <KeyRound className="h-4 w-4" />
                </div>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  {...register('password')}
                  className={`block w-full pl-10 pr-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-hidden transition ${
                    errors.password
                      ? 'border-rose-300 text-rose-900'
                      : 'border-slate-300 text-slate-900'
                  }`}
                  placeholder="••••••••••••"
                />
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-rose-600">
                  {errors.password.message}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 transition disabled:opacity-50"
            >
              {submitting ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>

          {/* Quick Demo Logins Helper */}
          <div className="mt-6 pt-6 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mb-2.5">
              <Sparkles className="w-3.5 h-3.5 text-brand-500" />
              Quick Fill Demo Accounts
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleQuickDemo('student1@freeroom.example')}
                className="px-2 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md text-center transition"
              >
                Student
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemo('faculty1@freeroom.example')}
                className="px-2 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md text-center transition"
              >
                Faculty
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemo('admin@freeroom.example')}
                className="px-2 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md text-center transition"
              >
                Admin
              </button>
            </div>
          </div>

          <div className="mt-6 text-center">
            <p className="text-xs text-slate-600">
              New student?{' '}
              <Link
                to="/register"
                className="font-medium text-brand-600 hover:text-brand-500 hover:underline"
              >
                Register an account
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
