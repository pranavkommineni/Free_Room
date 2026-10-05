import { ERROR_MESSAGES } from '../constants';

export const CAMPUS_TIMEZONE = 'Asia/Kolkata';
export const CAMPUS_OFFSET = '+05:30';

/**
 * Format an ISO string to a friendly time: "10:40 AM"
 */
export function formatTime(isoString?: string | null): string {
  if (!isoString) return '--:--';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) {
      // might be a "HH:mm:ss" string from time field
      if (typeof isoString === 'string' && isoString.includes(':')) {
        const [h, m] = isoString.split(':');
        const hour = parseInt(h, 10);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const formattedH = hour % 12 || 12;
        return `${formattedH}:${m} ${ampm}`;
      }
      return isoString;
    }
    return new Intl.DateTimeFormat('en-US', {
      timeZone: CAMPUS_TIMEZONE,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(d);
  } catch {
    return isoString;
  }
}

/**
 * Format an ISO string to friendly date: "Mon, Oct 5, 2026"
 */
export function formatDate(isoString?: string | null): string {
  if (!isoString) return '--';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return new Intl.DateTimeFormat('en-US', {
      timeZone: CAMPUS_TIMEZONE,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(d);
  } catch {
    return isoString;
  }
}

/**
 * Format an ISO string to: "Oct 5, 10:40 AM"
 */
export function formatDateTime(isoString?: string | null): string {
  if (!isoString) return '--';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return new Intl.DateTimeFormat('en-US', {
      timeZone: CAMPUS_TIMEZONE,
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(d);
  } catch {
    return isoString;
  }
}

/**
 * Compute friendly duration: "1h 40m"
 */
export function formatDuration(startIso?: string | null, endIso?: string | null): string {
  if (!startIso || !endIso) return '';
  try {
    const start = new Date(startIso).getTime();
    const end = new Date(endIso).getTime();
    const diffMins = Math.max(0, Math.round((end - start) / (1000 * 60)));
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  } catch {
    return '';
  }
}

/**
 * Get current date in YYYY-MM-DD for Asia/Kolkata
 */
export function getCampusToday(): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: CAMPUS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(now);
}

/**
 * Create an ISO-8601 string with campus offset +05:30: e.g. "2026-10-05T10:00:00+05:30"
 */
export function toCampusISO(dateStr: string, timeStr: string): string {
  // dateStr: YYYY-MM-DD, timeStr: HH:mm or HH:mm:ss
  const formattedTime = timeStr.length === 5 ? `${timeStr}:00` : timeStr;
  return `${dateStr}T${formattedTime}${CAMPUS_OFFSET}`;
}

/**
 * Extract user-friendly error message from Axios / backend response
 */
export function extractErrorMessage(err: unknown): string {
  if (!err) return 'An unexpected error occurred.';
  if (typeof err === 'string') return err;

  const anyErr = err as {
    response?: {
      data?: {
        error?: {
          code?: string;
          message?: string;
          details?: unknown;
        };
        message?: string;
        detail?: string | { msg?: string }[];
      };
      status?: number;
    };
    message?: string;
  };

  const errorObj = anyErr.response?.data?.error;
  if (errorObj?.code && ERROR_MESSAGES[errorObj.code]) {
    return ERROR_MESSAGES[errorObj.code];
  }
  if (errorObj?.message) {
    return errorObj.message;
  }

  // Check detail from FastAPI default validation
  const detail = anyErr.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    return detail.map((d) => d.msg || JSON.stringify(d)).join(', ');
  }

  if (anyErr.response?.data?.message) {
    return anyErr.response.data.message;
  }

  if (anyErr.response?.status === 401) {
    return 'Your session has expired. Please sign in again.';
  }
  if (anyErr.response?.status === 403) {
    return "You don't have permission to perform this action.";
  }
  if (anyErr.response?.status === 409) {
    return 'This request conflicts with an existing schedule or booking.';
  }

  if (anyErr.message === 'Network Error' || !anyErr.response) {
    return ERROR_MESSAGES.NETWORK_ERROR;
  }

  return anyErr.message || 'An unexpected error occurred.';
}
