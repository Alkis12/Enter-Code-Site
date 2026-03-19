from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query

from models.attendance import AttendanceEntry, AttendanceSession
from models.course import Course
from models.group import Group
from models.student_course_enrollment import PaymentMode
from models.user import User, UserType
from schemas.requests import (
    AddLessonPrepaymentRequest,
    AddSubscriptionPaymentRequest,
    SaveAttendanceSessionRequest,
    UpdateStudentCoursePaymentModeRequest,
)
from schemas.responses import AttendanceSessionResponse, MessageResponse
from services.auth_service import get_current_user_dependency
from services.billing_service import (
    apply_prepayment,
    get_group_enrollments,
    get_or_create_enrollment,
    list_group_sessions,
    mark_month_paid,
    parse_date,
)
from services.learning_service import can_edit_course, get_student_group_for_course


router = APIRouter(prefix="/teaching", tags=["Teaching"])


async def get_manageable_group(group_id: str, user: User) -> tuple[Group, Course]:
    if user.user_type not in {UserType.TEACHER, UserType.ADMIN}:
        raise HTTPException(status_code=403, detail="Недостаточно прав")

    group = await Group.get(group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Группа не найдена")

    course = await Course.get(group.course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Курс не найден")

    if not await can_edit_course(user, course):
        raise HTTPException(status_code=403, detail="Недостаточно прав")

    return group, course


async def get_manageable_student_course(
    student_id: str,
    course_id: str,
    user: User,
) -> tuple[User, Course, Group | None]:
    if user.user_type not in {UserType.TEACHER, UserType.ADMIN}:
        raise HTTPException(status_code=403, detail="Недостаточно прав")

    student = await User.get(student_id)
    if not student or student.user_type != UserType.STUDENT:
        raise HTTPException(status_code=404, detail="Ученик не найден")

    course = await Course.get(course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Курс не найден")

    if not await can_edit_course(user, course):
        raise HTTPException(status_code=403, detail="Недостаточно прав")

    group = await get_student_group_for_course(student_id, course_id)
    return student, course, group


def serialize_attendance_session(
    session: AttendanceSession | None,
    course_id: str,
    group_id: str,
    date: str,
) -> AttendanceSessionResponse:
    if not session:
        return AttendanceSessionResponse(
            course_id=course_id,
            group_id=group_id,
            date=date,
            original_date=None,
            start_time=None,
            end_time=None,
            is_cancelled=False,
            entries=[],
            comment="",
            updated_at=datetime.utcnow(),
        )

    return AttendanceSessionResponse(
        course_id=session.course_id,
        group_id=session.group_id,
        date=session.date,
        original_date=session.original_date,
        start_time=session.start_time,
        end_time=session.end_time,
        is_cancelled=session.is_cancelled,
        entries=session.entries,
        comment=session.comment,
        updated_at=session.updated_at,
    )


def find_slot_times(group: Group, date: str) -> tuple[str | None, str | None]:
    try:
        weekday = parse_date(date).weekday()
    except ValueError:
        return None, None

    matching_slots = [slot for slot in group.schedule_slots if slot.weekday == weekday]
    if not matching_slots:
        return None, None
    matching_slots.sort(key=lambda item: (item.start_time, item.end_time or ""))
    slot = matching_slots[0]
    return slot.start_time, slot.end_time


@router.get("/attendance/{group_id}", response_model=AttendanceSessionResponse)
async def get_attendance_session(
    group_id: str,
    date: str = Query(..., pattern=r"^\d{4}-\d{2}-\d{2}$"),
    user: User = Depends(get_current_user_dependency),
):
    group, course = await get_manageable_group(group_id, user)
    sessions = await list_group_sessions(course, group, date_from=date, date_to=date)
    session = next((item for item in sessions if item.date == date), None)
    return serialize_attendance_session(session, str(course.id), group_id, date)


@router.get("/sessions/{group_id}", response_model=list[AttendanceSessionResponse])
async def list_teaching_sessions(
    group_id: str,
    date_from: str | None = Query(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    date_to: str | None = Query(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    user: User = Depends(get_current_user_dependency),
):
    group, course = await get_manageable_group(group_id, user)
    sessions = await list_group_sessions(course, group, date_from=date_from, date_to=date_to)
    return [
        serialize_attendance_session(session, str(course.id), group_id, session.date)
        for session in sessions
    ]


@router.put("/attendance/{group_id}", response_model=AttendanceSessionResponse)
async def save_attendance_session(
    group_id: str,
    payload: SaveAttendanceSessionRequest,
    date: str = Query(..., pattern=r"^\d{4}-\d{2}-\d{2}$"),
    user: User = Depends(get_current_user_dependency),
):
    group, course = await get_manageable_group(group_id, user)
    enrollments = await get_group_enrollments(str(course.id), group_id, group.students)

    session = await AttendanceSession.find_one(
        AttendanceSession.group_id == group_id,
        AttendanceSession.date == date,
    )
    target_date = payload.date or date
    if target_date != date or (session and target_date != session.date):
        conflict = await AttendanceSession.find_one(
            AttendanceSession.group_id == group_id,
            AttendanceSession.date == target_date,
        )
        if conflict and (not session or str(conflict.id) != str(session.id)):
            raise HTTPException(status_code=400, detail="На выбранную дату уже есть занятие")

    normalized_entries = []
    seen_student_ids = set()
    target_date_obj = parse_date(target_date)
    valid_student_ids = set(group.students)
    if session:
        valid_student_ids.update(entry.student_id for entry in session.entries)

    for entry in payload.entries:
        if entry.student_id not in valid_student_ids or entry.student_id in seen_student_ids:
            continue
        enrollment = enrollments.get(entry.student_id) or await get_or_create_enrollment(
            entry.student_id,
            str(course.id),
            group_id=group_id,
        )
        if parse_date(enrollment.enrolled_on) > target_date_obj:
            continue
        seen_student_ids.add(entry.student_id)
        normalized_entries.append(
            AttendanceEntry(
                student_id=entry.student_id,
                present=entry.present,
                paid=entry.paid if enrollment.payment_mode == PaymentMode.PER_LESSON else False,
                note=entry.note,
            )
        )

    default_start_time, default_end_time = find_slot_times(group, date)

    if not session:
        session = AttendanceSession(
            course_id=str(course.id),
            group_id=group_id,
            date=target_date,
            original_date=date if target_date != date else None,
            start_time=payload.start_time or default_start_time,
            end_time=payload.end_time or default_end_time,
            entries=normalized_entries,
            comment=payload.comment,
            is_cancelled=payload.is_cancelled,
            created_by=str(user.id),
        )
        await session.insert()
    else:
        if target_date != session.date and not session.original_date:
            session.original_date = session.date
        session.date = target_date
        session.start_time = payload.start_time or session.start_time or default_start_time
        session.end_time = payload.end_time or session.end_time or default_end_time
        session.entries = normalized_entries
        session.comment = payload.comment
        session.is_cancelled = payload.is_cancelled
        session.touch()
        await session.save()

    return serialize_attendance_session(session, str(course.id), group_id, session.date)


@router.put("/students/{student_id}/courses/{course_id}/payment-mode", response_model=MessageResponse)
async def update_student_payment_mode(
    student_id: str,
    course_id: str,
    payload: UpdateStudentCoursePaymentModeRequest,
    user: User = Depends(get_current_user_dependency),
):
    _, course, group = await get_manageable_student_course(student_id, course_id, user)
    enrollment = await get_or_create_enrollment(
        student_id,
        course_id,
        group_id=str(group.id) if group else None,
    )
    enrollment.payment_mode = payload.payment_mode
    enrollment.touch()
    await enrollment.save()
    return MessageResponse(message="Тип оплаты обновлен")


@router.post("/students/{student_id}/courses/{course_id}/subscription-payments", response_model=MessageResponse)
async def add_subscription_payment(
    student_id: str,
    course_id: str,
    payload: AddSubscriptionPaymentRequest,
    user: User = Depends(get_current_user_dependency),
):
    _, _, group = await get_manageable_student_course(student_id, course_id, user)
    enrollment = await get_or_create_enrollment(
        student_id,
        course_id,
        group_id=str(group.id) if group else None,
    )
    await mark_month_paid(enrollment, payload.month, payload.note)
    return MessageResponse(message="Оплата по абонементу сохранена")


@router.post("/students/{student_id}/courses/{course_id}/prepayments", response_model=MessageResponse)
async def add_lesson_prepayment(
    student_id: str,
    course_id: str,
    payload: AddLessonPrepaymentRequest,
    user: User = Depends(get_current_user_dependency),
):
    _, course, group = await get_manageable_student_course(student_id, course_id, user)
    if not group:
        raise HTTPException(status_code=400, detail="Ученик пока не назначен в группу")

    enrollment = await get_or_create_enrollment(
        student_id,
        course_id,
        group_id=str(group.id),
    )
    applied = await apply_prepayment(enrollment, course, group, payload.lessons_count, payload.note)
    if applied <= 0:
        raise HTTPException(status_code=400, detail="Не удалось применить предоплату к будущим занятиям")
    return MessageResponse(message=f"Предоплата отмечена на {applied} занятий")
