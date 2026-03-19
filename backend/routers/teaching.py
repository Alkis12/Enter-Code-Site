from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query

from models.attendance import AttendanceEntry, AttendanceSession
from models.course import Course
from models.group import Group
from models.user import User, UserType
from schemas.requests import SaveAttendanceSessionRequest
from schemas.responses import AttendanceSessionResponse
from services.auth_service import get_current_user_dependency
from services.learning_service import can_edit_course


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
            entries=[],
            comment="",
            updated_at=datetime.utcnow(),
        )

    return AttendanceSessionResponse(
        course_id=session.course_id,
        group_id=session.group_id,
        date=session.date,
        entries=session.entries,
        comment=session.comment,
        updated_at=session.updated_at,
    )


@router.get("/attendance/{group_id}", response_model=AttendanceSessionResponse)
async def get_attendance_session(
    group_id: str,
    date: str = Query(..., pattern=r"^\d{4}-\d{2}-\d{2}$"),
    user: User = Depends(get_current_user_dependency),
):
    group, course = await get_manageable_group(group_id, user)
    session = await AttendanceSession.find_one(
        AttendanceSession.group_id == group_id,
        AttendanceSession.date == date,
    )
    return serialize_attendance_session(session, str(course.id), group_id, date)


@router.put("/attendance/{group_id}", response_model=AttendanceSessionResponse)
async def save_attendance_session(
    group_id: str,
    payload: SaveAttendanceSessionRequest,
    date: str = Query(..., pattern=r"^\d{4}-\d{2}-\d{2}$"),
    user: User = Depends(get_current_user_dependency),
):
    group, course = await get_manageable_group(group_id, user)
    valid_student_ids = set(group.students)
    normalized_entries = []
    seen_student_ids = set()

    for entry in payload.entries:
        if entry.student_id not in valid_student_ids or entry.student_id in seen_student_ids:
            continue
        seen_student_ids.add(entry.student_id)
        normalized_entries.append(
            AttendanceEntry(
                student_id=entry.student_id,
                present=entry.present,
                note=entry.note,
            )
        )

    session = await AttendanceSession.find_one(
        AttendanceSession.group_id == group_id,
        AttendanceSession.date == date,
    )

    if not session:
        session = AttendanceSession(
            course_id=str(course.id),
            group_id=group_id,
            date=date,
            entries=normalized_entries,
            comment=payload.comment,
            created_by=str(user.id),
        )
        await session.insert()
    else:
        session.entries = normalized_entries
        session.comment = payload.comment
        session.touch()
        await session.save()

    return serialize_attendance_session(session, str(course.id), group_id, date)
