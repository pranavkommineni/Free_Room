export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

export const ERROR_MESSAGES: Record<string, string> = {
  ROOM_NOT_AVAILABLE: 'This room is no longer available for the selected interval.',
  SCHEDULE_CONFLICT: 'The selected time or room conflicts with another class or booking.',
  BOOKING_OVERLAP: 'This room was just booked by someone else. Try another room.',
  ROOM_BOOKING_CONFLICT: 'This room was just booked by someone else. Try another room.',
  FORBIDDEN: "You don't have permission to perform this action.",
  STUDENT_NOT_FOUND: 'Student profile not found.',
  STUDENT_ID_REQUIRED: 'Student ID is required.',
  SELF_DEACTIVATION: 'You cannot deactivate your own administrative account.',
  COURSE_ALREADY_EXISTS: 'A course with this code already exists.',
  SECTION_ALREADY_EXISTS: 'A section with this code already exists for this term.',
  IMPORT_HAS_ERRORS: 'The uploaded timetable file has validation errors.',
  NOT_FOUND: 'The requested resource was not found.',
  INVALID_CREDENTIALS: 'The email or password provided is incorrect.',
  USER_INACTIVE: 'Your account is deactivated. Please contact an administrator.',
  TOKEN_EXPIRED: 'Your session has expired. Please sign in again.',
  NETWORK_ERROR: 'Unable to communicate with the server. Please check your network.',
};

export const WEEKDAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

export const SHORT_WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; border: string; badge: string }
> = {
  AVAILABLE: {
    label: 'Available',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    badge: 'bg-emerald-500',
  },
  OCCUPIED: {
    label: 'Occupied',
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200',
    badge: 'bg-rose-500',
  },
  PENDING: {
    label: 'Pending',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    badge: 'bg-amber-500',
  },
  CONFIRMED: {
    label: 'Confirmed',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    badge: 'bg-emerald-500',
  },
  CANCELLED: {
    label: 'Cancelled',
    bg: 'bg-slate-100',
    text: 'text-slate-600',
    border: 'border-slate-300',
    badge: 'bg-slate-400',
  },
  MAINTENANCE: {
    label: 'Maintenance',
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    border: 'border-orange-200',
    badge: 'bg-orange-500',
  },
  RESTRICTED: {
    label: 'Restricted',
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
    badge: 'bg-purple-500',
  },
  ACTIVE: {
    label: 'Active',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    badge: 'bg-emerald-500',
  },
  INACTIVE: {
    label: 'Inactive',
    bg: 'bg-slate-100',
    text: 'text-slate-500',
    border: 'border-slate-200',
    badge: 'bg-slate-400',
  },
  APPROVED: {
    label: 'Approved',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    badge: 'bg-emerald-500',
  },
  REJECTED: {
    label: 'Rejected',
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200',
    badge: 'bg-rose-500',
  },
};
