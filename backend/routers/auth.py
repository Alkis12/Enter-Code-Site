from fastapi import APIRouter, Body, Depends, HTTPException

from models.user import UserType
from schemas.requests import ChangePasswordRequest, LoginRequest, RefreshRequest, RegisterRequest, UpdateUserRequest
from schemas.responses import MessageResponse, RegisterResponse, TokenResponse, UserResponse
from services.auth_service import get_auth_service
from services.serializer_service import serialize_achievement_notice, serialize_user
from services.user_service import get_by_tg_username


router = APIRouter(prefix="/auth", tags=["Аутентификация"])


@router.post("/register", response_model=RegisterResponse)
async def register_user(
    register_data: RegisterRequest = Body(...),
):
    raise HTTPException(
        status_code=403,
        detail="Самостоятельная регистрация отключена. Обратитесь к преподавателю.",
    )


@router.post("/login", response_model=TokenResponse)
async def login(
    login_data: LoginRequest = Body(...),
    auth_service=Depends(get_auth_service),
):
    access_token, refresh_token, unlocked = await auth_service.login(login_data)
    user = await auth_service.get_current_user(access_token)
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user_id=str(user.id),
        user_type=user.user_type,
        newly_unlocked_achievements=[
            serialize_achievement_notice(item) for item in unlocked
        ],
    )


@router.post("/me", response_model=UserResponse)
async def user_info(
    access_token: str = Body(...),
    auth_service=Depends(get_auth_service),
):
    user = await auth_service.get_user_info(access_token)
    return serialize_user(user)


@router.post("/refresh", response_model=dict)
async def refresh_token(
    refresh_data: RefreshRequest = Body(...),
    auth_service=Depends(get_auth_service),
):
    access_token = await auth_service.refresh_access_token(refresh_data)
    return {"access_token": access_token}


@router.post("/change_password", response_model=MessageResponse)
async def change_password(
    data: ChangePasswordRequest = Body(...),
    access_token: str = Body(...),
    auth_service=Depends(get_auth_service),
):
    user = await auth_service.get_current_user(access_token)
    if not auth_service.verify_password(data.old_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Текущий пароль неверный")
    user.password_hash = auth_service.get_password_hash(data.new_password)
    user.touch()
    await user.save()
    return MessageResponse(message="Пароль успешно изменен", success=True)


@router.post("/update_user", response_model=MessageResponse)
async def update_user(
    data: UpdateUserRequest = Body(...),
    access_token: str = Body(...),
    auth_service=Depends(get_auth_service),
):
    user = await auth_service.get_current_user(access_token)

    if data.tg_username and data.tg_username != user.tg_username:
        existing = await get_by_tg_username(data.tg_username)
        if existing and str(existing.id) != str(user.id):
            raise HTTPException(status_code=400, detail="Логин уже занят")
        user.tg_username = data.tg_username

    for field in ["name", "surname", "telegram_id", "phone", "avatar_url", "bio"]:
        value = getattr(data, field)
        if value is not None:
            setattr(user, field, value)

    user.touch()
    await user.save()
    return MessageResponse(message="Данные пользователя обновлены", success=True)


@router.post("/logout", response_model=MessageResponse)
async def logout(
    access_token: str = Body(...),
    refresh_token: str = Body(...),
    auth_service=Depends(get_auth_service),
):
    await auth_service.logout(access_token, refresh_token)
    return MessageResponse(message="Вы успешно вышли из системы", success=True)


@router.delete("/delete_account", response_model=MessageResponse)
async def delete_account(
    access_token: str = Body(...),
    auth_service=Depends(get_auth_service),
):
    await auth_service.delete_account(access_token)
    return MessageResponse(message="Аккаунт удален", success=True)
