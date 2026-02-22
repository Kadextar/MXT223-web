from typing import Any, List, Optional
from pydantic import BaseModel


class LoginRequest(BaseModel):
    telegram_id: str
    password: str
    remember_me: Optional[bool] = False
    totp_code: Optional[str] = None


class ForgotPasswordRequest(BaseModel):
    telegram_id: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class TOTPVerifyRequest(BaseModel):
    code: str


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class RateTeacherRequest(BaseModel):
    teacher_id: int
    rating: int
    tags: Optional[Any] = None
    comment: Optional[str] = None


class SubjectReviewCreate(BaseModel):
    body: str
    subject_name: str


class AnnouncementReadRequest(BaseModel):
    identifier: Optional[str] = None


class ScheduleItemCreate(BaseModel):
    day: str
    pair: int
    subject: str
    type: str
    teacher: str
    room: str
    week_start: int
    week_end: int


class TeacherCreate(BaseModel):
    name: str
    subject: Optional[str] = None


class AnnouncementUpdate(BaseModel):
    message: Optional[str] = None
    schedule_context: Optional[dict] = None
