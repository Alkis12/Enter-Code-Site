from fastapi import APIRouter, Body, HTTPException, Path
from typing import List
from models.course import Course
from models.topic import Topic
from models.task import Task
from models.user import UserType
from models.group import Group
from schemas.requests import CreateCourseRequest, UpdateCourseRequest
from schemas.responses import CourseResponse, MessageResponse
from services.auth_service import get_current_user_with_role
from services.user_service import get_by_tg_username

router = APIRouter(prefix="/course", tags=["Курсы"])

@router.post("/add", response_model=MessageResponse, summary="Добавить новый курс")
async def add_course(
    course_data: CreateCourseRequest = Body(..., description="Данные для создания нового курса"),
    access_token: str = Body(..., description="Токен доступа преподавателя")
):
    user = await get_current_user_with_role(access_token, UserType.TEACHER)
    course = Course(name=course_data.name, description=course_data.description)
    await course.insert()
    return MessageResponse(
        message=f"Курс '{course.name}' успешно создан с ID: {str(course.id)}",
        success=True
    )

@router.post("/update", response_model=MessageResponse, summary="Обновить курс")
async def update_course(
    course_id: str = Body(..., description="Идентификатор курса для обновления"),
    course_data: UpdateCourseRequest = Body(..., description="Данные для обновления курса"),
    access_token: str = Body(..., description="Токен доступа преподавателя")
):
    user = await get_current_user_with_role(access_token, UserType.TEACHER)
    course = await Course.get(course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Курс не найден")
    
    if course_data.name is not None:
        course.name = course_data.name
    if course_data.description is not None:
        course.description = course_data.description
    
    await course.save()
    return MessageResponse(
        message=f"Курс '{course.name}' успешно обновлен",
        success=True
    )

@router.post("/info", response_model=dict, summary="Получить информацию о курсе")
async def course_info(
    course_id: str = Body(..., description="Идентификатор курса"),
    access_token: str = Body(..., description="Токен доступа пользователя")
):
    user = await get_current_user_with_role(access_token, UserType.STUDENT)
    course = await Course.get(course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Курс не найден")
    
    topics = []
    for topic_id in course.topic_ids:
        topic = await Topic.get(topic_id)
        if topic:
            topics.append({"topic_id": str(topic.id), "name": topic.name})
    
    groups = []
    for group_id in course.group_ids:
        group = await Group.get(group_id)
        if group:
            groups.append({"group_id": str(group.id), "name": group.name})

    return {
        "course_id": str(course.id),
        "name": course.name,
        "description": course.description,
        "topics": topics,
        "groups": groups
    }

@router.post("/tree", summary="Вывести дерево курса")
async def course_tree(course_id: str = Body(...), access_token: str = Body(...)):
    user = await get_current_user_with_role(access_token, UserType.STUDENT)
    course = await Course.get(course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Курс не найден")
    tree = {"course_id": str(course.id), "name": course.name, "topics": []}
    for topic_id in course.topic_ids:
        topic = await Topic.get(topic_id)
        if topic:
            topic_info = {"topic_id": str(topic.id), "name": topic.name, "tasks": []}
            for task_id in topic.task_ids:
                task = await Task.get(task_id)
                if task:
                    topic_info["tasks"].append({"task_id": str(task.id), "name": task.condition})
            tree["topics"].append(topic_info)
    groups = []
    for group_id in course.group_ids:
        group = await Group.get(group_id)
        if group:
            groups.append({"group_id": str(group.id), "name": group.name})
    tree["groups"] = groups
    return tree

@router.post("/result", summary="Получить процент решённых задач по курсу для ученика")
async def course_result(course_id: str = Body(...), tg_username: str = Body(...), access_token: str = Body(...)):
    user = await get_current_user_with_role(access_token, UserType.STUDENT)
    course = await Course.get(course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Курс не найден")
    student = await get_by_tg_username(tg_username)
    if not student:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    # Проверка прав доступа: пользователь может смотреть только свои результаты, 
    # либо преподаватель/админ может смотреть результаты учеников
    if user.tg_username != tg_username and user.user_type not in [UserType.TEACHER, UserType.ADMIN]:
        raise HTTPException(status_code=403, detail="Недостаточно прав для просмотра чужих результатов")
    
    percent = await course.get_user_success_percent(student.tg_username)
    return {"course_id": str(course.id), "tg_username": student.tg_username, "percent": percent}

@router.post("/list", response_model=List[CourseResponse], summary="Список всех курсов")
async def courses_list(
    access_token: str = Body(..., description="Токен доступа пользователя")
):
    await get_current_user_with_role(access_token, UserType.STUDENT)
    courses = await Course.find_all().to_list()
    
    result = []
    for course in courses:
        course_response = CourseResponse(
            id=str(course.id),
            name=course.name,
            description=course.description,
            group_ids=[str(gid) for gid in course.group_ids],
            topic_ids=[str(tid) for tid in course.topic_ids],
            total_tasks=await course.get_total_tasks(),
            total_students=await course.get_total_students()
        )
        result.append(course_response)
    
    return result

@router.post("/{id}", summary="Детали курса")
async def course_detail(id: int = Path(...), access_token: str = Body(...)):
    await get_current_user_with_role(access_token, UserType.STUDENT)
    course = await Course.get(id)
    if not course:
        raise HTTPException(status_code=404, detail="Курс не найден")
    details = {
        "id": str(course.id),
        "name": course.name,
        "description": course.description,
        "group_ids": [str(gid) for gid in course.group_ids],
        "topic_ids": [str(tid) for tid in course.topic_ids]
    }
    return {"course_id": str(course.id), "details": details}

# Примечание: этот метод устарел, так как теперь студенты записываются в группы, а не напрямую в курсы
# @router.post("/{id}/enroll", summary="Записаться на курс")
# async def enroll_course(id: int = Path(...), user_id: int = Body(...), access_token: str = Body(...)):
#     # Этот функционал перенесен в группы