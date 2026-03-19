import os
from pathlib import Path
from typing import List
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from models.achievement import Achievement
from models.course import Course
from models.user import User, UserType
from schemas.requests import UpdateAchievementRequest
from schemas.responses import (
    AchievementOverviewResponse,
    AchievementRecipientResponse,
    AchievementResponse,
    MessageResponse,
)
from services.auth_service import get_current_user_dependency, require_role
from services.learning_service import get_course_students
from services.serializer_service import serialize_achievement


router = APIRouter(prefix="/achievement", tags=["Достижения"])
uploads_dir = Path(os.getenv("UPLOADS_DIR", "uploads"))
achievement_uploads_dir = uploads_dir / "achievements"
achievement_uploads_dir.mkdir(parents=True, exist_ok=True)


async def can_manage_achievement(user: User, achievement: Achievement) -> bool:
    if user.user_type == UserType.ADMIN:
        return True
    if user.user_type != UserType.TEACHER:
        return False
    if not achievement.course_id:
        return True
    course = await Course.get(achievement.course_id)
    return bool(course and str(user.id) in course.teacher_ids)


def get_achievement_condition_text(achievement: Achievement) -> str:
    if achievement.trigger == achievement.trigger.FIRST_LOGIN:
        return "Войти в аккаунт впервые."
    if achievement.trigger == achievement.trigger.FIRST_SUBMISSION:
        return "Отправить первое решение на проверку."
    if achievement.trigger == achievement.trigger.FIRST_SOLVED_TASK:
        return "Сдать первую задачу."
    return achievement.trigger.value


@router.get("/my", response_model=List[AchievementResponse])
async def my_achievements(user: User = Depends(get_current_user_dependency)):
    achievements = await Achievement.find_all().to_list()
    return [serialize_achievement(item, user) for item in achievements]


@router.get("/editable", response_model=List[AchievementResponse])
async def editable_achievements(user: User = Depends(require_role(UserType.TEACHER))):
    achievements = await Achievement.find_all().to_list()
    result: List[AchievementResponse] = []
    for item in achievements:
        if await can_manage_achievement(user, item):
            result.append(serialize_achievement(item, user, editable=True))
    return result


@router.get("/overview", response_model=List[AchievementOverviewResponse])
async def achievements_overview(user: User = Depends(require_role(UserType.ADMIN))):
    achievements = await Achievement.find_all().sort("title").to_list()
    students = await User.find(User.user_type == UserType.STUDENT).to_list()
    courses = await Course.find_all().to_list()
    course_map = {str(course.id): course for course in courses}
    course_students_map = {
        str(course.id): set(await get_course_students(course))
        for course in courses
    }

    result: List[AchievementOverviewResponse] = []
    for achievement in achievements:
        relevant_students = students
        if achievement.course_id:
            course_student_ids = course_students_map.get(achievement.course_id, set())
            relevant_students = [
                student
                for student in students
                if str(student.id) in course_student_ids
            ]

        recipients: List[AchievementRecipientResponse] = []
        for student in relevant_students:
            unlocked = next(
                (
                    item
                    for item in student.unlocked_achievements
                    if item.achievement_id == str(achievement.id)
                ),
                None,
            )
            if unlocked:
                recipients.append(
                    AchievementRecipientResponse(
                        user_id=str(student.id),
                        name=student.name,
                        surname=student.surname,
                        tg_username=student.tg_username,
                        unlocked_at=unlocked.unlocked_at,
                    )
                )

        recipients.sort(key=lambda item: item.unlocked_at)
        total_students = len(relevant_students)
        recipient_count = len(recipients)
        recipient_percent = round(recipient_count / total_students * 100, 1) if total_students else 0.0
        course = course_map.get(achievement.course_id) if achievement.course_id else None
        result.append(
            AchievementOverviewResponse(
                id=str(achievement.id),
                key=achievement.key,
                title=achievement.title,
                description=achievement.description,
                avatar_url=achievement.avatar_url,
                trigger=achievement.trigger,
                achievement_type="course" if achievement.course_id else "common",
                condition_text=get_achievement_condition_text(achievement),
                course_id=achievement.course_id,
                course_name=course.name if course else None,
                recipient_percent=recipient_percent,
                recipient_count=recipient_count,
                total_students=total_students,
                recipients=recipients,
            )
        )

    return result


@router.put("/{achievement_id}", response_model=MessageResponse)
async def update_achievement(
    achievement_id: str,
    payload: UpdateAchievementRequest,
    user: User = Depends(require_role(UserType.TEACHER)),
):
    achievement = await Achievement.get(achievement_id)
    if not achievement:
        raise HTTPException(status_code=404, detail="Достижение не найдено")
    if not await can_manage_achievement(user, achievement):
        raise HTTPException(status_code=403, detail="Нет прав на изменение достижения")

    for field in ["title", "description", "avatar_url", "is_hidden"]:
        value = getattr(payload, field)
        if value is not None:
            setattr(achievement, field, value)
    achievement.touch()
    await achievement.save()
    return MessageResponse(message="Достижение обновлено", success=True)


@router.post("/{achievement_id}/upload-avatar")
async def upload_achievement_avatar(
    achievement_id: str,
    file: UploadFile = File(...),
    user: User = Depends(require_role(UserType.TEACHER)),
):
    achievement = await Achievement.get(achievement_id)
    if not achievement:
        raise HTTPException(status_code=404, detail="Достижение не найдено")
    if not await can_manage_achievement(user, achievement):
        raise HTTPException(status_code=403, detail="Нет прав на изменение достижения")

    ext = Path(file.filename or "").suffix.lower()
    if ext not in {".jpg", ".jpeg", ".png", ".webp", ".gif"}:
        raise HTTPException(status_code=400, detail="Поддерживаются только изображения jpg, png, webp и gif")

    filename = f"{uuid4().hex}{ext}"
    target_path = achievement_uploads_dir / filename
    content = await file.read()
    target_path.write_bytes(content)
    await file.close()

    achievement.avatar_url = f"/uploads/achievements/{filename}"
    achievement.touch()
    await achievement.save()

    return {"url": achievement.avatar_url, "filename": filename}
