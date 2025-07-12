from pydantic import BaseModel
from models.user import UserType, UserStatus

class UserCreateRequest(BaseModel):
    name: str
    surname: str
    tg_username: str
    user_type: UserType
    status: UserStatus = UserStatus.ACTIVE
    phone: str | None = None
    avatar_url: str | None = None
    bio: str | None = None