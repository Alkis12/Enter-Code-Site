import logging
from typing import List, Optional

from fastapi import HTTPException

from models.user import User, UserType


logger = logging.getLogger("user_service")


async def get_by_tg_username(tg_username: str) -> Optional[User]:
    try:
        return await User.find_one(User.tg_username == tg_username)
    except Exception as exc:
        logger.error("Error getting user by tg_username %s: %s", tg_username, exc)
        raise HTTPException(status_code=500, detail="Ошибка при поиске пользователя")


async def get_by_id(user_id: str) -> User:
    try:
        user = await User.get(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        return user
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Error getting user by id %s: %s", user_id, exc)
        raise HTTPException(status_code=500, detail="Ошибка при получении пользователя")


async def get_users_by_role(role: UserType) -> List[User]:
    try:
        return await User.find(User.user_type == role).to_list()
    except Exception as exc:
        logger.error("Error getting users by role %s: %s", role, exc)
        raise HTTPException(status_code=500, detail="Ошибка при поиске пользователей")


async def get_user_id_by_tg_username(tg_username: str) -> Optional[str]:
    user = await get_by_tg_username(tg_username)
    return str(user.id) if user else None


async def get_tg_username_by_user_id(user_id: str) -> Optional[str]:
    try:
        user = await User.get(user_id)
        return user.tg_username if user else None
    except Exception as exc:
        logger.error("Error getting tg_username by user_id %s: %s", user_id, exc)
        return None


async def get_user_ids_by_tg_usernames(tg_usernames: List[str]) -> List[str]:
    user_ids: List[str] = []
    for tg_username in tg_usernames:
        user_id = await get_user_id_by_tg_username(tg_username)
        if user_id:
            user_ids.append(user_id)
    return user_ids


async def get_tg_usernames_by_user_ids(user_ids: List[str]) -> List[str]:
    usernames: List[str] = []
    for user_id in user_ids:
        username = await get_tg_username_by_user_id(user_id)
        if username:
            usernames.append(username)
    return usernames


async def update_user(user_id: str, **kwargs) -> User:
    user = await get_by_id(user_id)
    for key, value in kwargs.items():
        setattr(user, key, value)
    user.touch()
    await user.save()
    return user


async def delete_user(user_id: str) -> bool:
    user = await get_by_id(user_id)
    await user.delete()
    return True


async def exists(tg_username: str) -> bool:
    return await get_by_tg_username(tg_username) is not None


async def get_linked_students_for_parent(parent: User) -> List[User]:
    if parent.user_type != UserType.PARENT or not parent.linked_student_ids:
        return []

    students: List[User] = []
    for student_id in parent.linked_student_ids:
        student = await User.get(student_id)
        if student and student.user_type == UserType.STUDENT:
            students.append(student)

    students.sort(key=lambda item: (item.surname.lower(), item.name.lower(), item.tg_username.lower()))
    return students


async def get_parents_for_student(student_id: str) -> List[User]:
    parents = await User.find(
        User.user_type == UserType.PARENT,
        User.linked_student_ids == student_id,
    ).to_list()
    parents.sort(key=lambda item: (item.surname.lower(), item.name.lower(), item.tg_username.lower()))
    return parents
