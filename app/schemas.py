"""Pydantic schemas for API responses (OpenAPI)."""
from typing import List, Optional

from pydantic import BaseModel


class LessonItem(BaseModel):
    id: int
    day: str
    pair: int
    subject: str
    type: str
    teacher: str
    room: str
    weeks: List[int]


class ScheduleResponse(BaseModel):
    items: List[LessonItem]
    total: int
    limit: int
    offset: int


class MeResponse(BaseModel):
    telegram_id: str
    name: str
    created_at: Optional[str] = None
    avatar: Optional[str] = None
    ratings_count: Optional[int] = None


class HealthResponse(BaseModel):
    status: str
    version: Optional[str] = None
    env: Optional[str] = None
    database: Optional[str] = None
