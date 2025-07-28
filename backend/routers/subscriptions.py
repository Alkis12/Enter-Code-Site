from fastapi import APIRouter, Body, HTTPException
from models.user import User, UserType
from schemas.requests import ExtendSubscriptionRequest
from schemas.responses import MessageResponse, SubscriptionResponse
from services.auth_service import get_current_user_with_role
from services.user_service import get_by_tg_username

router = APIRouter(prefix="/subscription", tags=["Абонементы"])

@router.post("/extend", response_model=MessageResponse, summary="Продлить абонемент студента")
async def extend_subscription(
    subscription_data: ExtendSubscriptionRequest = Body(..., description="Данные для продления абонемента"),
    access_token: str = Body(..., description="Токен доступа администратора или преподавателя")
):
    # Только преподаватели и админы могут продлевать абонементы
    await get_current_user_with_role(access_token, UserType.TEACHER)
    
    user = await get_by_tg_username(subscription_data.tg_username)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    if user.user_type != UserType.STUDENT:
        raise HTTPException(status_code=400, detail="Абонемент можно продлить только для студентов")
    
    # Продлеваем абонемент
    user.extend_subscription(subscription_data.lessons_count)
    await user.save()
    
    return MessageResponse(
        message=f"Абонемент пользователя {user.full_name} успешно продлен на {subscription_data.lessons_count} занятий",
        success=True
    )

@router.post("/info", response_model=SubscriptionResponse, summary="Получить информацию об абонементе")
async def subscription_info(
    tg_username: str = Body(..., description="Telegram username пользователя"),
    access_token: str = Body(..., description="Токен доступа")
):
    current_user = await get_current_user_with_role(access_token, UserType.STUDENT)
    
    # Студенты могут смотреть только свой абонемент, преподаватели и админы - любой
    if current_user.user_type == UserType.STUDENT and current_user.tg_username != tg_username:
        raise HTTPException(status_code=403, detail="Недостаточно прав для просмотра чужого абонемента")
    
    user = await get_by_tg_username(tg_username)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    if user.user_type != UserType.STUDENT:
        raise HTTPException(status_code=400, detail="Информация об абонементе доступна только для студентов")
    
    return SubscriptionResponse(
        tg_username=user.tg_username,
        subscription_status=user.subscription_status,
        lessons_remaining=user.lessons_remaining,
        has_valid_subscription=user.has_valid_subscription()
    )

@router.post("/use-lesson", response_model=MessageResponse, summary="Использовать одно занятие")
async def use_lesson(
    tg_username: str = Body(..., description="Telegram username студента"),
    access_token: str = Body(..., description="Токен доступа преподавателя")
):
    # Только преподаватели и админы могут списывать занятия
    await get_current_user_with_role(access_token, UserType.TEACHER)
    
    user = await get_by_tg_username(tg_username)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    if user.user_type != UserType.STUDENT:
        raise HTTPException(status_code=400, detail="Занятие можно списать только у студента")
    
    if not user.use_lesson():
        raise HTTPException(
            status_code=400, 
            detail="Невозможно списать занятие. Проверьте статус абонемента и количество оставшихся занятий"
        )
    
    await user.save()
    
    return MessageResponse(
        message=f"Занятие успешно списано у {user.full_name}. Осталось занятий: {user.lessons_remaining}",
        success=True
    )

@router.post("/check-validity", response_model=dict, summary="Проверить действительность абонемента")
async def check_subscription_validity(
    tg_username: str = Body(..., description="Telegram username студента"),
    access_token: str = Body(..., description="Токен доступа")
):
    current_user = await get_current_user_with_role(access_token, UserType.STUDENT)
    
    # Студенты могут проверять только свой абонемент
    if current_user.user_type == UserType.STUDENT and current_user.tg_username != tg_username:
        raise HTTPException(status_code=403, detail="Недостаточно прав")
    
    user = await get_by_tg_username(tg_username)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    return {
        "tg_username": tg_username,
        "is_valid": user.has_valid_subscription(),
        "lessons_remaining": user.lessons_remaining,
        "status": user.subscription_status
    }
