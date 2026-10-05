"""Import every model so Base.metadata is complete (needed by Alembic)."""
from app.models.admin import Admin
from app.models.audit_log import AuditLog
from app.models.base import Base
from app.models.booking import RoomBooking
from app.models.building import Building
from app.models.course import Course
from app.models.faculty import Faculty
from app.models.floor import Floor
from app.models.maintenance import RoomMaintenance
from app.models.notification import Notification
from app.models.period import AcademicPeriod
from app.models.restriction import RoomRestriction
from app.models.room import Room
from app.models.schedule_change import ScheduleChange
from app.models.section import Section
from app.models.student import Student
from app.models.timetable import TimetableSlot
from app.models.timetable_import import TimetableImport
from app.models.token import RevokedToken
from app.models.user import User

__all__ = [n for n in dir() if n[0].isupper()]
