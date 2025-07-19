import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any

from jose import jwt, JWTError
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from models.user import User
import logging
import os

SECRET_KEY = os.getenv("SECRET_KEY", "secret")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

logger = logging.getLogger("auth")

class AuthService:
    """
    Authentication service for managing users and tokens.
    """
    def __init__(self, secret_key: str = SECRET_KEY, algorithm: str = ALGORITHM, access_token_expire_minutes: int = ACCESS_TOKEN_EXPIRE_MINUTES):
        self.secret_key = secret_key
        self.algorithm = algorithm
        self.access_token_expire_minutes = access_token_expire_minutes
        self.pwd_context = pwd_context
        self.logger = logger

    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """Verify user's password."""
        self.logger.debug("Verifying user password")
        return self.pwd_context.verify(plain_password, hashed_password)

    def get_password_hash(self, password: str) -> str:
        """Generate password hash."""
        self.logger.debug("Generating password hash")
        return self.pwd_context.hash(password)

    def create_access_token(self, data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
        """Create access token for user."""
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
        """Authenticate user by username and password."""
        self.logger.info(f"Trying to authenticate user: {tg_username}")
        user = await User.find_one(User.tg_username == tg_username)
        if not user:
            self.logger.warning(f"User {tg_username} not found")
            return None
        if not self.verify_password(password, user.password_hash):
            self.logger.warning(f"Invalid password for user: {tg_username}")
            return None
        self.logger.info(f"User {tg_username} authenticated successfully")
        return user

    async def register_user(self, register_data) -> User:
        """Register a new user, check uniqueness and password match, and return user object."""
        self.logger.info(f"Registering new user: {register_data.tg_username}")
        if await User.find_one(User.tg_username == register_data.tg_username):
            self.logger.warning(f"User with username {register_data.tg_username} already exists")
            raise HTTPException(status_code=400, detail="A user with this Telegram username already exists")
        if register_data.phone and await User.find_one(User.phone == register_data.phone):
            self.logger.warning(f"User with phone {register_data.phone} already exists")
            raise HTTPException(status_code=400, detail="A user with this phone already exists")
        if register_data.password != register_data.password_repeat:
            self.logger.warning("Password and password repeat do not match")
            raise HTTPException(status_code=400, detail="Password and password repeat do not match")
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
        return user

    async def get_current_user(self, token: str) -> User:
        """Validate token and return the current user."""
        self.logger.debug("Validating user token")
        credentials_exception = HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
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
        self.logger.debug(f"Token validated for user: {tg_username}")
        return user

    async def refresh_tokens(self, refresh_token: str) -> dict:
        """Refresh access_token using refresh_token. Optionally rotate refresh_token."""
        user = await User.find_one(User.refresh_token == refresh_token)
        if not user:
            self.logger.warning(f"Refresh token not found: {refresh_token}")
            raise HTTPException(status_code=401, detail="Invalid refresh token")
        token_data = {"tg_username": user.tg_username}
        access_token = self.create_access_token(token_data)
        # new_refresh_token = str(uuid.uuid4())
        # user.refresh_token = new_refresh_token
        user.access_token = access_token
        await user.save()
        return {"access_token": access_token, "refresh_token": user.refresh_token} 