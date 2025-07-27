from fastapi import APIRouter, Body, HTTPException
from typing import List
from models.group import Group
from models.user import UserType
from schemas.requests import CreateGroupRequest, UpdateGroupRequest, AddStudentsToGroupRequest, AddTeachersToGroupRequest
from schemas.responses import GroupResponse, MessageResponse
from services.auth_service import get_current_user_with_role
from services.user_service import get_by_tg_username

router = APIRouter(prefix="/group", tags=["Группы"])

@router.post("/create", response_model=MessageResponse, summary="Создать новую группу")
async def create_group(
    group_data: CreateGroupRequest = Body(..., description="Данные для создания новой группы"),
    access_token: str = Body(..., description="Токен доступа преподавателя")
):
    user = await get_current_user_with_role(access_token, UserType.TEACHER)
    
    # Проверяем существование курса
    from models.course import Course
    course = await Course.get(group_data.course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Курс не найден")
    
    # Создаем группу
    group = Group(
        course_id=group_data.course_id,
        name=group_data.name,
        description=group_data.description
    )
    await group.insert()
    
    # Добавляем группу в курс
    course.group_ids.append(str(group.id))
    await course.save()
    
    return MessageResponse(
        message=f"Группа '{group.name}' успешно создана с ID: {str(group.id)}",
        success=True
    )

@router.post("/update", response_model=MessageResponse, summary="Обновить группу")
async def update_group(
    group_id: str = Body(..., description="Идентификатор группы для обновления"),
    group_data: UpdateGroupRequest = Body(..., description="Данные для обновления группы"),
    access_token: str = Body(..., description="Токен доступа преподавателя")
):
    user = await get_current_user_with_role(access_token, UserType.TEACHER)
    group = await Group.get(group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Группа не найдена")
    
    if group_data.name is not None:
        group.name = group_data.name
    if group_data.description is not None:
        group.description = group_data.description
    
    await group.save()
    return MessageResponse(
        message=f"Группа '{group.name}' успешно обновлена",
        success=True
    )

@router.post("/add_students_bulk", response_model=MessageResponse, summary="Массово добавить студентов в группу")
async def add_students_to_group_bulk(
    group_id: str = Body(..., description="Идентификатор группы"),
    students_data: AddStudentsToGroupRequest = Body(..., description="Список идентификаторов студентов"),
    access_token: str = Body(..., description="Токен доступа преподавателя")
):
    user = await get_current_user_with_role(access_token, UserType.TEACHER)
    group = await Group.get(group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Группа не найдена")
    
    added_count = 0
    for student_id in students_data.student_ids:
        if student_id not in group.students:
            group.students.append(student_id)
            added_count += 1
    
    await group.save()
    return MessageResponse(
        message=f"Добавлено {added_count} студентов в группу '{group.name}'",
        success=True
    )

@router.post("/add_student", response_model=MessageResponse, summary="Добавить ученика в группу")
async def add_student_to_group(
    group_id: str = Body(..., description="Идентификатор группы"),
    student_tg: str = Body(..., description="Telegram username студента"),
    access_token: str = Body(..., description="Токен доступа преподавателя")
):
    user = await get_current_user_with_role(access_token, UserType.TEACHER)
    group = await Group.get(group_id)
    student = await get_by_tg_username(student_tg)
    
    if not group:
        raise HTTPException(status_code=404, detail="Группа не найдена")
    if not student:
        raise HTTPException(status_code=404, detail="Студент не найден")
    
    if str(student.id) not in group.students:
        group.students.append(str(student.id))
        await group.save()
        return MessageResponse(
            message=f"Студент {student_tg} успешно добавлен в группу {group.name}",
            success=True
        )
    else:
        return MessageResponse(
            message=f"Студент {student_tg} уже состоит в группе {group.name}",
            success=False
        )

@router.post("/remove_student", response_model=MessageResponse, summary="Удалить ученика из группы")
async def remove_student_from_group(
    group_id: str = Body(..., description="Идентификатор группы"),
    student_tg: str = Body(..., description="Telegram username студента"),
    access_token: str = Body(..., description="Токен доступа преподавателя")
):
    user = await get_current_user_with_role(access_token, UserType.TEACHER)
    group = await Group.get(group_id)
    student = await get_by_tg_username(student_tg)
    
    if not group:
        raise HTTPException(status_code=404, detail="Группа не найдена")
    if not student:
        raise HTTPException(status_code=404, detail="Студент не найден")
    
    if str(student.id) in group.students:
        group.students.remove(str(student.id))
        await group.save()
        return MessageResponse(
            message=f"Студент {student_tg} успешно удален из группы {group.name}",
            success=True
        )
    else:
        return MessageResponse(
            message=f"Студент {student_tg} не состоит в группе {group.name}",
            success=False
        )

@router.post("/add_teacher", response_model=MessageResponse, summary="Добавить преподавателя в группу")
async def add_teacher_to_group(
    group_id: str = Body(..., description="Идентификатор группы"),
    teacher_tg: str = Body(..., description="Telegram username преподавателя"),
    access_token: str = Body(..., description="Токен доступа администратора")
):
    user = await get_current_user_with_role(access_token, UserType.ADMIN)
    group = await Group.get(group_id)
    teacher = await get_by_tg_username(teacher_tg)
    
    if not group:
        raise HTTPException(status_code=404, detail="Группа не найдена")
    if not teacher:
        raise HTTPException(status_code=404, detail="Преподаватель не найден")
    
    if str(teacher.id) not in group.teachers:
        group.teachers.append(str(teacher.id))
        await group.save()
        return MessageResponse(
            message=f"Преподаватель {teacher_tg} успешно добавлен в группу {group.name}",
            success=True
        )
    else:
        return MessageResponse(
            message=f"Преподаватель {teacher_tg} уже состоит в группе {group.name}",
            success=False
        )

@router.post("/remove_teacher", response_model=MessageResponse, summary="Удалить преподавателя из группы")
async def remove_teacher_from_group(
    group_id: str = Body(..., description="Идентификатор группы"),
    teacher_tg: str = Body(..., description="Telegram username преподавателя"),
    access_token: str = Body(..., description="Токен доступа администратора")
):
    user = await get_current_user_with_role(access_token, UserType.ADMIN)
    group = await Group.get(group_id)
    teacher = await get_by_tg_username(teacher_tg)
    
    if not group:
        raise HTTPException(status_code=404, detail="Группа не найдена")
    if not teacher:
        raise HTTPException(status_code=404, detail="Преподаватель не найден")
    
    if str(teacher.id) in group.teachers:
        group.teachers.remove(str(teacher.id))
        await group.save()
        return MessageResponse(
            message=f"Преподаватель {teacher_tg} успешно удален из группы {group.name}",
            success=True
        )
    else:
        return MessageResponse(
            message=f"Преподаватель {teacher_tg} не состоит в группе {group.name}",
            success=False
        )

@router.post("/info", response_model=GroupResponse, summary="Получить информацию о группе")
async def group_info(
    group_id: str = Body(..., description="Идентификатор группы"),
    access_token: str = Body(..., description="Токен доступа пользователя")
):
    await get_current_user_with_role(access_token, UserType.STUDENT)
    group = await Group.get(group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Группа не найдена")
    
    return GroupResponse(
        id=str(group.id),
        course_id=str(group.course_id),
        name=group.name,
        description=group.description,
        students=[str(student_id) for student_id in group.students],
        teachers=[str(teacher_id) for teacher_id in group.teachers]
    )

@router.post("/list", response_model=List[GroupResponse], summary="Список всех групп")
async def groups_list(
    access_token: str = Body(..., description="Токен доступа пользователя")
):
    await get_current_user_with_role(access_token, UserType.STUDENT)
    groups = await Group.find_all().to_list()
    
    result = []
    for group in groups:
        group_response = GroupResponse(
            id=str(group.id),
            course_id=str(group.course_id),
            name=group.name,
            description=group.description,
            students=[str(student_id) for student_id in group.students],
            teachers=[str(teacher_id) for teacher_id in group.teachers]
        )
        result.append(group_response)
    
    return result
