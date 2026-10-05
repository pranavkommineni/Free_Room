// API models matching FastAPI schemas exactly

export type Role = 'STUDENT' | 'FACULTY' | 'ADMIN';
export type RoomType = 'CLASSROOM' | 'LAB' | 'SEMINAR_HALL' | 'AUDITORIUM';
export type RoomStatus = 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
export type ChangeType = 'RESCHEDULED' | 'ROOM_CHANGED' | 'TIME_CHANGED' | 'CANCELLED';
export type ChangeStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN';
export type MaintenanceStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type RestrictionStatus = 'ACTIVE' | 'LIFTED';

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiErrorResponse {
  success: false;
  error: ApiError;
}

export interface PageResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface MessageResponse {
  message: string;
}

// Authentication
export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_at: string;
}

export interface MeResponse {
  id: number;
  name: string;
  email: string;
  role: Role;
  is_active: boolean;
  student_id?: number | null;
  student_roll_no?: string | null;
  section_id?: number | null;
  faculty_id?: number | null;
  faculty_code?: string | null;
}

export interface UserOut {
  id: number;
  name: string;
  email: string;
  role: Role;
  is_active: boolean;
  created_at: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  student_roll_no: string;
  department: string;
  year: number;
  section_id?: number | null;
}

export interface LoginRequest {
  email: string;
  password: string;
}

// Rooms & Buildings
export interface FloorOut {
  id: number;
  floor_number: number;
}

export interface BuildingOut {
  id: number;
  name: string;
  code: string;
  floors: FloorOut[];
}

export interface RoomOut {
  id: number;
  floor_id: number;
  building_code: string;
  floor_number: number;
  room_number: string;
  display_name: string;
  capacity: number;
  room_type: string;
  has_ac: boolean;
  has_projector: boolean;
  student_accessible: boolean;
  status: string;
}

export interface RoomCreate {
  floor_id: number;
  room_number: string;
  capacity: number;
  room_type?: RoomType;
  has_ac?: boolean;
  has_projector?: boolean;
  student_accessible?: boolean;
  status?: RoomStatus;
}

export interface RoomUpdate {
  room_number?: string;
  capacity?: number;
  room_type?: RoomType;
  has_ac?: boolean;
  has_projector?: boolean;
  student_accessible?: boolean;
  status?: RoomStatus;
}

// Availability
export interface AvailableRoom {
  room_id: number;
  room_number: string;
  display_name: string;
  floor: number;
  capacity: number;
  has_projector: boolean;
  has_ac: boolean;
  available_until: string;
}

export interface AvailabilityResponse {
  requested_start: string;
  requested_end: string;
  total_available: number;
  rooms: AvailableRoom[];
}

export interface BreakResponse extends AvailabilityResponse {
  student_id: number;
  student_free: boolean;
  student_conflicts: string[];
}

export interface ConflictOut {
  code: string;
  message: string;
  start?: string | null;
  end?: string | null;
  ref_id?: number | null;
}

export interface RoomCheckResponse {
  room_id: number;
  available: boolean;
  conflicts: ConflictOut[];
}

export interface RecommendedRoom extends AvailableRoom {
  score: number;
  score_breakdown: Record<string, number>;
}

export interface RecommendationResponse {
  requested_start: string;
  requested_end: string;
  weights: Record<string, number>;
  rooms: RecommendedRoom[];
}

// Bookings
export interface BookingCreate {
  room_id: number;
  start_datetime: string;
  end_datetime: string;
  purpose?: string | null;
}

export interface BookingOut {
  id: number;
  room_id: number;
  user_id: number;
  start_datetime: string;
  end_datetime: string;
  purpose?: string | null;
  status: string;
  created_at: string;
}

// Timetable
export interface OccurrenceOut {
  slot_id: number;
  course_code: string;
  course_name: string;
  faculty_id: number;
  section_id: number;
  room_id: number;
  room?: string | null;
  start: string;
  end: string;
  source: string; // "REGULAR" | "RESCHEDULED" | "CANCELLED"
  change_id?: number | null;
}

export interface PeriodStatus {
  period_number: number;
  start: string;
  end: string;
  status: 'CLASS' | 'FREE';
  course_code?: string | null;
  room?: string | null;
}

export interface FreeInterval {
  start: string;
  end: string;
}

export interface FreePeriodsResponse {
  student_id: number;
  date: string;
  periods: PeriodStatus[];
  free_intervals: FreeInterval[];
}

export interface PeriodOut {
  id: number;
  period_number: number;
  start_time: string;
  end_time: string;
  label?: string | null;
  is_active: boolean;
}

export interface PeriodCreate {
  period_number: number;
  start_time: string;
  end_time: string;
  label?: string | null;
}

export interface SlotCreate {
  course_id: number;
  faculty_id: number;
  room_id: number;
  section_id: number;
  day_of_week: number; // 0=Monday .. 6=Sunday
  period_number: number;
  start_time: string;
  end_time: string;
  academic_year: string;
  semester: string;
}

export interface SlotUpdate {
  room_id?: number;
  faculty_id?: number;
  start_time?: string;
  end_time?: string;
  period_number?: number;
  is_active?: boolean;
}

export interface SlotOut {
  id: number;
  course_id: number;
  faculty_id: number;
  room_id: number;
  section_id: number;
  day_of_week: number;
  period_number: number;
  start_time: string;
  end_time: string;
  academic_year: string;
  semester: string;
  is_active: boolean;
}

// Schedule Changes
export interface ScheduleChangeCreate {
  timetable_slot_id: number;
  original_date: string;
  change_type: ChangeType;
  new_date?: string | null;
  new_start_time?: string | null;
  new_end_time?: string | null;
  new_room_id?: number | null;
  reason?: string | null;
}

export interface CancelOccurrence {
  timetable_slot_id: number;
  original_date: string;
  reason?: string | null;
}

export interface Decision {
  note?: string | null;
}

export interface ScheduleChangeOut {
  id: number;
  timetable_slot_id: number;
  original_date: string;
  original_room_id: number;
  original_start_time: string;
  original_end_time: string;
  new_date?: string | null;
  new_room_id?: number | null;
  new_start_time?: string | null;
  new_end_time?: string | null;
  change_type: string;
  reason?: string | null;
  decision_note?: string | null;
  requested_by: number;
  approved_by?: number | null;
  status: string;
  created_at: string;
  approved_at?: string | null;
  rejected_at?: string | null;
}

// Maintenance & Restrictions
export interface MaintenanceCreate {
  room_id: number;
  start_datetime: string;
  end_datetime: string;
  reason: string;
}

export interface MaintenanceUpdate {
  start_datetime?: string;
  end_datetime?: string;
  reason?: string;
  status?: MaintenanceStatus;
}

export interface MaintenanceOut {
  id: number;
  room_id: number;
  start_datetime: string;
  end_datetime: string;
  reason: string;
  reported_by: number;
  status: string;
  created_at: string;
}

export interface RestrictionCreate {
  room_id: number;
  start_datetime: string;
  end_datetime: string;
  reason: string;
}

export interface RestrictionOut {
  id: number;
  room_id: number;
  start_datetime: string;
  end_datetime: string;
  reason: string;
  created_by: number;
  status: string;
  created_at: string;
}

// Notifications
export interface NotificationOut {
  id: number;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

// Analytics
export interface RoomAnalytics {
  total_rooms: number;
  active_rooms: number;
  inactive_rooms: number;
  available_now: number;
  occupied_now: number;
  as_of: string;
}

export interface BookingAnalytics {
  range_start: string;
  range_end: string;
  total_bookings: number;
  by_status: Record<string, number>;
  active_bookings_now: number;
  upcoming_bookings: number;
  cancellation_count: number;
  cancellation_rate: number;
}

export interface RoomUtilization {
  room_id: number;
  display_name: string;
  booked_hours: number;
  class_hours: number;
  total_hours: number;
  utilization_pct: number;
  booking_count: number;
}

export interface UtilizationAnalytics {
  range_start: string;
  range_end: string;
  working_days: number;
  available_hours_per_room: number;
  rooms: RoomUtilization[];
  most_used: RoomUtilization[];
  least_used: RoomUtilization[];
}

export interface AuditLogOut {
  id: number;
  user_id?: number | null;
  action: string;
  entity_type: string;
  entity_id?: number | null;
  old_data?: Record<string, unknown> | null;
  new_data?: Record<string, unknown> | null;
  created_at: string;
}

// Courses and Sections
export interface CourseCreate {
  course_code: string;
  course_name: string;
  department: string;
  credits: number;
}

export interface CourseOut {
  id: number;
  course_code: string;
  course_name: string;
  department: string;
  credits: number;
  is_active: boolean;
}

export interface SectionCreate {
  code: string;
  department: string;
  year: number;
  section_name: string;
  academic_year: string;
  semester: string;
}

export interface SectionOut {
  id: number;
  code: string;
  department: string;
  year: number;
  section_name: string;
  academic_year: string;
  semester: string;
}

export interface AdminUserCreate {
  name: string;
  email: string;
  password: string;
  role: Role;
  department?: string;
  student_roll_no?: string;
  year?: number;
  section_id?: number;
  faculty_code?: string;
  designation?: string;
}

export interface UserUpdate {
  name?: string;
  is_active?: boolean;
}

// CSV Timetable Import
export interface ImportErrorDetail {
  row: number;
  field?: string | null;
  code: string;
  message: string;
}

export interface ImportPreview {
  import_id: number;
  filename: string;
  total_rows: number;
  valid_rows: number;
  error_count: number;
  errors: ImportErrorDetail[];
  can_commit: boolean;
}

export interface ImportCommitResult {
  import_id: number;
  inserted: number;
  skipped: number;
  status: string;
}
