from models.user import User
from fastapi import HTTPException
import logging

logger = logging.getLogger("user_service")

async def get_by_tg_username(tg_username: str):
    try:
        return await User.find(User.tg_username == tg_username).first_or_none()
    except Exception as e:
        logger.error(f"Error getting user by tg_username {tg_username}: {e}")
        raise HTTPException(status_code=500, detail="Ошибка при поиске пользователя")

async def get_by_email(email: str):
    try:
        return await User.find(User.email == email).first_or_none()
    except Exception as e:
        logger.error(f"Error getting user by email {email}: {e}")
        raise HTTPException(status_code=500, detail="Ошибка при поиске пользователя")

async def get_by_id(user_id: str):
    try:
        user = await User.get(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        return user
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting user by id {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Ошибка при получении пользователя")

async def get_by_role(role: str):
    try:
        return await User.find(User.role == role).to_list()
    except Exception as e:
        logger.error(f"Error getting users by role {role}: {e}")
        raise HTTPException(status_code=500, detail="Ошибка при поиске пользователей")

async def get_user_id_by_tg_username(tg_username: str) -> str:
    """Получить user_id по tg_username"""
    try:
        user = await get_by_tg_username(tg_username)
        return str(user.id) if user else None
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting user_id by tg_username {tg_username}: {e}")
        raise HTTPException(status_code=500, detail="Ошибка при получении ID пользователя")

async def get_tg_username_by_user_id(user_id: str) -> str:
    """Получить tg_username по user_id"""
    try:
        user = await User.get(user_id)  # Используем напрямую, чтобы не вызывать дублирующую ошибку
        return user.tg_username if user else None
    except Exception as e:
        logger.error(f"Error getting tg_username by user_id {user_id}: {e}")
        return None  # Возвращаем None вместо исключения для совместимости

async def get_user_ids_by_tg_usernames(tg_usernames: list) -> list:
    """Получить список user_id по списку tg_username"""
    try:
        user_ids = []
        for tg_username in tg_usernames:
            user_id = await get_user_id_by_tg_username(tg_username)
            if user_id:
                user_ids.append(user_id)
        return user_ids
    except Exception as e:
        logger.error(f"Error getting user_ids by tg_usernames: {e}")
        raise HTTPException(status_code=500, detail="Ошибка при получении ID пользователей")

async def get_tg_usernames_by_user_ids(user_ids: list) -> list:
    """Получить список tg_username по списку user_id"""
    try:
        tg_usernames = []
        for user_id in user_ids:
            tg_username = await get_tg_username_by_user_id(user_id)
            if tg_username:
                tg_usernames.append(tg_username)
        return tg_usernames
    except Exception as e:
        logger.error(f"Error getting tg_usernames by user_ids: {e}")
        raise HTTPException(status_code=500, detail="Ошибка при получении имен пользователей")

async def update_user(user_id: str, **kwargs):
    try:
        user = await User.get(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        
        for key, value in kwargs.items():
            setattr(user, key, value)
        await user.save()
        return user
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating user {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Ошибка при обновлении пользователя")

async def delete_user(user_id: str):
    try:
        user = await User.get(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        
        await user.delete()
        return True
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting user {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Ошибка при удалении пользователя")

async def exists(tg_username: str):
    user = await get_by_tg_username(tg_username)
    return user is not None
