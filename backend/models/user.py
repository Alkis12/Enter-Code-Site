from datetime import datetime
from enum import Enum
from typing import Optional
from beanie import Document
from pydantic import Field, EmailStr
from bson import ObjectId


class UserType(str, Enum):
    """Enumeration for user types."""
    STUDENT = "student"
    TEACHER = "teacher"
    ADMIN = "admin"


class UserStatus(str, Enum):
    """Enumeration for user status."""
    ACTIVE = "active"
    INACTIVE = "inactive"


class User(Document):
    """User document model for MongoDB."""
    id: str = Field(default_factory=lambda: str(ObjectId()), unique=True, description="Unique user identifier")
    
    name: str = Field(..., min_length=1, max_length=100, description="User's first name")
    surname: str = Field(..., min_length=1, max_length=100, description="User's last name")
    tg_username: str = Field(..., min_length=2, max_length=33, pattern=r"^[a-zA-Z0-9_]{1,50}$", description="Telegram username without @")
    
    user_type: UserType = Field(..., description="Type of user")
    status: UserStatus = Field(default=UserStatus.ACTIVE, description="User status")
    
    phone: Optional[str] = Field(default=None, max_length=20, unique=True, description="Phone number")
    avatar_url: Optional[str] = Field(default=None, description="Avatar URL")
    bio: Optional[str] = Field(default=None, max_length=500, description="Short biography")
    
    access_token: Optional[str] = Field(default=None, description="User's access token")
    refresh_token: Optional[str] = Field(default=None, description="Refresh token for access renewal")
    password_hash: str = Field(..., description="User's password hash")
    
    def is_active(self) -> bool:
        """Check if the user is active."""
        return self.status == UserStatus.ACTIVE
    
    def __str__(self):
        return f"{self.full_name} ({self.tg_username}) - {self.user_type.value.capitalize()} - {self.status.value.capitalize()}"
    
    @property
    def full_name(self) -> str:
        """Return the user's full name."""
        return f"{self.name} {self.surname}"

async def get_by_tg_username(tg_username: str):
    """Get a user by their Telegram username."""
    return await User.find_one(User.tg_username == tg_username)

async def get_by_phone(self, phone: str):
    """Get a user by their phone number."""
    return await User.find_one(User.phone == phone)