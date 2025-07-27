from fastapi import APIRouter, Body, HTTPException
from typing import List
from models.topic import Topic
from models.task import Task
from models.course import Course
from models.user import UserType
from schemas.requests import CreateTopicRequest, UpdateTopicRequest
from schemas.responses import TopicResponse, MessageResponse
from services.auth_service import get_current_user_with_role
from services.user_service import get_by_tg_username

router = APIRouter(prefix="/topic", tags=["Темы"])

@router.post("/add", response_model=MessageResponse, summary="Добавить новую тему в курс")
async def add_topic(
    topic_data: CreateTopicRequest = Body(..., description="Данные для создания новой темы"),
    access_token: str = Body(..., description="Токен доступа преподавателя")
):
    await get_current_user_with_role(access_token, UserType.TEACHER)
    course = await Course.get(topic_data.course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Курс не найден")
    
    topic = Topic(
        course_id=topic_data.course_id,
        name=topic_data.name,
        description=topic_data.description,
        resources=topic_data.resources,
        task_ids=[]
    )
    await topic.insert()
    
    course.topic_ids.append(str(topic.id))
    await course.save()
    
    return MessageResponse(
        message=f"Тема '{topic.name}' успешно создана с ID: {str(topic.id)}",
        success=True
    )

@router.post("/update", response_model=MessageResponse, summary="Обновить тему")
async def update_topic(
    topic_id: str = Body(..., description="Идентификатор темы для обновления"),
    topic_data: UpdateTopicRequest = Body(..., description="Данные для обновления темы"),
    access_token: str = Body(..., description="Токен доступа преподавателя")
):
    await get_current_user_with_role(access_token, UserType.TEACHER)
    topic = await Topic.get(topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Тема не найдена")
    
    if topic_data.name is not None:
        topic.name = topic_data.name
    if topic_data.description is not None:
        topic.description = topic_data.description
    if topic_data.resources is not None:
        topic.resources = topic_data.resources
    
    await topic.save()
    return MessageResponse(
        message=f"Тема '{topic.name}' успешно обновлена",
        success=True
    )

@router.post("/delete", summary="Удалить тему из курса")
async def delete_topic(course_id: str = Body(...), topic_id: str = Body(...), access_token: str = Body(...)):
    await get_current_user_with_role(access_token, UserType.TEACHER)  # пользователь не используется
    course = await Course.get(course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Курс не найден")
    if topic_id not in course.topic_ids:
        raise HTTPException(status_code=404, detail="Тема не найдена в курсе")
    course.topic_ids.remove(topic_id)
    await course.save()
    await Topic.delete(topic_id)
    return {"success": True}

@router.post("/info", response_model=TopicResponse, summary="Получить информацию о теме")
async def topic_info(
    topic_id: str = Body(..., description="Идентификатор темы"),
    access_token: str = Body(..., description="Токен доступа пользователя")
):
    await get_current_user_with_role(access_token, UserType.STUDENT)
    topic = await Topic.get(topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Тема не найдена")
    
    return TopicResponse(
        id=str(topic.id),
        course_id=str(topic.course_id),
        name=topic.name,
        description=topic.description,
        resources=topic.resources,
        task_ids=[str(tid) for tid in topic.task_ids],
        total_tasks=await topic.get_total_tasks()
    )

@router.post("/result", response_model=dict, summary="Получить процент решённых задач по теме для ученика")
async def topic_result(
    topic_id: str = Body(..., description="Идентификатор темы"),
    tg_username: str = Body(..., description="Telegram username ученика"),
    access_token: str = Body(..., description="Токен доступа")
):
    user = await get_current_user_with_role(access_token, UserType.STUDENT)
    topic = await Topic.get(topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Тема не найдена")
    
    # Проверка прав доступа
    if user.tg_username != tg_username and user.user_type not in [UserType.TEACHER, UserType.ADMIN]:
        raise HTTPException(status_code=403, detail="Недостаточно прав для просмотра чужих результатов")
    
    student = await get_by_tg_username(tg_username)
    if not student:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    percent = await topic.get_user_success_percent(student.id)
    total_tasks = await topic.get_total_tasks()
    solved_tasks = await topic.get_user_solved_count(student.id)
    
    return {
        "topic_id": topic_id,
        "user_id": str(student.id),
        "tg_username": tg_username,
        "percent": percent,
        "solved_tasks": solved_tasks,
        "total_tasks": total_tasks
    }

@router.post("/list", response_model=List[TopicResponse], summary="Список всех тем (зачем?)")
async def topics_list(
    access_token: str = Body(..., description="Токен доступа пользователя")
):
    await get_current_user_with_role(access_token, UserType.STUDENT)
    topics = await Topic.find_all().to_list()
    
    result = []
    for topic in topics:
        topic_response = TopicResponse(
            id=str(topic.id),
            course_id=str(topic.course_id),
            name=topic.name,
            description=topic.description,
            resources=topic.resources,
            task_ids=[str(tid) for tid in topic.task_ids],
            total_tasks=await topic.get_total_tasks()
        )
        result.append(topic_response)
    return result
