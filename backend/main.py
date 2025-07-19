import logging
from fastapi import FastAPI, HTTPException, Depends
from fastapi import Body
import uvicorn
from contextlib import asynccontextmanager
from database import init_database, close_database
from models.user import User, get_by_tg_username, get_by_phone
from requests_shemas import LoginRequest, RegisterRequest, RefreshRequest
from auth_service import AuthService, oauth2_scheme
import os
from dotenv import load_dotenv

load_dotenv()
LOG_FILE = os.getenv("LOG_FILE")
if LOG_FILE:
    logging.basicConfig(level=logging.INFO, filename=LOG_FILE, filemode="a",
                        format="%(asctime)s\n%(levelname)s | %(message)s\n",)
else:
    logging.basicConfig(level=logging.INFO,
                        format="%(asctime)s\n%(levelname)s | %(message)s\n")
logger = logging.getLogger("main")


def get_auth_service() -> AuthService:
    """Dependency to provide an instance of AuthService."""
    return AuthService()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager to initialize and close the database connection."""
    await init_database()
    yield
    await close_database()


app = FastAPI(title="Enter Code Site", lifespan=lifespan)


@app.get("/", summary="Main page", tags=["General"])
def root():
    return {"message": "Welcome to Enter Code Site!"}


@app.get("/users", summary="List all users", tags=["Users"])
async def get_users():
    """Get a list of all users."""
    users = await User.find_all().to_list()
    return [user.model_dump() for user in users]


@app.post("/register", summary="Register a new user", tags=["Authentication"])
async def register_user(
    register_data: RegisterRequest = Body(...),
    auth_service: AuthService = Depends(get_auth_service),
):
    """Register a new user and return tokens."""
    user = await auth_service.register_user(register_data)
    logger.info(f"User {user.tg_username} registered successfully")
    return {
        "status": "ok",
        "access_token": user.access_token,
        "refresh_token": user.refresh_token,
    }


@app.post("/login", summary="User login", tags=["Authentication"])
async def login_user(
    login_data: LoginRequest = Body(...),
    auth_service: AuthService = Depends(get_auth_service),
):
    """Authenticate user by username and password, return access and refresh tokens."""
    user = await get_by_tg_username(login_data.tg_username)
    if not user:
        logger.warning("User not found")
        raise HTTPException(status_code=404, detail="User not found")
    if not auth_service.verify_password(login_data.password, user.password_hash):
        logger.warning("Invalid password")
        raise HTTPException(status_code=401, detail="Invalid password")
    token_data = {"tg_username": user.tg_username}
    access_token = auth_service.create_access_token(token_data)
    user.access_token = access_token
    await user.save()
    logger.info(f"User {user.tg_username} logged in successfully")
    return {
        "status": "ok",
        "access_token": access_token,
        "refresh_token": user.refresh_token,
    }


@app.post("/me", summary="User info", tags=["Authentication"])
async def user_info(
    access_token: str, auth_service: AuthService = Depends(get_auth_service)
):
    """Get user info by access_token."""
    user = await auth_service.get_current_user(access_token)
    if not user:
        logger.warning("User not found")
        raise HTTPException(status_code=404, detail="User not found")
    return {"status": "ok", "username": user.tg_username, "full_name": user.full_name}


@app.post(
    "/refresh",
    summary="Refresh access_token using refresh_token",
    tags=["Authentication"],
)
async def refresh_token(
    refresh_data: RefreshRequest = Body(...),
    auth_service: AuthService = Depends(get_auth_service),
):
    tokens = await auth_service.refresh_tokens(refresh_data.refresh_token)
    logger.info("Tokens refreshed for refresh_token: %s",
                refresh_data.refresh_token)
    return {"status": "ok", **tokens}


if __name__ == "__main__":
    uvicorn.run("main:app")
