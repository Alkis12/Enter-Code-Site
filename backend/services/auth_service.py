import logging
import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.security.utils import get_authorization_scheme_param
from jose import JWTError, jwt
from passlib.context import CryptContext

from models.achievement import AchievementTrigger
from models.user import User, UserType
from services.achievement_service import unlock_achievements_for_trigger


SECRET_KEY = os.getenv("SECRET_KEY", "secret")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
http_bearer = HTTPBearer()
logger = logging.getLogger("auth")


class AuthService:
    def __init__(
        self,
        secret_key: str = SECRET_KEY,
        algorithm: str = ALGORITHM,
        access_token_expire_minutes: int = ACCESS_TOKEN_EXPIRE_MINUTES,
    ):
        self.secret_key = secret_key
        self.algorithm = algorithm
        self.access_token_expire_minutes = access_token_expire_minutes
        self.logger = logger

    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        return pwd_context.verify(plain_password, hashed_password)

    def get_password_hash(self, password: str) -> str:
        return pwd_context.hash(password)

    def create_access_token(
        self, data: Dict[str, Any], expires_delta: Optional[timedelta] = None
    ) -> str:
        to_encode = data.copy()
        expire = datetime.now(timezone.utc) + (
            expires_delta or timedelta(minutes=self.access_token_expire_minutes)
        )
        to_encode.update({"exp": int(expire.timestamp())})
        return jwt.encode(to_encode, self.secret_key, algorithm=self.algorithm)

    async def authenticate_user(self, tg_username: str, password: str) -> Optional[User]:
        user = await User.find_one(User.tg_username == tg_username)
        if not user:
            return None
        if not self.verify_password(password, user.password_hash):
            return None
        return user

    async def register_user(self, register_data) -> User:
        if await User.find_one(User.tg_username == register_data.tg_username):
            raise HTTPException(status_code=400, detail="Пользователь с таким логином уже существует")
        if register_data.phone and await User.find_one(User.phone == register_data.phone):
            raise HTTPException(status_code=400, detail="Пользователь с таким телефоном уже существует")
        if register_data.password != register_data.password_repeat:
            raise HTTPException(status_code=400, detail="Пароль и повтор пароля не совпадают")

        user = User(
            name=register_data.name,
            surname=register_data.surname,
            tg_username=register_data.tg_username,
            telegram_id=register_data.telegram_id,
            user_type=register_data.user_type,
            phone=register_data.phone,
            avatar_url=register_data.avatar_url,
            bio=register_data.bio,
            password_hash=self.get_password_hash(register_data.password),
        )
        await user.insert()
        return user

    async def register(self, register_data) -> User:
        return await self.register_user(register_data)

    async def login(self, login_data) -> tuple[str, str, list]:
        user = await self.authenticate_user(login_data.tg_username, login_data.password)
        if not user:
            raise HTTPException(status_code=401, detail="Неверный логин или пароль")

        token_data = {"tg_username": user.tg_username}
        access_token = self.create_access_token(token_data)
        refresh_token = str(uuid.uuid4())
        user.access_token = access_token
        user.refresh_token = refresh_token
        user.last_login_at = datetime.utcnow()
        user.touch()
        unlocked = await unlock_achievements_for_trigger(user, AchievementTrigger.FIRST_LOGIN)
        await user.save()
        return access_token, refresh_token, unlocked

    async def refresh_tokens(self, refresh_token: str) -> dict:
        user = await User.find_one(User.refresh_token == refresh_token)
        if not user:
            raise HTTPException(status_code=401, detail="Неверный refresh token")
        access_token = self.create_access_token({"tg_username": user.tg_username})
        user.access_token = access_token
        user.touch()
        await user.save()
        return {"access_token": access_token, "refresh_token": user.refresh_token}

    async def refresh_access_token(self, refresh_data):
        tokens = await self.refresh_tokens(refresh_data.refresh_token)
        return tokens["access_token"]

    async def get_current_user(self, token: str) -> User:
        credentials_exception = HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Не удалось проверить учетные данные",
            headers={"WWW-Authenticate": "Bearer"},
        )

        try:
            payload = jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
            tg_username: Optional[str] = payload.get("tg_username")
            if tg_username is None:
                raise credentials_exception
        except JWTError as exc:
            self.logger.warning("JWT decoding error: %s", exc)
            raise credentials_exception

        user = await User.find_one(User.tg_username == tg_username)
        if not user:
            raise credentials_exception
        return user

    async def get_user_info(self, access_token: str) -> User:
        return await self.get_current_user(access_token)

    async def logout(self, access_token: str, refresh_token: str):
        user = await self.get_current_user(access_token)
        if user.refresh_token != refresh_token:
            raise HTTPException(status_code=401, detail="Неверные токены")
        user.access_token = None
        user.refresh_token = None
        user.touch()
        await user.save()
        return True

    async def delete_account(self, access_token: str):
        user = await self.get_current_user(access_token)
        await user.delete()
        return True

    async def get_current_user_from_bearer(
        self, credentials: HTTPAuthorizationCredentials = Depends(http_bearer)
    ) -> User:
        return await self.get_current_user(credentials.credentials)


def get_auth_service():
    return AuthService()


async def get_current_user_dependency(
    auth_service: AuthService = Depends(get_auth_service),
    credentials: HTTPAuthorizationCredentials = Depends(http_bearer),
) -> User:
    return await auth_service.get_current_user_from_bearer(credentials)


async def get_current_user_bearer_dependency(
    request: Request,
    auth_service: AuthService = Depends(get_auth_service),
) -> User:
    authorization = request.headers.get("Authorization")
    if not authorization:
        raise HTTPException(
            status_code=401,
            detail="Authorization header missing",
            headers={"WWW-Authenticate": "Bearer"},
        )

    scheme, token = get_authorization_scheme_param(authorization)
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication scheme",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return await auth_service.get_current_user(token)


async def get_current_user_with_role(access_token: str, min_role: UserType) -> User:
    auth_service = AuthService()
    user = await auth_service.get_current_user(access_token)
    role_order = [UserType.STUDENT, UserType.TEACHER, UserType.ADMIN]
    if role_order.index(user.user_type) < role_order.index(min_role):
        raise HTTPException(status_code=403, detail="Недостаточно прав")
    return user


def require_role(min_role: UserType):
    async def role_dependency(user: User = Depends(get_current_user_dependency)):
        role_order = [UserType.STUDENT, UserType.TEACHER, UserType.ADMIN]
        if role_order.index(user.user_type) < role_order.index(min_role):
            raise HTTPException(status_code=403, detail="Недостаточно прав")
        return user

    return role_dependency
