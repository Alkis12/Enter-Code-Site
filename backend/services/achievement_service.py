from typing import Dict, List, Optional

from models.achievement import Achievement, AchievementTrigger
from models.user import User


DEFAULT_ACHIEVEMENTS = [
    {
        "key": "first_login",
        "title": "Первый вход",
        "description": "Войти в аккаунт первый раз.",
        "trigger": AchievementTrigger.FIRST_LOGIN,
        "is_hidden": False,
        "avatar_url": None,
        "course_id": None,
    },
    {
        "key": "first_submission",
        "title": "Первое решение",
        "description": "Отправить первое решение на проверку.",
        "trigger": AchievementTrigger.FIRST_SUBMISSION,
        "is_hidden": False,
        "avatar_url": None,
        "course_id": None,
    },
    {
        "key": "first_solved_task",
        "title": "Первая победа",
        "description": "Сдать первую задачу.",
        "trigger": AchievementTrigger.FIRST_SOLVED_TASK,
        "is_hidden": True,
        "avatar_url": None,
        "course_id": None,
    },
]


async def ensure_default_achievements() -> None:
    for payload in DEFAULT_ACHIEVEMENTS:
        existing = await Achievement.find_one(Achievement.key == payload["key"])
        if existing:
            continue
        achievement = Achievement(**payload)
        await achievement.insert()


async def get_all_achievements() -> List[Achievement]:
    return await Achievement.find_all().to_list()


def get_user_unlock_map(user: User) -> Dict[str, object]:
    return {item.achievement_id: item for item in user.unlocked_achievements}


async def unlock_achievements_for_trigger(
    user: User,
    trigger: AchievementTrigger,
    course_id: Optional[str] = None,
) -> List[Achievement]:
    unlocked: List[Achievement] = []
    achievements = await Achievement.find(Achievement.trigger == trigger).to_list()
    for achievement in achievements:
        if achievement.course_id and course_id and achievement.course_id != course_id:
            continue
        if user.unlock_achievement(str(achievement.id)):
            unlocked.append(achievement)
    return unlocked
