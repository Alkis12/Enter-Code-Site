import os
from pathlib import Path
from typing import List
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from models.course import Course
from models.course_request import CourseRequest
from models.group import Group
from models.topic import Topic
from models.user import User, UserType
from schemas.requests import (
    CreateCourseGroupRequest,
    CreateCourseRequest,
    CreateCourseRequestLeadRequest,
    SetCourseMembersRequest,
    UpdateCourseGroupRequest,
    UpdateCourseRequest,
)
from schemas.responses import (
    CourseDetailResponse,
    CourseResponse,
    GroupResponse,
    MessageResponse,
    PublicCourseDetailResponse,
    PublicCourseGroupResponse,
    PublicCourseLessonResponse,
    UserCoursesResponse,
)
from services.auth_service import get_current_user_dependency, require_role
from services.learning_service import (
    can_edit_course,
    get_course_students,
    get_courses_for_user,
    get_group_visible_topic_order,
    get_groups_for_course,
    get_student_group_for_course,
)
from services.serializer_service import (
    build_group_schedule_summary,
    serialize_course,
    serialize_course_member,
    serialize_group,
    serialize_topic,
)


def lesson_is_available(topic: Topic, ordered_topics: list[Topic]) -> bool:
    if topic.is_open:
        return True
    if not ordered_topics:
        return True
    return str(ordered_topics[0].id) == str(topic.id)


async def lesson_is_available_for_user(
    user: User,
    course: Course,
    topic: Topic,
    ordered_topics: list[Topic],
    editable: bool,
) -> bool:
    if editable or user.user_type != UserType.STUDENT:
        return True
    student_group = await get_student_group_for_course(str(user.id), str(course.id))
    visible_order = get_group_visible_topic_order(student_group, ordered_topics)
    return topic.order <= visible_order


router = APIRouter(prefix="/course", tags=["РљСѓСЂСЃС‹"])
uploads_dir = Path(os.getenv("UPLOADS_DIR", "uploads"))
course_uploads_dir = uploads_dir / "courses"
course_uploads_dir.mkdir(parents=True, exist_ok=True)


@router.get("/my", response_model=UserCoursesResponse)
async def my_courses(user: User = Depends(get_current_user_dependency)):
    courses = await get_courses_for_user(user)
    serialized = [await serialize_course(course, user) for course in courses]
    return UserCoursesResponse(courses=serialized, total=len(serialized))


@router.get("/list", response_model=List[CourseResponse])
async def courses_list(user: User = Depends(get_current_user_dependency)):
    courses = await get_courses_for_user(user)
    return [await serialize_course(course, user) for course in courses]


@router.get("/public/{course_id}", response_model=PublicCourseDetailResponse)
async def public_course_detail(course_id: str):
    course = await Course.get(course_id)
    if not course:
        raise HTTPException(status_code=404, detail="РљСѓСЂСЃ РЅРµ РЅР°Р№РґРµРЅ")
    topics = await Topic.find(Topic.course_id == course_id).to_list()
    topics.sort(key=lambda item: item.order)
    groups = await get_groups_for_course(course)

    public_groups: List[PublicCourseGroupResponse] = []
    for group in groups:
        current_topic_name = None
        if group.current_topic_id:
            current_topic = await Topic.get(group.current_topic_id)
            if current_topic:
                current_topic_name = current_topic.name
        public_groups.append(
            PublicCourseGroupResponse(
                id=str(group.id),
                name=group.name,
                schedule_summary=build_group_schedule_summary(group),
                current_topic_name=current_topic_name,
            )
        )

    public_lessons: List[PublicCourseLessonResponse] = []
    for topic in topics:
        public_lessons.append(
            PublicCourseLessonResponse(
                id=str(topic.id),
                name=topic.name,
                description=topic.description,
                order=topic.order,
                total_tasks=await topic.get_total_tasks(),
            )
        )

    return PublicCourseDetailResponse(
        course=await serialize_course(course, None),
        groups=public_groups,
        lessons=public_lessons,
    )


@router.get("/{course_id}", response_model=CourseDetailResponse)
async def course_detail(
    course_id: str,
    user: User = Depends(get_current_user_dependency),
):
    course = await Course.get(course_id)
    if not course:
        raise HTTPException(status_code=404, detail="РљСѓСЂСЃ РЅРµ РЅР°Р№РґРµРЅ")

    user_courses = {str(item.id) for item in await get_courses_for_user(user)}
    if user.user_type != UserType.ADMIN and course_id not in user_courses:
        raise HTTPException(status_code=403, detail="РќРµС‚ РґРѕСЃС‚СѓРїР° Рє РєСѓСЂСЃСѓ")

    editable = await can_edit_course(user, course)
    topics = await Topic.find(Topic.course_id == course_id).to_list()
    topics.sort(key=lambda item: item.order)
    groups = await get_groups_for_course(course)
    course_students = []
    if editable:
        for student_id in await get_course_students(course):
            student = await User.get(student_id)
            if student and student.user_type == UserType.STUDENT:
                course_students.append(serialize_course_member(student))
        course_students.sort(key=lambda item: (item.surname.lower(), item.name.lower(), item.tg_username.lower()))
    return CourseDetailResponse(
        course=await serialize_course(course, user),
        groups=[await serialize_group(group, course) for group in groups],
        students=course_students,
        lessons=[
            await serialize_topic(
                topic,
                user,
                can_edit=editable,
                can_access=await lesson_is_available_for_user(user, course, topic, topics, editable),
            )
            for topic in topics
        ],
        leaderboard=[],
    )


@router.post("/add", response_model=MessageResponse)
async def add_course(
    payload: CreateCourseRequest,
    user: User = Depends(require_role(UserType.TEACHER)),
):
    teacher_ids = list(set(payload.teacher_ids + [str(user.id)]))
    course = Course(
        name=payload.name,
        description=payload.description,
        public_info=payload.public_info,
        accent_color=payload.accent_color,
        cover_image=payload.cover_image,
        schedule_weekdays=payload.schedule_weekdays,
        schedule_start_time=payload.schedule_start_time,
        schedule_end_time=payload.schedule_end_time,
        teacher_ids=teacher_ids,
        student_ids=payload.student_ids,
    )
    await course.insert()
    return MessageResponse(message=f"РљСѓСЂСЃ '{course.name}' СЃРѕР·РґР°РЅ", success=True)


@router.post("/upload-cover")
async def upload_course_cover(
    file: UploadFile = File(...),
    user: User = Depends(require_role(UserType.TEACHER)),
):
    ext = Path(file.filename or "").suffix.lower()
    if ext not in {".jpg", ".jpeg", ".png", ".webp", ".gif"}:
        raise HTTPException(
            status_code=400,
            detail="Поддерживаются только изображения jpg, png, webp и gif",
        )

    filename = f"{uuid4().hex}{ext}"
    target_path = course_uploads_dir / filename
    content = await file.read()
    target_path.write_bytes(content)
    await file.close()

    return {"url": f"/uploads/courses/{filename}", "filename": filename}


@router.put("/{course_id}", response_model=MessageResponse)
async def update_course(
    course_id: str,
    payload: UpdateCourseRequest,
    user: User = Depends(require_role(UserType.TEACHER)),
):
    course = await Course.get(course_id)
    if not course:
        raise HTTPException(status_code=404, detail="РљСѓСЂСЃ РЅРµ РЅР°Р№РґРµРЅ")
    if not await can_edit_course(user, course):
        raise HTTPException(status_code=403, detail="РќРµС‚ РїСЂР°РІ РЅР° РёР·РјРµРЅРµРЅРёРµ РєСѓСЂСЃР°")

    for field in [
        "name",
        "description",
        "public_info",
        "accent_color",
        "cover_image",
        "schedule_weekdays",
        "schedule_start_time",
        "schedule_end_time",
    ]:
        value = getattr(payload, field)
        if value is not None:
            setattr(course, field, value)
    course.touch()
    await course.save()
    return MessageResponse(message="РљСѓСЂСЃ РѕР±РЅРѕРІР»РµРЅ", success=True)


@router.put("/{course_id}/members", response_model=MessageResponse)
async def set_course_members(
    course_id: str,
    payload: SetCourseMembersRequest,
    user: User = Depends(require_role(UserType.TEACHER)),
):
    course = await Course.get(course_id)
    if not course:
        raise HTTPException(status_code=404, detail="РљСѓСЂСЃ РЅРµ РЅР°Р№РґРµРЅ")
    if not await can_edit_course(user, course):
        raise HTTPException(status_code=403, detail="РќРµС‚ РїСЂР°РІ РЅР° РёР·РјРµРЅРµРЅРёРµ РєСѓСЂСЃР°")

    course.student_ids = payload.student_ids
    course.teacher_ids = list(set(payload.teacher_ids + [str(user.id)]))
    course.touch()
    await course.save()
    return MessageResponse(message="РЎРѕСЃС‚Р°РІ РєСѓСЂСЃР° РѕР±РЅРѕРІР»РµРЅ", success=True)


@router.post("/{course_id}/groups", response_model=GroupResponse)
async def create_course_group(
    course_id: str,
    payload: CreateCourseGroupRequest,
    user: User = Depends(require_role(UserType.TEACHER)),
):
    course = await Course.get(course_id)
    if not course:
        raise HTTPException(status_code=404, detail="РљСѓСЂСЃ РЅРµ РЅР°Р№РґРµРЅ")
    if not await can_edit_course(user, course):
        raise HTTPException(status_code=403, detail="РќРµС‚ РїСЂР°РІ РЅР° РёР·РјРµРЅРµРЅРёРµ РєСѓСЂСЃР°")

    group = Group(
        course_id=course_id,
        name=payload.name or "Новая группа",
        teachers=list(set(course.teacher_ids + [str(user.id)])),
        students=payload.student_ids,
        schedule_slots=payload.schedule_slots,
        current_topic_id=payload.current_topic_id,
    )
    await group.insert()

    if str(group.id) not in course.group_ids:
        course.group_ids.append(str(group.id))
        course.touch()
        await course.save()

    return await serialize_group(group, course)


@router.put("/{course_id}/groups/{group_id}", response_model=GroupResponse)
async def update_course_group(
    course_id: str,
    group_id: str,
    payload: UpdateCourseGroupRequest,
    user: User = Depends(require_role(UserType.TEACHER)),
):
    course = await Course.get(course_id)
    if not course:
        raise HTTPException(status_code=404, detail="РљСѓСЂСЃ РЅРµ РЅР°Р№РґРµРЅ")
    if not await can_edit_course(user, course):
        raise HTTPException(status_code=403, detail="РќРµС‚ РїСЂР°РІ РЅР° РёР·РјРµРЅРµРЅРёРµ РєСѓСЂСЃР°")

    group = await Group.get(group_id)
    if not group or group.course_id != course_id:
        raise HTTPException(status_code=404, detail="Р“СЂСѓРїРїР° РЅРµ РЅР°Р№РґРµРЅР°")

    if payload.name is not None:
        group.name = payload.name
    if payload.schedule_slots is not None:
        group.schedule_slots = payload.schedule_slots
    if payload.current_topic_id is not None:
        group.current_topic_id = payload.current_topic_id or None
    if payload.student_ids is not None:
        group.touch()
        await group.save()
        course_groups = await get_groups_for_course(course)
        normalized_student_ids = list(dict.fromkeys(payload.student_ids))
        for course_group in course_groups:
            if str(course_group.id) == str(group.id):
                course_group.students = normalized_student_ids
            else:
                course_group.students = [
                    student_id
                    for student_id in course_group.students
                    if student_id not in normalized_student_ids
                ]
            course_group.touch()
            await course_group.save()
        group = await Group.get(group_id)
    group.teachers = list(set(group.teachers + course.teacher_ids + [str(user.id)]))
    group.touch()
    await group.save()
    return await serialize_group(group, course)


@router.delete("/{course_id}/groups/{group_id}", response_model=MessageResponse)
async def delete_course_group(
    course_id: str,
    group_id: str,
    user: User = Depends(require_role(UserType.TEACHER)),
):
    course = await Course.get(course_id)
    if not course:
        raise HTTPException(status_code=404, detail="РљСѓСЂСЃ РЅРµ РЅР°Р№РґРµРЅ")
    if not await can_edit_course(user, course):
        raise HTTPException(status_code=403, detail="РќРµС‚ РїСЂР°РІ РЅР° РёР·РјРµРЅРµРЅРёРµ РєСѓСЂСЃР°")

    group = await Group.get(group_id)
    if not group or group.course_id != course_id:
        raise HTTPException(status_code=404, detail="Р“СЂСѓРїРїР° РЅРµ РЅР°Р№РґРµРЅР°")

    course.group_ids = [item for item in course.group_ids if item != group_id]
    course.touch()
    await course.save()
    await group.delete()
    return MessageResponse(message="Р“СЂСѓРїРїР° СѓРґР°Р»РµРЅР°", success=True)


@router.post("/{course_id}/request", response_model=MessageResponse)
async def create_course_request(course_id: str, payload: CreateCourseRequestLeadRequest):
    course = await Course.get(course_id)
    if not course:
        raise HTTPException(status_code=404, detail="РљСѓСЂСЃ РЅРµ РЅР°Р№РґРµРЅ")

    request = CourseRequest(
        course_id=course_id,
        course_name=course.name,
        contact_name=payload.contact_name,
        contact_value=payload.contact_value,
        comment=payload.comment,
    )
    await request.insert()
    return MessageResponse(
        message="Р—Р°СЏРІРєР° РѕС‚РїСЂР°РІР»РµРЅР°. РњС‹ СЃРІСЏР¶РµРјСЃСЏ СЃ РІР°РјРё.",
        success=True,
    )
