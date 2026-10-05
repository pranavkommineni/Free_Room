import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Calendar,
  Filter,
  History,
  Shield,
  User,
} from 'lucide-react';
import { adminApi } from '../../api/admin';
import { formatDateTime } from '../../utils/datetime';
import { TableSkeleton } from '../../components/LoadingSkeleton';
import { EmptyState } from '../../components/EmptyState';
import { ErrorBanner } from '../../components/ErrorBanner';

export const AdminAuditLogs: React.FC = () => {
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');

  const {
    data: logsData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['admin', 'audit-logs', page, actionFilter, entityFilter],
    queryFn: () =>
      adminApi.getAuditLogs({
        page,
        page_size: 25,
        action: actionFilter || undefined,
        entity_type: entityFilter || undefined,
      }),
  });

  const logsList = logsData?.items || [];
  const totalPages = Math.ceil((logsData?.total ?? 0) / 25);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <History className="w-6 h-6 text-brand-600" />
            Security & System Audit Trail
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Immutable log of all room bookings, reschedule approvals, and administrative actions.
          </p>
        </div>
      </div>

      {/* Filter Row */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs flex flex-wrap items-center gap-4 text-xs">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="font-semibold text-slate-600">Action:</span>
          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
            className="border border-slate-300 rounded-lg px-2.5 py-1.5 bg-slate-50"
          >
            <option value="">All Actions</option>
            <option value="BOOKING_CREATED">BOOKING_CREATED</option>
            <option value="BOOKING_CANCELLED">BOOKING_CANCELLED</option>
            <option value="SCHEDULE_APPROVED">SCHEDULE_APPROVED</option>
            <option value="SCHEDULE_REJECTED">SCHEDULE_REJECTED</option>
            <option value="MAINTENANCE_CREATED">MAINTENANCE_CREATED</option>
            <option value="ROOM_CREATED">ROOM_CREATED</option>
            <option value="USER_UPDATED">USER_UPDATED</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-600">Entity:</span>
          <select
            value={entityFilter}
            onChange={(e) => {
              setEntityFilter(e.target.value);
              setPage(1);
            }}
            className="border border-slate-300 rounded-lg px-2.5 py-1.5 bg-slate-50"
          >
            <option value="">All Entities</option>
            <option value="room_booking">room_booking</option>
            <option value="schedule_change">schedule_change</option>
            <option value="room">room</option>
            <option value="room_maintenance">room_maintenance</option>
            <option value="user">user</option>
          </select>
        </div>

        <span className="ml-auto text-slate-400">
          Total Logs: {logsData?.total ?? 0}
        </span>
      </div>

      {error && <ErrorBanner error={error} onRetry={refetch} />}

      {isLoading ? (
        <TableSkeleton rows={8} cols={5} />
      ) : logsList.length > 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3.5">Timestamp</th>
                  <th className="px-6 py-3.5">Action</th>
                  <th className="px-6 py-3.5">Entity</th>
                  <th className="px-6 py-3.5">Actor</th>
                  <th className="px-6 py-3.5">Change Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-xs">
                {logsList.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/60 transition">
                    <td className="px-6 py-4 text-slate-500 font-sans">
                      {formatDateTime(log.created_at)}
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-900">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {log.entity_type} {log.entity_id ? `(#${log.entity_id})` : ''}
                    </td>
                    <td className="px-6 py-4 text-slate-600 font-sans">
                      {log.user_id ? `User #${log.user_id}` : 'System'}
                    </td>
                    <td className="px-6 py-4 text-[11px] text-slate-500 max-w-md">
                      {log.new_data ? (
                        <pre className="overflow-x-auto bg-slate-50 p-1.5 rounded border border-slate-200 text-slate-700">
                          {JSON.stringify(log.new_data)}
                        </pre>
                      ) : (
                        <span className="text-slate-300">--</span>
                      )}
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
          icon={History}
          title="No audit logs"
          description="System events will be recorded here automatically."
        />
      )}
    </div>
  );
};
