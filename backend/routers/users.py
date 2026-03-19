import os
import re
from pathlib import Path
from typing import Dict, List, Set
from uuid import uuid4

from fastapi import APIRouter, Body, Depends, File, HTTPException, Query, UploadFile

from models.achievement import Achievement
from models.course import Course
from models.course_request import CourseRequest
from models.user import User, UserStatus, UserType
from schemas.requests import (
    AdminCreateStudentRequest,
    AdminUpdateStudentRequest,
    ChangePasswordRequest,
    LinkParentRequest,
    UpdateUserRequest,
)
from schemas.responses import AdminStudentsResponse, DashboardResponse, MessageResponse, StudentAdminResponse, UserResponse
from services.auth_service import AuthService, get_current_user_dependency, get_current_user_with_role, require_role
from services.learning_service import (
    can_edit_course,
    get_course_students,
    get_courses_for_user,
    get_student_group_assignments,
    sync_student_course_memberships,
)
from services.serializer_service import (
    build_dashboard_pending_reviews,
    serialize_achievement,
    serialize_course,
    serialize_course_option,
    serialize_course_request,
    serialize_student_admin,
    serialize_user,
)
from services.user_service import get_by_id, get_by_tg_username, get_linked_students_for_parent


router = APIRouter(prefix="/users", tags=["Пользователи"])
uploads_dir = Path(os.getenv("UPLOADS_DIR", "uploads"))
profile_uploads_dir = uploads_dir / "profiles"
profile_uploads_dir.mkdir(parents=True, exist_ok=True)


async def get_student_courses(student: User, allowed_course_ids: Set[str] | None = None) -> List[Course]:
    direct_courses = await Course.find({"student_ids": str(student.id)}).to_list()
    assignment_map = await get_student_group_assignments(str(student.id))
    merged = {str(course.id): course for course in direct_courses}
    for course_id in assignment_map:
        course = await Course.get(course_id)
        if course:
            merged[str(course.id)] = course

    result = list(merged.values())
    if allowed_course_ids is not None:
        result = [course for course in result if str(course.id) in allowed_course_ids]
    result.sort(key=lambda item: item.name.lower())
    return result


async def serialize_student_entry(
    student: User,
    allowed_course_ids: Set[str] | None = None,
) -> StudentAdminResponse:
    courses = await get_student_courses(student, allowed_course_ids)
    return await serialize_student_admin(student, courses)


async def get_manageable_courses(user: User) -> List[Course]:
    if user.user_type == UserType.ADMIN:
        return await Course.find_all().to_list()

    manageable_courses: List[Course] = []
    for course in await get_courses_for_user(user):
        if await can_edit_course(user, course):
            manageable_courses.append(course)
    return manageable_courses


async def get_manageable_students(user: User, manageable_courses: List[Course]) -> List[User]:
    if user.user_type == UserType.ADMIN:
        students = await User.find(User.user_type == UserType.STUDENT).to_list()
        students.sort(key=lambda item: (item.surname.lower(), item.name.lower(), item.tg_username.lower()))
        return students

    student_ids: Set[str] = set()
    for course in manageable_courses:
        student_ids.update(await get_course_students(course))

    students: List[User] = []
    for student_id in student_ids:
        student = await User.get(student_id)
        if student and student.user_type == UserType.STUDENT:
            students.append(student)

    students.sort(key=lambda item: (item.surname.lower(), item.name.lower(), item.tg_username.lower()))
    return students


def ensure_accessible_course_ids(
    user: User,
    course_ids: List[str],
    manageable_courses: List[Course],
) -> Dict[str, Course]:
    manageable_map = {str(course.id): course for course in manageable_courses}
    invalid_ids = [course_id for course_id in course_ids if course_id not in manageable_map]
    if invalid_ids:
        raise HTTPException(status_code=403, detail="Можно назначать ученика только на доступные вам курсы")
    return manageable_map


async def ensure_can_manage_student(user: User, student: User, manageable_courses: List[Course]) -> None:
    if user.user_type == UserType.ADMIN:
        return

    manageable_student_ids: Set[str] = set()
    for course in manageable_courses:
        manageable_student_ids.update(await get_course_students(course))

    if str(student.id) not in manageable_student_ids:
        raise HTTPException(status_code=403, detail="Недостаточно прав для управления этим учеником")


def can_manage_achievement(user: User, achievement: Achievement, course_map: dict[str, Course]) -> bool:
    if user.user_type == UserType.ADMIN:
        return True
    if user.user_type != UserType.TEACHER:
        return False
    if not achievement.course_id:
        return True
    course = course_map.get(achievement.course_id)
    return course is not None and str(user.id) in course.teacher_ids


@router.get("/dashboard", response_model=DashboardResponse)
async def dashboard(user: User = Depends(get_current_user_dependency)):
    courses = await get_courses_for_user(user)
    serialized_courses = [await serialize_course(course, user) for course in courses]
    manageable_courses = await get_manageable_courses(user)
    manageable_course_ids = {str(course.id) for course in manageable_courses}

    achievements = await Achievement.find_all().to_list()
    course_map = {str(course.id): course for course in courses}
    if user.user_type == UserType.PARENT:
        serialized_achievements = []
        editable_achievements = []
    else:
        serialized_achievements = [serialize_achievement(item, user) for item in achievements]
        editable_achievements = [
            serialize_achievement(item, user, editable=True)
            for item in achievements
            if can_manage_achievement(user, item, course_map)
        ]

    managed_students: List[StudentAdminResponse] = []
    linked_students: List[StudentAdminResponse] = []
    available_courses = [await serialize_course_option(course) for course in manageable_courses]
    pending_reviews = await build_dashboard_pending_reviews(user, courses)
    course_requests = []
    if user.user_type in {UserType.TEACHER, UserType.ADMIN}:
        students = await get_manageable_students(user, manageable_courses)
        managed_students = [
            await serialize_student_entry(student, manageable_course_ids)
            for student in students
        ]
        request_query = {}
        if user.user_type == UserType.TEACHER:
            request_query = {"course_id": {"$in": list(manageable_course_ids)}}
        requests = await CourseRequest.find(request_query).sort("-created_at").to_list()
        course_requests = [serialize_course_request(item) for item in requests]
    elif user.user_type == UserType.PARENT:
        linked_students = [
            await serialize_student_entry(student)
            for student in await get_linked_students_for_parent(user)
        ]

    return DashboardResponse(
        user=serialize_user(user),
        courses=serialized_courses,
        achievements=serialized_achievements,
        managed_students=managed_students,
        linked_students=linked_students,
        editable_achievements=editable_achievements,
        available_courses=available_courses,
        pending_reviews=pending_reviews,
        course_requests=course_requests,
    )


@router.get("/profile", response_model=UserResponse)
async def current_profile(user: User = Depends(get_current_user_dependency)):
    return serialize_user(user)


@router.post("/profile", response_model=UserResponse)
async def legacy_profile(
    access_token: str = Body(...),
    tg_username: str = Body(default=None),
):
    auth_service = AuthService()
    user = await auth_service.get_current_user(access_token)
    if not tg_username or tg_username == user.tg_username:
        return serialize_user(user)
    if user.user_type not in [UserType.TEACHER, UserType.ADMIN]:
        raise HTTPException(status_code=403, detail="Недостаточно прав")
    target = await get_by_tg_username(tg_username)
    if not target:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    return serialize_user(target)


@router.put("/profile", response_model=UserResponse)
async def update_profile(
    payload: UpdateUserRequest,
    user: User = Depends(get_current_user_dependency),
):
    if payload.tg_username and payload.tg_username != user.tg_username:
        existing = await get_by_tg_username(payload.tg_username)
        if existing and str(existing.id) != str(user.id):
            raise HTTPException(status_code=400, detail="Логин уже занят")
        user.tg_username = payload.tg_username

    for field in ["name", "surname", "telegram_id", "phone", "avatar_url", "bio"]:
        value = getattr(payload, field)
        if value is not None:
            setattr(user, field, value)

    user.touch()
    await user.save()
    return serialize_user(user)


@router.post("/profile/upload-avatar")
async def upload_profile_avatar(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user_dependency),
):
    ext = Path(file.filename or "").suffix.lower()
    if ext not in {".jpg", ".jpeg", ".png", ".webp", ".gif"}:
        raise HTTPException(
            status_code=400,
            detail="Поддерживаются только изображения jpg, png, webp и gif",
        )

    filename = f"{uuid4().hex}{ext}"
    target_path = profile_uploads_dir / filename
    content = await file.read()
    target_path.write_bytes(content)
    await file.close()

    user.avatar_url = f"/uploads/profiles/{filename}"
    user.touch()
    await user.save()

    return {"url": user.avatar_url, "filename": filename}


@router.post("/change-password", response_model=MessageResponse)
async def change_own_password(
    payload: ChangePasswordRequest,
    user: User = Depends(get_current_user_dependency),
):
    auth_service = AuthService()
    if not auth_service.verify_password(payload.old_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Текущий пароль неверный")
    user.password_hash = auth_service.get_password_hash(payload.new_password)
    user.touch()
    await user.save()
    return MessageResponse(message="Пароль обновлен", success=True)


@router.post("/list", response_model=List[UserResponse])
async def get_users(access_token: str = Body(...)):
    await get_current_user_with_role(access_token, UserType.ADMIN)
    users = await User.find_all().to_list()
    return [serialize_user(user) for user in users]


@router.get("/students", response_model=AdminStudentsResponse)
async def list_students(user: User = Depends(require_role(UserType.TEACHER))):
    courses = await get_manageable_courses(user)
    allowed_course_ids = {str(course.id) for course in courses}
    students = await get_manageable_students(user, courses)
    return AdminStudentsResponse(
        students=[
            await serialize_student_entry(student, allowed_course_ids)
            for student in students
        ],
        available_courses=[await serialize_course_option(course) for course in courses],
    )


@router.post("/students", response_model=StudentAdminResponse)
async def create_student(
    payload: AdminCreateStudentRequest,
    user: User = Depends(require_role(UserType.TEACHER)),
):
    if await get_by_tg_username(payload.tg_username):
        raise HTTPException(status_code=400, detail="Логин уже занят")

    manageable_courses = await get_manageable_courses(user)
    allowed_course_ids = {str(course.id) for course in manageable_courses}
    ensure_accessible_course_ids(user, payload.course_ids, manageable_courses)
    if user.user_type == UserType.TEACHER and not payload.course_ids:
        raise HTTPException(
            status_code=400,
            detail="Преподаватель должен назначить ученика хотя бы на один свой курс",
        )

    auth_service = AuthService()
    student = User(
        name=payload.name,
        surname=payload.surname,
        tg_username=payload.tg_username,
        telegram_id=payload.telegram_id,
        phone=payload.phone,
        user_type=UserType.STUDENT,
        password_hash=auth_service.get_password_hash(payload.password),
    )
    await student.insert()
    await sync_student_course_memberships(
        str(student.id),
        payload.course_ids,
        payload.course_group_ids,
    )
    return await serialize_student_entry(student, allowed_course_ids)


@router.put("/students/{student_id}", response_model=StudentAdminResponse)
async def update_student(
    student_id: str,
    payload: AdminUpdateStudentRequest,
    user: User = Depends(require_role(UserType.TEACHER)),
):
    student = await get_by_id(student_id)
    if student.user_type != UserType.STUDENT:
        raise HTTPException(status_code=400, detail="Можно менять только учетные записи учащихся")

    manageable_courses = await get_manageable_courses(user)
    allowed_course_ids = {str(course.id) for course in manageable_courses}
    await ensure_can_manage_student(user, student, manageable_courses)

    if payload.course_ids is not None:
        ensure_accessible_course_ids(user, payload.course_ids, manageable_courses)

    if payload.tg_username and payload.tg_username != student.tg_username:
        existing = await get_by_tg_username(payload.tg_username)
        if existing and str(existing.id) != str(student.id):
            raise HTTPException(status_code=400, detail="Логин уже занят")
        student.tg_username = payload.tg_username

    for field in ["name", "surname", "telegram_id", "phone"]:
        value = getattr(payload, field)
        if value is not None:
            setattr(student, field, value)

    if payload.status is not None:
        try:
            student.status = UserStatus(payload.status)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Некорректный статус") from exc

    if payload.password:
        auth_service = AuthService()
        student.password_hash = auth_service.get_password_hash(payload.password)

    student.touch()
    await student.save()

    if payload.course_ids is not None:
        await sync_student_course_memberships(
            str(student.id),
            payload.course_ids,
            payload.course_group_ids or {},
        )

    return await serialize_student_entry(student, allowed_course_ids)


@router.post("/students/{student_id}/parents", response_model=StudentAdminResponse)
async def link_parent_to_student(
    student_id: str,
    payload: LinkParentRequest,
    user: User = Depends(require_role(UserType.TEACHER)),
):
    student = await get_by_id(student_id)
    if student.user_type != UserType.STUDENT:
        raise HTTPException(status_code=400, detail="Родителя можно привязать только к ученику")

    manageable_courses = await get_manageable_courses(user)
    allowed_course_ids = {str(course.id) for course in manageable_courses}
    await ensure_can_manage_student(user, student, manageable_courses)

    parent = await get_by_tg_username(payload.tg_username)
    if parent:
        if parent.user_type != UserType.PARENT:
            raise HTTPException(status_code=400, detail="Этот логин уже занят не родителем")
    else:
        if not payload.name or not payload.surname or not payload.password:
            raise HTTPException(
                status_code=400,
                detail="Для нового родителя нужны имя, фамилия и пароль",
            )
        if payload.phone and await User.find_one(User.phone == payload.phone):
            raise HTTPException(status_code=400, detail="Пользователь с таким телефоном уже существует")

        auth_service = AuthService()
        parent = User(
            name=payload.name,
            surname=payload.surname,
            tg_username=payload.tg_username,
            telegram_id=payload.telegram_id,
            phone=payload.phone,
            user_type=UserType.PARENT,
            password_hash=auth_service.get_password_hash(payload.password),
            linked_student_ids=[str(student.id)],
        )
        await parent.insert()
        return await serialize_student_entry(student, allowed_course_ids)

    if str(student.id) not in parent.linked_student_ids:
        parent.linked_student_ids.append(str(student.id))
        parent.touch()
        await parent.save()

    return await serialize_student_entry(student, allowed_course_ids)


@router.delete("/students/{student_id}/parents/{parent_id}", response_model=StudentAdminResponse)
async def unlink_parent_from_student(
    student_id: str,
    parent_id: str,
    user: User = Depends(require_role(UserType.TEACHER)),
):
    student = await get_by_id(student_id)
    if student.user_type != UserType.STUDENT:
        raise HTTPException(status_code=400, detail="Родителя можно отвязать только от ученика")

    manageable_courses = await get_manageable_courses(user)
    allowed_course_ids = {str(course.id) for course in manageable_courses}
    await ensure_can_manage_student(user, student, manageable_courses)

    parent = await get_by_id(parent_id)
    if parent.user_type != UserType.PARENT:
        raise HTTPException(status_code=400, detail="Пользователь не является родителем")

    parent.linked_student_ids = [
        linked_student_id
        for linked_student_id in parent.linked_student_ids
        if linked_student_id != str(student.id)
    ]
    parent.touch()
    await parent.save()

    return await serialize_student_entry(student, allowed_course_ids)


@router.get("/search", response_model=List[UserResponse])
async def users_search(
    q: str = Query("", description="Поиск по пользователям"),
    user: User = Depends(require_role(UserType.TEACHER)),
):
    if not q:
        users = await User.find_all().to_list()
    else:
        pattern = re.compile(re.escape(q), re.IGNORECASE)
        users = await User.find(
            {
                "$or": [
                    {"name": {"$regex": pattern}},
                    {"surname": {"$regex": pattern}},
                    {"tg_username": {"$regex": pattern}},
                ]
            }
        ).to_list()
    return [serialize_user(item) for item in users]
