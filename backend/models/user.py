from datetime import datetime
from enum import Enum
from typing import List, Optional

from beanie import Document
from pydantic import BaseModel, Field


class UserType(str, Enum):
    PARENT = "parent"
    STUDENT = "student"
    TEACHER = "teacher"
    ADMIN = "admin"


class UserStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class SubscriptionStatus(str, Enum):
    PAID = "paid"
    UNPAID = "unpaid"
    EXPIRED = "expired"


class AchievementUnlock(BaseModel):
    achievement_id: str
    unlocked_at: datetime = Field(default_factory=datetime.utcnow)


class User(Document):
    name: str = Field(..., min_length=1, max_length=100)
    surname: str = Field(..., min_length=1, max_length=100)
    tg_username: str = Field(
        ...,
        min_length=2,
        max_length=33,
        pattern=r"^[a-zA-Z0-9_]{1,50}$",
        description="Login name without @",
    )
    telegram_id: Optional[str] = Field(default=None, max_length=100)

    user_type: UserType = Field(default=UserType.STUDENT)
    status: UserStatus = Field(default=UserStatus.ACTIVE)

    phone: Optional[str] = Field(default=None, max_length=20)
    avatar_url: Optional[str] = Field(default=None)
    bio: Optional[str] = Field(default=None, max_length=500)
    linked_student_ids: List[str] = Field(default_factory=list)

    access_token: Optional[str] = Field(default=None)
    refresh_token: Optional[str] = Field(default=None)
    password_hash: str = Field(...)

    subscription_status: SubscriptionStatus = Field(default=SubscriptionStatus.UNPAID)
    lessons_remaining: int = Field(default=0, ge=0)
    points: int = Field(default=0, ge=0)

    unlocked_achievements: List[AchievementUnlock] = Field(default_factory=list)
    last_login_at: Optional[datetime] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    def touch(self) -> None:
        self.updated_at = datetime.utcnow()

    @property
    def full_name(self) -> str:
        return f"{self.name} {self.surname}".strip()

    def is_active(self) -> bool:
        return self.status == UserStatus.ACTIVE

    def has_valid_subscription(self) -> bool:
        if self.user_type != UserType.STUDENT:
            return True
        return self.subscription_status == SubscriptionStatus.PAID and self.lessons_remaining > 0

    def use_lesson(self) -> bool:
        if not self.has_valid_subscription():
            return False
        if self.lessons_remaining <= 0:
            return False
        self.lessons_remaining -= 1
        if self.lessons_remaining == 0:
            self.subscription_status = SubscriptionStatus.EXPIRED
        self.touch()
        return True

    def extend_subscription(self, lessons_count: int) -> None:
        self.lessons_remaining += lessons_count
        self.subscription_status = SubscriptionStatus.PAID
        self.touch()

    def award_points(self, amount: int) -> None:
        if amount <= 0:
            return
        self.points += amount
        self.touch()

    def remove_points(self, amount: int) -> None:
        if amount <= 0:
            return
        self.points = max(0, self.points - amount)
        self.touch()

    def has_achievement(self, achievement_id: str) -> bool:
        return any(item.achievement_id == achievement_id for item in self.unlocked_achievements)

    def unlock_achievement(self, achievement_id: str) -> bool:
        if self.has_achievement(achievement_id):
            return False
        self.unlocked_achievements.append(AchievementUnlock(achievement_id=achievement_id))
        self.touch()
        return True

    class Settings:
        name = "users"
