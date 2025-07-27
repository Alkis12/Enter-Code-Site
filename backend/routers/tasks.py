from fastapi import APIRouter, Body, HTTPException, Path
from typing import List, Optional
from datetime import datetime
from models.task import Task, TaskStatus
from models.topic import Topic
from models.user import UserType
from schemas.requests import CreateTaskRequest, UpdateTaskRequest, SubmitTaskSolutionRequest
from schemas.responses import TaskResponse, MessageResponse, TaskResultResponse
from services.auth_service import get_current_user_with_role
from services.user_service import get_by_tg_username

router = APIRouter(prefix="/task", tags=["Задачи"])

@router.post("/student_status", response_model=dict, summary="Получить статус ученика по задаче")
async def get_student_task_status(
    task_id: str = Body(..., description="Идентификатор задачи"),
    user_id: str = Body(..., description="Идентификатор пользователя"),
    access_token: str = Body(..., description="Токен доступа")
):
    user = await get_current_user_with_role(access_token, UserType.STUDENT)
    task = await Task.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Задача не найдена")
    
    # Проверка прав доступа
    if str(user.id) != str(user_id) and user.user_type not in [UserType.TEACHER, UserType.ADMIN]:
        raise HTTPException(status_code=403, detail="Недостаточно прав для просмотра чужого статуса")
    
    status = None
    score = 0.0
    for result in task.results:
        if result.user_id == user_id:
            status = result.status
            score = result.score
            break
    
    return {
        "task_id": task_id,
        "user_id": user_id,
        "status": status,
        "score": score
    }

@router.post("/add", response_model=MessageResponse, summary="Добавить новую задачу в тему")
async def add_task(
    task_data: CreateTaskRequest = Body(..., description="Данные для создания новой задачи"),
    access_token: str = Body(..., description="Токен доступа преподавателя")
):
    await get_current_user_with_role(access_token, UserType.TEACHER)
    topic = await Topic.get(task_data.topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Тема не найдена")
    
    task = Task(
        topic_id=task_data.topic_id,
        condition=task_data.condition,
        attachments=task_data.attachments
    )
    await task.insert()
    
    topic.task_ids.append(str(task.id))
    await topic.save()
    
    return MessageResponse(
        message=f"Задача успешно создана с ID: {str(task.id)}",
        success=True
    )

@router.post("/update", response_model=MessageResponse, summary="Изменить задачу по её ID")
async def update_task(
    task_id: str = Body(..., description="Идентификатор задачи для обновления"),
    task_data: UpdateTaskRequest = Body(..., description="Новые данные задачи"),
    access_token: str = Body(..., description="Токен доступа преподавателя")
):
    await get_current_user_with_role(access_token, UserType.TEACHER)
    task = await Task.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Задача не найдена")
    
    if task_data.condition is not None:
        task.condition = task_data.condition
    if task_data.attachments is not None:
        task.attachments = task_data.attachments
    
    await task.save()
    return MessageResponse(message="Задача успешно обновлена", success=True)

@router.post("/move", summary="Переместить задачу на новое место в теме")
async def move_task(topic_id: str = Body(...), task_id: str = Body(...), new_position: int = Body(...), access_token: str = Body(...)):
    await get_current_user_with_role(access_token, UserType.TEACHER)  # пользователь не используется
    topic = await Topic.get(topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Тема не найдена")
    if task_id not in topic.task_ids:
        raise HTTPException(status_code=404, detail="Задача не найдена в теме")
    topic.task_ids.remove(task_id)
    topic.task_ids.insert(new_position, task_id)
    await topic.save()
    return {"success": True}

@router.post("/delete", summary="Удалить задачу из темы")
async def delete_task(topic_id: str = Body(...), task_id: str = Body(...), access_token: str = Body(...)):
    await get_current_user_with_role(access_token, UserType.TEACHER)  # пользователь не используется
    topic = await Topic.get(topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Тема не найдена")
    if task_id not in topic.task_ids:
        raise HTTPException(status_code=404, detail="Задача не найдена в теме")
    topic.task_ids.remove(task_id)
    await topic.save()
    await Task.delete(task_id)
    return {"success": True}

@router.post("/info", summary="Получить информацию о задаче (и статус ученика)")
async def task_info(task_id: str = Body(...), tg_username: str = Body(default=None), access_token: str = Body(...)):
    user = await get_current_user_with_role(access_token, UserType.STUDENT)  
    task = await Task.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Задача не найдена")
    status = None
    if tg_username:
        # Проверка прав доступа: пользователь может смотреть только свой статус, 
        # либо преподаватель/админ может смотреть статус учеников
        if user.tg_username != tg_username and user.user_type not in [UserType.TEACHER, UserType.ADMIN]:
            raise HTTPException(status_code=403, detail="Недостаточно прав для просмотра чужого статуса")
        
        student = await get_by_tg_username(tg_username)
        if not student:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        status = await task.get_status_for_student(student.id)
    return {
        "task": task.dict(),
        "status": status
    }

@router.post("/submit", response_model=MessageResponse, summary="Отправить решение задачи")
async def submit_task_solution(
    solution_data: SubmitTaskSolutionRequest = Body(..., description="Решение задачи и прикрепленные файлы"),
    access_token: str = Body(..., description="Токен доступа студента")
):
    user = await get_current_user_with_role(access_token, UserType.STUDENT)
    task = await Task.get(solution_data.task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Задача не найдена")
    
    # Проверяем, есть ли уже результат для этого пользователя
    existing_result = None
    for result in task.results:
        if result.user_id == user.id:
            existing_result = result
            break
    
    if existing_result:
        # Обновляем существующий результат
        existing_result.status = TaskStatus.UNDER_REVIEW
        existing_result.score = 0.0  # Сбрасываем оценку
    else:
        # Создаем новый результат
        from models.task import TaskResult
        new_result = TaskResult(
            user_id=str(user.id),
            status=TaskStatus.UNDER_REVIEW,
            score=0.0
        )
        task.results.append(new_result)
    
    # Сохраняем решение в истории чата (можно расширить эту логику)
    solution_entry = {
        "type": "solution_submission",
        "user_id": str(user.id),
        "solution": solution_data.solution,
        "attachments": solution_data.attachments,
        "timestamp": datetime.now().isoformat()
    }
    task.chat_history.append(solution_entry)
    
    await task.save()
    
    return MessageResponse(
        message="Решение успешно отправлено на проверку",
        success=True
    )

@router.post("/list", response_model=List[TaskResponse], summary="Список задач")
async def tasks_list(
    access_token: str = Body(..., description="Токен доступа пользователя")
):
    await get_current_user_with_role(access_token, UserType.STUDENT)
    tasks = await Task.find_all().to_list()
    
    result = []
    for task in tasks:
        # Возвращаем созданную задачу
        task_response = TaskResponse(
            id=str(task.id),
            title=task.title,
            description=task.description,
            difficulty=task.difficulty,
            max_score=task.max_score,
            example_input=task.example_input,
            example_output=task.example_output,
            topic_id=str(task.topic_id),
            position=task.position,
            is_active=task.is_active,
            is_current=task.is_current,
            created_at=task.created_at,
            updated_at=task.updated_at
        )
        result.append(task_response)
    
    return result

@router.get("/{id}", response_model=TaskResponse, summary="Детали задачи")
async def task_detail(
    id: str = Path(..., description="Идентификатор задачи")
):
    task = await Task.get(id)
    if not task:
        raise HTTPException(status_code=404, detail="Задача не найдена")
    
    return TaskResponse(
        id=str(task.id),
        title=task.title,
        description=task.description,
        difficulty=task.difficulty,
        max_score=task.max_score,
        example_input=task.example_input,
        example_output=task.example_output,
        topic_id=str(task.topic_id),
        position=task.position,
        is_active=task.is_active,
        is_current=task.is_current,
        created_at=task.created_at,
        updated_at=task.updated_at
    )

