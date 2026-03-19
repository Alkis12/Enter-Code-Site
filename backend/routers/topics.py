from fastapi import APIRouter, Depends, HTTPException

from models.course import Course
from models.topic import Topic
from models.user import User, UserType
from schemas.requests import CreateTopicRequest, UpdateTopicRequest
from schemas.responses import LessonDetailResponse, MessageResponse
from services.auth_service import get_current_user_dependency, require_role
from services.learning_service import (
    can_edit_course,
    get_courses_for_user,
    get_group_visible_topic_order,
    get_student_group_for_course,
)
from services.serializer_service import serialize_course, serialize_task, serialize_topic
from models.task import Task


router = APIRouter(prefix="/topic", tags=["Уроки"])


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


@router.post("/add", response_model=MessageResponse)
async def add_topic(
    payload: CreateTopicRequest,
    user: User = Depends(require_role(UserType.TEACHER)),
):
    course = await Course.get(payload.course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Курс не найден")
    if not await can_edit_course(user, course):
        raise HTTPException(status_code=403, detail="Нет прав на изменение курса")

    existing_topics = await Topic.find(Topic.course_id == payload.course_id).to_list()
    topic = Topic(
        course_id=payload.course_id,
        name=payload.name,
        description=payload.description,
        content=payload.content,
        resources=payload.resources,
        order=payload.order,
        is_open=len(existing_topics) == 0,
    )
    await topic.insert()
    course.topic_ids.append(str(topic.id))
    course.touch()
    await course.save()
    return MessageResponse(message=f"Урок '{topic.name}' создан", success=True)


@router.put("/{topic_id}", response_model=MessageResponse)
async def update_topic(
    topic_id: str,
    payload: UpdateTopicRequest,
    user: User = Depends(require_role(UserType.TEACHER)),
):
    topic = await Topic.get(topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Урок не найден")
    course = await Course.get(topic.course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Курс не найден")
    if not await can_edit_course(user, course):
        raise HTTPException(status_code=403, detail="Нет прав на изменение урока")

    for field in ["name", "description", "content", "resources", "order", "is_open"]:
        value = getattr(payload, field)
        if value is not None:
            setattr(topic, field, value)
    topic.touch()
    await topic.save()
    return MessageResponse(message="Урок обновлен", success=True)


@router.delete("/{topic_id}", response_model=MessageResponse)
async def delete_topic(
    topic_id: str,
    user: User = Depends(require_role(UserType.TEACHER)),
):
    topic = await Topic.get(topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Урок не найден")
    course = await Course.get(topic.course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Курс не найден")
    if not await can_edit_course(user, course):
        raise HTTPException(status_code=403, detail="Нет прав на удаление урока")

    course.topic_ids = [item for item in course.topic_ids if item != str(topic.id)]
    course.touch()
    await course.save()
    await topic.delete()
    return MessageResponse(message="Урок удален", success=True)


@router.get("/{topic_id}", response_model=LessonDetailResponse)
async def topic_detail(
    topic_id: str,
    user: User = Depends(get_current_user_dependency),
):
    topic = await Topic.get(topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Урок не найден")
    course = await Course.get(topic.course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Курс не найден")

    user_courses = {str(item.id) for item in await get_courses_for_user(user)}
    if user.user_type != UserType.ADMIN and str(course.id) not in user_courses:
        raise HTTPException(status_code=403, detail="Нет доступа к уроку")

    editable = await can_edit_course(user, course)
    course_topics = await Topic.find(Topic.course_id == topic.course_id).to_list()
    course_topics.sort(key=lambda item: item.order)
    can_access = await lesson_is_available_for_user(user, course, topic, course_topics, editable)
    if user.user_type == UserType.STUDENT and not can_access:
        raise HTTPException(status_code=403, detail="РЈСЂРѕРє РїРѕРєР° Р·Р°РєСЂС‹С‚")
    tasks = await Task.find(Task.topic_id == topic_id).to_list()
    tasks.sort(key=lambda item: item.order)
    return LessonDetailResponse(
        course=await serialize_course(course, user),
        lesson=await serialize_topic(topic, user, can_edit=editable, can_access=can_access),
        course_lessons=[
            await serialize_topic(
                item,
                user,
                can_edit=editable,
                can_access=await lesson_is_available_for_user(user, course, item, course_topics, editable),
            )
            for item in course_topics
        ],
        tasks=[await serialize_task(task, user, can_edit=editable) for task in tasks],
    )
