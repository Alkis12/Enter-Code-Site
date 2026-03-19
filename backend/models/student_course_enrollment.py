from datetime import datetime
from enum import Enum
from typing import List, Optional

from beanie import Document
from pydantic import BaseModel, Field


class PaymentMode(str, Enum):
    SUBSCRIPTION = "subscription"
    PER_LESSON = "per_lesson"


class MonthlyPaymentRecord(BaseModel):
    month: str = Field(..., pattern=r"^\d{4}-\d{2}$")
    label: str = Field(..., min_length=1, max_length=120)
    note: str = Field(default="", max_length=500)
    paid_at: datetime = Field(default_factory=datetime.utcnow)


class PrepaymentRecord(BaseModel):
    lessons_count: int = Field(..., ge=1)
    note: str = Field(default="", max_length=500)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class StudentCourseEnrollment(Document):
    student_id: str = Field(...)
    course_id: str = Field(...)
    group_id: Optional[str] = Field(default=None)
    payment_mode: PaymentMode = Field(default=PaymentMode.SUBSCRIPTION)
    enrolled_on: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    monthly_payments: List[MonthlyPaymentRecord] = Field(default_factory=list)
    prepayment_history: List[PrepaymentRecord] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    def touch(self) -> None:
        self.updated_at = datetime.utcnow()

    class Settings:
        name = "student_course_enrollments"
