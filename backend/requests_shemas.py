from pydantic import BaseModel, Field
from models.user import UserType, UserStatus

class LoginRequest(BaseModel):
    """Request schema for user login."""
    tg_username: str = Field(..., min_length=2, max_length=33, pattern=r"^[a-zA-Z0-9_]{1,50}$")
    password: str = Field(..., min_length=8, max_length=128)

class RegisterRequest(BaseModel):
    """Request schema for user registration."""
    name: str = Field(..., min_length=1, max_length=100)
    surname: str = Field(..., min_length=1, max_length=100)
    tg_username: str = Field(..., min_length=2, max_length=33, pattern=r"^[a-zA-Z0-9_]{1,50}$")
    user_type: UserType
    phone: str | None = Field(default=None, max_length=20)
    password: str = Field(..., min_length=8, max_length=128)
    password_repeat: str = Field(..., min_length=8, max_length=128)
    avatar_url: str | None = Field(default=None, max_length=300)
    bio: str | None = Field(default=None, max_length=500)

class RefreshRequest(BaseModel):
    """Request schema for refreshing tokens."""
    refresh_token: str = Field(..., min_length=32, max_length=64)