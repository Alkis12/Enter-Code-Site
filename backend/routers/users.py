from fastapi import APIRouter, Query, Body, HTTPException
from typing import List
from models.user import User, UserType
from schemas.responses import UserResponse, ErrorResponse
from services.auth_service import get_current_user_with_role
import re

router = APIRouter(prefix="/users", tags=["Пользователи"])

def create_user_response(user: User) -> UserResponse:
    """Создать UserResponse с корректной информацией об абонементе."""
    user_data = {
        "id": str(user.id),
        "name": user.name,
        "surname": user.surname,
        "tg_username": user.tg_username,
        "user_type": user.user_type,
        "status": user.status,
        "phone": user.phone,
        "avatar_url": user.avatar_url,
        "bio": user.bio,
    }
    
    # Добавляем информацию об абонементе только для студентов
    if user.user_type == UserType.STUDENT:
        user_data.update({
            "subscription_status": user.subscription_status,
            "lessons_remaining": user.lessons_remaining,
        })
    
    return UserResponse(**user_data)

@router.post("/list", response_model=List[UserResponse], summary="Список всех пользователей")
async def get_users(
    access_token: str = Body(..., description="Токен доступа администратора")
):
    await get_current_user_with_role(access_token, UserType.ADMIN)
    users = await User.find_all().to_list()
    return [create_user_response(user) for user in users]

@router.post("/profile", response_model=UserResponse, summary="Профиль пользователя")
async def user_profile(
    access_token: str = Body(..., description="Токен доступа пользователя"),
    tg_username: str = Body(None, description="Telegram username пользователя (опционально)")
):
    user = await get_current_user_with_role(access_token, UserType.STUDENT)
    
    if tg_username is None:
        return create_user_response(user)
    
    if user.tg_username == tg_username:
        return create_user_response(user)
    
    if user.user_type in [UserType.TEACHER, UserType.ADMIN]:
        other = await User.find_one(User.tg_username == tg_username)
        if not other:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        return create_user_response(other)
    
    raise HTTPException(status_code=403, detail="Недостаточно прав для просмотра чужого профиля")

@router.post("/search", response_model=List[UserResponse], summary="Поиск пользователей")
async def users_search(
    q: str = Query("", description="Поисковый запрос по имени пользователя"),
    access_token: str = Body(..., description="Токен доступа учителя или администратора")
):
    await get_current_user_with_role(access_token, UserType.TEACHER)
    
    if not q:
        users = await User.find_all().to_list()
    else:
        # Используем регулярное выражение для поиска по имени (case-insensitive)
        pattern = re.compile(re.escape(q), re.IGNORECASE)
        users = await User.find({"$or": [
            {"name": {"$regex": pattern}},
            {"surname": {"$regex": pattern}},
            {"tg_username": {"$regex": pattern}}
        ]}).to_list()
    return [create_user_response(user) for user in users]

