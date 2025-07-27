from fastapi import APIRouter, Body, Depends, HTTPException
from schemas.requests import LoginRequest, RegisterRequest, RefreshRequest, ChangePasswordRequest, UpdateUserRequest
from schemas.responses import UserResponse, TokenResponse, MessageResponse
from services.auth_service import get_auth_service, get_current_user_dependency, get_current_user_bearer_dependency
from models.user import User, UserType
from pydantic import BaseModel
from typing import Optional
import logging

router = APIRouter(prefix="/auth", tags=["Аутентификация"])
logger = logging.getLogger("auth")

@router.post("/register", response_model=MessageResponse, summary="Регистрация нового пользователя")
async def register_user(
    register_data: RegisterRequest = Body(..., description="Данные для регистрации нового пользователя"),
    auth_service = Depends(get_auth_service),
):
    logger.info(f"User registration: {register_data.tg_username}")
    try:
        user = await auth_service.register(register_data)
        return MessageResponse(
            message=f"Пользователь {user.tg_username} успешно зарегистрирован",
            success=True
        )
    except Exception as e:
        logger.error(f"User registration error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/login", response_model=TokenResponse, summary="Авторизация пользователя")
async def login(
    login_data: LoginRequest = Body(...),
    auth_service = Depends(get_auth_service),
):
    access_token, refresh_token = await auth_service.login(login_data)
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token
    )

@router.post("/me", summary="Информация о пользователе (по access_token)")
async def user_info(
    access_token: str = Body(...),
    auth_service = Depends(get_auth_service)
):
    logger.info(f"Getting user information")
    try:
        user = await auth_service.get_user_info(access_token)
        return {"tg_username": user.tg_username, "id": str(user.id)}
    except Exception as e:
        logger.error(f"Error getting user information: {e}")
        raise HTTPException(status_code=401, detail=str(e))

@router.post("/refresh", response_model=dict, summary="Обновить access_token по refresh_token")
async def refresh_token(
    refresh_data: RefreshRequest = Body(..., description="Refresh токен для обновления access токена"),
    auth_service = Depends(get_auth_service),
):
    logger.info(f"Refreshing access token")
    try:
        new_access_token = await auth_service.refresh_access_token(refresh_data)
        return {
            "access_token": new_access_token
        }
    except Exception as e:
        logger.error(f"Error refreshing access token: {e}")
        raise HTTPException(status_code=401, detail=str(e))

@router.post("/change_password", response_model=MessageResponse, summary="Смена пароля пользователя")
async def change_password(
    data: ChangePasswordRequest = Body(..., description="Данные для смены пароля (старый и новый)"),
    access_token: str = Body(..., description="Токен доступа текущего пользователя"),
    auth_service = Depends(get_auth_service),
):
    logger.info("User password change")
    try:
        user = await auth_service.get_current_user(access_token)
        if not auth_service.verify_password(data.old_password, user.password_hash):
            raise HTTPException(status_code=400, detail="Старый пароль неверен")
        user.password_hash = auth_service.get_password_hash(data.new_password)
        await user.save()
        return MessageResponse(message="Пароль успешно изменён", success=True)
    except Exception as e:
        logger.error(f"Password change error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/update_user", response_model=MessageResponse, summary="Обновление данных пользователя")
async def update_user(
    data: UpdateUserRequest = Body(..., description="Данные для обновления профиля пользователя"),
    access_token: str = Body(..., description="Токен доступа текущего пользователя"),
    auth_service = Depends(get_auth_service),
):
    logger.info("User data update")
    try:
        user = await auth_service.get_current_user(access_token)
        if data.full_name is not None:
            user.full_name = data.full_name
        if data.phone is not None:
            user.phone = data.phone
        if data.avatar_url is not None:
            user.avatar_url = data.avatar_url
        if data.bio is not None:
            user.bio = data.bio
        await user.save()
        return MessageResponse(message="Данные пользователя успешно обновлены", success=True)
    except Exception as e:
        logger.error(f"User data update error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/logout", response_model=MessageResponse, summary="Выход пользователя (инвалидация токенов)")
async def logout(
    access_token: str = Body(..., description="Токен доступа для инвалидации"),
    refresh_token: str = Body(..., description="Refresh токен для инвалидации"),
    auth_service = Depends(get_auth_service),
):
    logger.info("User logout")
    try:
        await auth_service.logout(access_token, refresh_token)
        return MessageResponse(message="Вы успешно вышли из системы", success=True)
    except Exception as e:
        logger.error(f"User logout error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/delete_account", response_model=MessageResponse, summary="Удаление аккаунта пользователя")
async def delete_account(
    access_token: str = Body(..., description="Токен доступа пользователя для удаления аккаунта"),
    auth_service = Depends(get_auth_service),
):
    logger.info("User account deletion")
    try:
        await auth_service.delete_account(access_token)
        return MessageResponse(message="Аккаунт успешно удалён", success=True)
    except Exception as e:
        logger.error(f"Account deletion error: {e}")
        raise HTTPException(status_code=400, detail=str(e))