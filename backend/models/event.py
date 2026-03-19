from enum import Enum
from typing import List, Optional
from datetime import date
from beanie import Document
from pydantic import BaseModel, Field


class ScheduleType(str, Enum):
    ONCE = "once"
    WEEKLY = "weekly"


class EventTag(BaseModel):
    label: str = Field(..., min_length=1, max_length=50)
    color: Optional[str] = Field(default=None, max_length=20)


class Event(Document):
    title: str = Field(..., min_length=1, max_length=200)
    description: str = Field(default="", max_length=2000)

    schedule_type: ScheduleType = Field(default=ScheduleType.WEEKLY)
    date: Optional[date] = None
    weekday: Optional[int] = Field(default=None, ge=0, le=6)
    start_time: str = Field(..., pattern=r"^\d{2}:\d{2}$")
    end_time: Optional[str] = Field(default=None, pattern=r"^\d{2}:\d{2}$")

    image_url: Optional[str] = Field(default=None, max_length=500)
    button_color: Optional[str] = Field(default=None, max_length=20)
    card_color: Optional[str] = Field(default=None, max_length=20)
    text_color: Optional[str] = Field(default=None, max_length=20)

    tags: List[EventTag] = Field(default_factory=list)
    is_active: bool = Field(default=True)

    class Settings:
        name = "events"
