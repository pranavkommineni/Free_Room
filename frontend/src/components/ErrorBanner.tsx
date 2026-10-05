import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { extractErrorMessage } from '../utils/datetime';

interface ErrorBannerProps {
  error: unknown;
  onRetry?: () => void;
  className?: string;
}

export const ErrorBanner: React.FC<ErrorBannerProps> = ({
  error,
  onRetry,
  className = '',
}) => {
  if (!error) return null;
  const message = extractErrorMessage(error);

  return (
    <div
      role="alert"
      className={`rounded-xl border border-rose-200 bg-rose-50 p-4 flex items-start gap-3 text-rose-900 ${className}`}
    >
      <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
      <div className="flex-1 text-sm font-medium">{message}</div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md bg-white border border-rose-300 text-rose-700 hover:bg-rose-100 transition focus:outline-none focus:ring-2 focus:ring-rose-500"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Retry
        </button>
      )}
    </div>
  );
};
