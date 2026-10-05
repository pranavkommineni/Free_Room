from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.schemas.common import OutDT


class RegisterRequest(BaseModel):
    """Self-registration is STUDENT-only. `role` is deliberately NOT a field and unknown fields are
    rejected, so {"role": "ADMIN"} yields 422 (no privilege escalation)."""
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(min_length=10, max_length=128)
    student_roll_no: str = Field(min_length=3, max_length=30)
    department: str = Field(min_length=1, max_length=80)
    year: int = Field(ge=1, le=8)
    section_id: int | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_at: OutDT


class MeResponse(BaseModel):
    id: int
    name: str
    email: EmailStr
    role: str
    is_active: bool
    student_id: int | None = None
    student_roll_no: str | None = None
    section_id: int | None = None
    faculty_id: int | None = None
    faculty_code: str | None = None
