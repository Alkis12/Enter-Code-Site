from models.user import UserType, User
from fastapi import HTTPException, Depends
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any

from jose import jwt, JWTError
from passlib.context import CryptContext
from fastapi import status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import logging
import os

SECRET_KEY = os.getenv("SECRET_KEY", "secret")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
http_bearer = HTTPBearer()

logger = logging.getLogger("auth")

class AuthService:
    async def logout(self, access_token: str, refresh_token: str):
        try:
            user = await self.get_current_user(access_token)
            if not user or user.refresh_token != refresh_token:
                raise HTTPException(status_code=401, detail="Неверные токены")
            user.access_token = None
            user.refresh_token = None
            await user.save()
            self.logger.info(f"User {user.tg_username} logged out successfully")
            return True
        except HTTPException:
            # Re-raise HTTPExceptions without modification
            raise
        except Exception as e:
            self.logger.error(f"Error during logout: {str(e)}")
            raise HTTPException(status_code=500, detail="Ошибка при выходе из системы")

    async def update_user(self, access_token: str, data):
        try:
            user = await self.get_current_user(access_token)
            for field in ["full_name", "phone", "avatar_url", "bio"]:
                if hasattr(data, field) and getattr(data, field) is not None:
                    setattr(user, field, getattr(data, field))
            await user.save()
            self.logger.info(f"User {user.tg_username} data updated successfully")
            return user
        except HTTPException:
            # Re-raise HTTPExceptions without modification
            raise
        except Exception as e:
            self.logger.error(f"Error during user update: {str(e)}")
            raise HTTPException(status_code=500, detail="Ошибка при обновлении данных пользователя")

    async def change_password(self, access_token: str, old_password: str, new_password: str):
        try:
            user = await self.get_current_user(access_token)
            if not self.verify_password(old_password, user.password_hash):
                raise HTTPException(status_code=400, detail="Старый пароль неверен")
            user.password_hash = self.get_password_hash(new_password)
            await user.save()
            self.logger.info(f"User {user.tg_username} password changed successfully")
            return True
        except HTTPException:
            # Re-raise HTTPExceptions without modification
            raise
        except Exception as e:
            self.logger.error(f"Error during password change: {str(e)}")
            raise HTTPException(status_code=500, detail="Ошибка при изменении пароля")

    async def reset_password(self, tg_username: str, new_password: str, reset_code: str):
        try:
            user = await User.find_one(User.tg_username == tg_username)
            if not user:
                raise HTTPException(status_code=404, detail="Пользователь не найден")
            user.password_hash = self.get_password_hash(new_password)
            await user.save()
            self.logger.info(f"User {tg_username} password reset successfully")
            return True
        except HTTPException:
            # Re-raise HTTPExceptions without modification
            raise
        except Exception as e:
            self.logger.error(f"Error during password reset for user {tg_username}: {str(e)}")
            raise HTTPException(status_code=500, detail="Ошибка при сбросе пароля")

    async def get_user_info(self, access_token: str):
        try:
            user = await self.get_current_user(access_token)
            return user
        except HTTPException:
            # Re-raise HTTPExceptions without modification
            raise
        except Exception as e:
            self.logger.error(f"Error getting user info: {str(e)}")
            raise HTTPException(status_code=500, detail="Ошибка при получении информации о пользователе")

    async def delete_account(self, access_token: str):
        try:
            user = await self.get_current_user(access_token)
            await user.delete()
            self.logger.info(f"User {user.tg_username} account deleted successfully")
            return True
        except HTTPException:
            # Re-raise HTTPExceptions without modification
            raise
        except Exception as e:
            self.logger.error(f"Error during account deletion: {str(e)}")
            raise HTTPException(status_code=500, detail="Ошибка при удалении аккаунта")

    def __init__(self, secret_key: str = SECRET_KEY, algorithm: str = ALGORITHM, access_token_expire_minutes: int = ACCESS_TOKEN_EXPIRE_MINUTES):
        self.secret_key = secret_key
        self.algorithm = algorithm
        self.access_token_expire_minutes = access_token_expire_minutes
        self.pwd_context = pwd_context
        self.logger = logger

    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        self.logger.debug("Verifying user password")
        return self.pwd_context.verify(plain_password, hashed_password)

    def get_password_hash(self, password: str) -> str:
        self.logger.debug("Generating password hash")
        return self.pwd_context.hash(password)

    def create_access_token(self, data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
        self.logger.debug(f"Creating access token for user: {data.get('tg_username')}")
        to_encode = data.copy()
        if expires_delta:
            expire = datetime.now(timezone.utc) + expires_delta
        else:
            expire = datetime.now(timezone.utc) + timedelta(minutes=self.access_token_expire_minutes)
        to_encode.update({"exp": int(expire.timestamp())})
        token = jwt.encode(to_encode, self.secret_key, algorithm=self.algorithm)
        self.logger.debug(f"Access token created for user: {data.get('tg_username')}")
        return token

    async def authenticate_user(self, tg_username: str, password: str) -> Optional[User]:
        try:
            self.logger.info(f"Authentication attempt for user: {tg_username}")
            user = await User.find_one(User.tg_username == tg_username)
            if not user:
                self.logger.warning(f"User {tg_username} not found")
                return None
            if not self.verify_password(password, user.password_hash):
                self.logger.warning(f"Invalid password for user: {tg_username}")
                return None
            self.logger.info(f"User {tg_username} authenticated successfully")
            return user
        except Exception as e:
            self.logger.error(f"Error during authentication for user {tg_username}: {str(e)}")
            raise HTTPException(status_code=500, detail="Ошибка при аутентификации пользователя")

    async def register_user(self, register_data) -> User:
        try:
            self.logger.info(f"Registering new user: {register_data.tg_username}")
            if await User.find_one(User.tg_username == register_data.tg_username):
                self.logger.warning(f"User with username {register_data.tg_username} already exists")
                raise HTTPException(status_code=400, detail="Пользователь с таким Telegram username уже существует")
            if register_data.phone and await User.find_one(User.phone == register_data.phone):
                self.logger.warning(f"User with phone {register_data.phone} already exists")
                raise HTTPException(status_code=400, detail="Пользователь с таким телефоном уже существует")
            if register_data.password != register_data.password_repeat:
                self.logger.warning("Password and password repeat do not match")
                raise HTTPException(status_code=400, detail="Пароль и повтор пароля не совпадают")
            password_hash = self.get_password_hash(register_data.password)
            token_data = {"tg_username": register_data.tg_username}
            access_token = self.create_access_token(token_data)
            refresh_token = str(uuid.uuid4())
            user = User(
                name=register_data.name,
                surname=register_data.surname,
                tg_username=register_data.tg_username,
                user_type=register_data.user_type,
                phone=register_data.phone,
                avatar_url=register_data.avatar_url,
                bio=register_data.bio,
                access_token=access_token,
                refresh_token=refresh_token,
                password_hash=password_hash
            )
            await user.insert()
            self.logger.info(f"User {register_data.tg_username} registered successfully")
            return user
        except HTTPException:
            # Re-raise HTTPExceptions without modification
            raise
        except Exception as e:
            self.logger.error(f"Error during user registration for {register_data.tg_username}: {str(e)}")
            raise HTTPException(status_code=500, detail="Ошибка при регистрации пользователя")

    async def get_current_user(self, token: str) -> User:
        try:
            self.logger.debug("Verifying user token")
            credentials_exception = HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Не удалось проверить учетные данные",
                headers={"WWW-Authenticate": "Bearer"},
            )
            
            # Специальная проверка для дебаг-токена "0000"
            if token == "0000":
                user = await User.find_one(User.tg_username == "debug_admin")
                if user and user.user_type == UserType.ADMIN:
                    self.logger.debug("Used debug token 0000")
                    return user
                else:
                    self.logger.warning("Debug admin not found")
                    raise credentials_exception
            
            # Дополнительные тестовые токены
            test_tokens = {
                "test_student": ("test_student", UserType.STUDENT),
                "test_teacher": ("test_teacher", UserType.TEACHER),
                "test_admin": ("test_admin", UserType.ADMIN)
            }
            
            if token in test_tokens:
                username, user_type = test_tokens[token]
                user = await User.find_one(User.tg_username == username)
                if user:
                    self.logger.debug(f"Used test token: {token}")
                    return user
            
            try:
                payload = jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
                tg_username: Optional[str] = payload.get("tg_username")
                if tg_username is None:
                    self.logger.warning("Username is missing in token")
                    raise credentials_exception
            except JWTError:
                self.logger.warning("JWT token decoding error")
                raise credentials_exception
            user = await User.find_one(User.tg_username == tg_username)
            if user is None:
                self.logger.warning(f"User {tg_username} not found by token")
                raise credentials_exception
            self.logger.debug(f"Token verified for user: {tg_username}")
            return user
        except HTTPException:
            # Re-raise HTTPExceptions without modification
            raise
        except Exception as e:
            self.logger.error(f"Error during token verification: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Ошибка при проверке токена",
                headers={"WWW-Authenticate": "Bearer"},
            )

    async def refresh_tokens(self, refresh_token: str) -> dict:
        try:
            user = await User.find_one(User.refresh_token == refresh_token)
            if not user:
                self.logger.warning(f"Refresh token not found: {refresh_token}")
                raise HTTPException(status_code=401, detail="Неверный refresh token")
            token_data = {"tg_username": user.tg_username}
            access_token = self.create_access_token(token_data)
            # new_refresh_token = str(uuid.uuid4())
            # user.refresh_token = new_refresh_token
            user.access_token = access_token
            await user.save()
            self.logger.info(f"Tokens refreshed for user: {user.tg_username}")
            return {"access_token": access_token, "refresh_token": user.refresh_token}
        except HTTPException:
            # Re-raise HTTPExceptions without modification
            raise
        except Exception as e:
            self.logger.error(f"Error during token refresh: {str(e)}")
            raise HTTPException(status_code=500, detail="Ошибка при обновлении токенов")

    async def login(self, login_data) -> tuple[str, str]:
        """Аутентификация пользователя и генерация токенов"""
        try:
            self.logger.info(f"User login attempt: {login_data.tg_username}")
            user = await self.authenticate_user(login_data.tg_username, login_data.password)
            if not user:
                raise HTTPException(status_code=401, detail="Неверный логин или пароль")
            
            # Генерируем новые токены
            token_data = {"tg_username": user.tg_username}
            access_token = self.create_access_token(token_data)
            refresh_token = str(uuid.uuid4())
            
            # Обновляем токены пользователя
            user.access_token = access_token
            user.refresh_token = refresh_token
            await user.save()
            
            self.logger.info(f"User {user.tg_username} logged in successfully")
            return access_token, refresh_token
        except HTTPException:
            # Re-raise HTTPExceptions without modification
            raise
        except Exception as e:
            self.logger.error(f"Error during login: {str(e)}")
            raise HTTPException(status_code=500, detail="Ошибка при входе в систему")

    async def register(self, register_data) -> User:
        """Регистрация нового пользователя"""
        try:
            return await self.register_user(register_data)
        except HTTPException:
            # Re-raise HTTPExceptions without modification
            raise
        except Exception as e:
            self.logger.error(f"Error during registration: {str(e)}")
            raise HTTPException(status_code=500, detail="Ошибка при регистрации")

    async def refresh_access_token(self, refresh_data):
        """Обновление access токена по refresh токену"""
        try:
            tokens = await self.refresh_tokens(refresh_data.refresh_token)
            return tokens["access_token"]
        except HTTPException:
            # Re-raise HTTPExceptions without modification
            raise
        except Exception as e:
            self.logger.error(f"Error during access token refresh: {str(e)}")
            raise HTTPException(status_code=500, detail="Ошибка при обновлении токена доступа")

    async def get_current_user_from_bearer(self, credentials: HTTPAuthorizationCredentials = Depends(http_bearer)) -> User:
        """Получение текущего пользователя из Bearer токена для Swagger UI"""
        return await self.get_current_user(credentials.credentials)

def get_auth_service():
    return AuthService()

# Dependency для получения текущего пользователя (Bearer токен)
async def get_current_user_dependency(auth_service: AuthService = Depends(get_auth_service), credentials: HTTPAuthorizationCredentials = Depends(http_bearer)) -> User:
    return await auth_service.get_current_user_from_bearer(credentials)

# Альтернативная dependency функция для получения пользователя через Bearer токен
from fastapi import Request
from fastapi.security.utils import get_authorization_scheme_param

async def get_current_user_bearer_dependency(
    request: Request,
    auth_service: AuthService = Depends(get_auth_service)
) -> User:
    """Получение пользователя через Bearer токен из заголовка Authorization"""
    logger.debug("Checking Authorization header")
    authorization = request.headers.get("Authorization")
    if not authorization:
        logger.warning("Authorization header missing")
        raise HTTPException(
            status_code=401,
            detail="Authorization header missing",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    logger.debug(f"Authorization header: {authorization[:20]}...")
    scheme, token = get_authorization_scheme_param(authorization)
    if scheme.lower() != "bearer":
        logger.warning(f"Invalid authentication scheme: {scheme}")
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication scheme",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not token:
        logger.warning("Token missing in Authorization header")
        raise HTTPException(
            status_code=401,
            detail="Token missing",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    logger.debug(f"Extracted token: {token[:20]}...")
    return await auth_service.get_current_user(token)

# Функция для проверки роли пользователя (для использования в роутерах)
async def get_current_user_with_role(access_token: str, min_role: UserType) -> User:
    """Получить пользователя и проверить его роль по access_token"""
    auth_service = AuthService()
    user = await auth_service.get_current_user(access_token)
    
    role_order = [UserType.STUDENT, UserType.TEACHER, UserType.ADMIN]
    if role_order.index(user.user_type) < role_order.index(min_role):
        raise HTTPException(status_code=403, detail="Недостаточно прав")
    return user

# Dependency для FastAPI endpoints с проверкой роли
def require_role(min_role: UserType):
    async def role_dependency(user: User = Depends(get_current_user_dependency)):
        role_order = [UserType.STUDENT, UserType.TEACHER, UserType.ADMIN]
        if role_order.index(user.user_type) < role_order.index(min_role):
            raise HTTPException(status_code=403, detail="Недостаточно прав")
        return user
    return role_dependency
