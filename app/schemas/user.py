from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator

from app.models.enums import Role
from app.schemas.common import ORM, OutDT


class UserOut(ORM):
    id: int
    name: str
    email: EmailStr
    role: str
    is_active: bool
    created_at: OutDT


class AdminUserCreate(BaseModel):
    """Admin-only: create STUDENT / FACULTY / ADMIN accounts."""
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(min_length=10, max_length=128)
    role: Role
    department: str | None = None
    student_roll_no: str | None = None
    year: int | None = Field(default=None, ge=1, le=8)
    section_id: int | None = None
    faculty_code: str | None = None
    designation: str | None = None

    @model_validator(mode="after")
    def _profile(self):
        if self.role == Role.STUDENT and not (self.student_roll_no and self.department and self.year):
            raise ValueError("STUDENT requires student_roll_no, department and year")
        if self.role == Role.FACULTY and not (self.faculty_code and self.department):
            raise ValueError("FACULTY requires faculty_code and department")
        return self


class UserUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str | None = Field(default=None, min_length=1, max_length=120)
    is_active: bool | None = None


class CourseCreate(BaseModel):
    course_code: str = Field(min_length=2, max_length=30)
    course_name: str = Field(min_length=1, max_length=200)
    department: str
    credits: int = Field(default=3, ge=0, le=30)


class CourseOut(ORM):
    id: int
    course_code: str
    course_name: str
    department: str
    credits: int
    is_active: bool


class SectionCreate(BaseModel):
    code: str = Field(min_length=1, max_length=40)
    department: str
    year: int = Field(ge=1, le=8)
    section_name: str
    academic_year: str
    semester: str


class SectionOut(ORM):
    id: int
    code: str
    department: str
    year: int
    section_name: str
    academic_year: str
    semester: str
