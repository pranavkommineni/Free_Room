import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Building2, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { ErrorBanner } from '../../components/ErrorBanner';

const registerSchema = z.object({
  name: z.string().min(1, 'Full name is required').max(120),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(10, 'Password must be at least 10 characters').max(128),
  student_roll_no: z.string().min(3, 'Roll number is required').max(30),
  department: z.string().min(1, 'Department is required').max(80),
  year: z.coerce.number().min(1).max(8),
});

type RegisterFormData = z.infer<typeof registerSchema>;

export const Register: React.FC = () => {
  const { register: authRegister } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      student_roll_no: '',
      department: 'CSE',
      year: 2,
    },
  });

  const onSubmit = async (data: RegisterFormData) => {
    try {
      setError(null);
      setSubmitting(true);
      await authRegister(data);
      setSuccess(true);
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
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
          Create Account
        </h2>
        <p className="mt-1 text-center text-sm text-slate-400">
          Student registration for FreeRoom (VIT Chennai AB3)
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white py-8 px-6 shadow-2xl rounded-2xl sm:px-10 border border-slate-100">
          {success ? (
            <div className="text-center py-6">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-slate-900">Registration Complete</h3>
              <p className="text-sm text-slate-500 mt-1">
                Your student profile has been created. Redirecting to sign in...
              </p>
            </div>
          ) : (
            <>
              <ErrorBanner error={error} className="mb-5" />

              <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    {...register('name')}
                    className="block w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-hidden"
                    placeholder="Arun Kumar"
                  />
                  {errors.name && (
                    <p className="mt-1 text-xs text-rose-600">{errors.name.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    {...register('email')}
                    className="block w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-hidden"
                    placeholder="arun.kumar@vitstudent.ac.in"
                  />
                  {errors.email && (
                    <p className="mt-1 text-xs text-rose-600">{errors.email.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Password (min 10 chars)
                  </label>
                  <input
                    type="password"
                    {...register('password')}
                    className="block w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-hidden"
                    placeholder="••••••••••••"
                  />
                  {errors.password && (
                    <p className="mt-1 text-xs text-rose-600">{errors.password.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      Roll Number
                    </label>
                    <input
                      type="text"
                      {...register('student_roll_no')}
                      className="block w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-hidden"
                      placeholder="23BCE1001"
                    />
                    {errors.student_roll_no && (
                      <p className="mt-1 text-xs text-rose-600">{errors.student_roll_no.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      Year
                    </label>
                    <select
                      {...register('year')}
                      className="block w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-hidden bg-white"
                    >
                      <option value={1}>Year 1</option>
                      <option value={2}>Year 2</option>
                      <option value={3}>Year 3</option>
                      <option value={4}>Year 4</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Department
                  </label>
                  <input
                    type="text"
                    {...register('department')}
                    className="block w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-hidden"
                    placeholder="Computer Science & Engineering (CSE)"
                  />
                  {errors.department && (
                    <p className="mt-1 text-xs text-rose-600">{errors.department.message}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full mt-2 flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 transition disabled:opacity-50"
                >
                  {submitting ? 'Registering...' : 'Complete Registration'}
                </button>
              </form>

              <div className="mt-6 text-center">
                <p className="text-xs text-slate-600">
                  Already registered?{' '}
                  <Link
                    to="/login"
                    className="font-medium text-brand-600 hover:text-brand-500 hover:underline"
                  >
                    Sign in here
                  </Link>
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
