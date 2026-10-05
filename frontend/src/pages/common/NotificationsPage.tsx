import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  CheckCheck,
  CheckCircle2,
  Clock,
  Info,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import { notificationsApi } from '../../api/notifications';
import { formatDateTime } from '../../utils/datetime';
import { TableSkeleton } from '../../components/LoadingSkeleton';
import { EmptyState } from '../../components/EmptyState';
import { ErrorBanner } from '../../components/ErrorBanner';

export const NotificationsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [unreadOnly, setUnreadOnly] = useState<boolean>(false);

  // Fetch notifications
  const {
    data: notifData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['notifications', unreadOnly],
    queryFn: () => notificationsApi.getNotifications(1, 50, unreadOnly),
  });

  // Mark one read
  const markOneMutation = useMutation({
    mutationFn: (id: number) => notificationsApi.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // Mark all read
  const markAllMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const notifications = notifData?.items || [];

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'BOOKING_CONFIRMED':
      case 'RESCHEDULE_APPROVED':
        return <CheckCircle2 className="w-5 h-5 text-emerald-600" />;
      case 'BOOKING_CANCELLED':
      case 'CLASS_CANCELLED':
      case 'RESCHEDULE_REJECTED':
        return <XCircle className="w-5 h-5 text-rose-600" />;
      case 'CLASS_RESCHEDULED':
        return <Clock className="w-5 h-5 text-amber-600" />;
      case 'ROOM_UNAVAILABLE':
        return <ShieldAlert className="w-5 h-5 text-orange-600" />;
      default:
        return <Info className="w-5 h-5 text-brand-600" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Bell className="w-6 h-6 text-brand-600" />
            Notifications Center
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Updates on room bookings, class reschedules, and room availability.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setUnreadOnly(!unreadOnly)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
              unreadOnly
                ? 'bg-brand-50 border-brand-300 text-brand-700'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {unreadOnly ? 'Showing Unread Only' : 'Show All'}
          </button>
          <button
            disabled={markAllMutation.isPending || notifications.length === 0}
            onClick={() => markAllMutation.mutate()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition shadow-2xs disabled:opacity-50"
          >
            <CheckCheck className="w-4 h-4 text-emerald-600" />
            Mark all read
          </button>
        </div>
      </div>

      {error && <ErrorBanner error={error} onRetry={refetch} />}

      {isLoading ? (
        <TableSkeleton rows={4} cols={3} />
      ) : notifications.length > 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden shadow-xs">
          {notifications.map((notif) => (
            <div
              key={notif.id}
              className={`p-4 md:p-5 flex items-start justify-between gap-4 transition ${
                !notif.is_read ? 'bg-brand-50/30' : 'hover:bg-slate-50/50'
              }`}
            >
              <div className="flex items-start gap-3.5">
                <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 flex-shrink-0">
                  {getNotificationIcon(notif.type)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-slate-900">
                      {notif.title}
                    </h4>
                    {!notif.is_read && (
                      <span className="w-2 h-2 rounded-full bg-brand-600"></span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 mt-1">{notif.message}</p>
                  <span className="text-[11px] text-slate-400 mt-2 block">
                    {formatDateTime(notif.created_at)}
                  </span>
                </div>
              </div>

              {!notif.is_read && (
                <button
                  disabled={markOneMutation.isPending}
                  onClick={() => markOneMutation.mutate(notif.id)}
                  className="text-xs font-medium text-brand-600 hover:text-brand-800 flex-shrink-0"
                >
                  Mark read
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Bell}
          title="No notifications"
          description={
            unreadOnly
              ? 'You have caught up with all unread messages!'
              : 'You have no notifications in your history yet.'
          }
        />
      )}
    </div>
  );
};
