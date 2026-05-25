import os
from datetime import date as date_type, datetime, timedelta
from pathlib import Path
from typing import List, Optional
from uuid import uuid4

from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from fastapi.security.utils import get_authorization_scheme_param

from models.course import Course
from models.event import Event, EventTag, ScheduleType
from models.group import Group
from models.user import User, UserType
from schemas.requests import CreateEventRequest, UpdateEventRequest
from schemas.responses import EventResponse, MessageResponse, ScheduledEventResponse
from services.auth_service import AuthService
from services.learning_service import can_edit_course, get_courses_for_user, get_groups_for_course
from services.serializer_service import build_group_schedule_summary
from services.user_service import get_linked_students_for_parent


router = APIRouter(prefix="/events", tags=["Events"])

uploads_dir = Path(os.getenv("UPLOADS_DIR", "uploads"))
event_uploads_dir = uploads_dir / "events"
event_uploads_dir.mkdir(parents=True, exist_ok=True)


def require_admin(request: Request) -> None:
    admin_key = os.getenv("ADMIN_KEY")
    if not admin_key:
        return
    header_key = request.headers.get("x-admin-key")
    if header_key != admin_key:
        raise HTTPException(status_code=403, detail="Admin access required")


def parse_date(value: Optional[str]) -> Optional[date_type]:
    if value in (None, ""):
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid date format") from exc


def validate_schedule(schedule_type: ScheduleType, date_value: Optional[date_type], weekday: Optional[int]) -> None:
    if schedule_type == ScheduleType.ONCE:
        if not date_value:
            raise HTTPException(status_code=400, detail="Date is required for one-off events")
        if weekday is not None:
            raise HTTPException(status_code=400, detail="Weekday is not allowed for one-off events")
    if schedule_type == ScheduleType.WEEKLY:
        if weekday is None:
            raise HTTPException(status_code=400, detail="Weekday is required for weekly events")
        if date_value is not None:
            raise HTTPException(status_code=400, detail="Date is not allowed for weekly events")


async def get_optional_user(request: Request) -> Optional[User]:
    authorization = request.headers.get("Authorization")
    if not authorization:
        return None

    scheme, token = get_authorization_scheme_param(authorization)
    if scheme.lower() != "bearer" or not token:
        return None

    try:
        return await AuthService().get_current_user(token)
    except Exception:
        return None


def to_event_response(event: Event) -> EventResponse:
    return EventResponse(
        id=str(event.id),
        title=event.title,
        description=event.description,
        source_type="event",
        schedule_type=event.schedule_type,
        date=event.date.isoformat() if event.date else None,
        weekday=event.weekday,
        start_time=event.start_time,
        end_time=event.end_time,
        image_url=event.image_url,
        button_color=event.button_color,
        card_color=event.card_color,
        text_color=event.text_color,
        tags=event.tags,
        is_active=event.is_active,
    )


def build_group_event_response(
    course: Course,
    group: Group,
    occurrence_date: date_type,
    user_course_ids: set[str],
    user_type: Optional[UserType],
    current_user_id: Optional[str],
    related_student_ids: set[str],
    slot_weekday: int,
    slot_start_time: str,
    slot_end_time: Optional[str],
) -> ScheduledEventResponse:
    has_access = user_type == UserType.ADMIN or (
        user_type in {UserType.STUDENT, UserType.TEACHER} and str(course.id) in user_course_ids
    )
    is_user_related = has_access
    if user_type == UserType.STUDENT:
        is_user_related = current_user_id in group.students
    if user_type == UserType.PARENT:
        is_user_related = bool(related_student_ids.intersection(group.students))

    target_url = f"/mycourses/{course.id}" if has_access else f"/courses/{course.id}"
    summary = build_group_schedule_summary(group)
    tags = [EventTag(label="Курс", color=course.accent_color)]
    tags.append(EventTag(label=group.name, color="#24324d"))
    if summary:
        tags.append(EventTag(label=summary, color="#24324d"))

    return ScheduledEventResponse(
        id=f"group-{group.id}-{slot_weekday}-{slot_start_time}",
        title=f"{course.name} · {group.name}",
        description=course.public_info or course.description,
        source_type="course_session",
        schedule_type=ScheduleType.WEEKLY,
        date=None,
        weekday=slot_weekday,
        start_time=slot_start_time,
        end_time=slot_end_time,
        image_url=course.cover_image or None,
        button_color=course.accent_color,
        card_color="#ffffff",
        text_color="#1f2a44",
        course_id=str(course.id),
        course_name=course.name,
        target_url=target_url,
        is_user_related=is_user_related,
        tags=tags,
        is_active=True,
        occurrence_date=occurrence_date.isoformat(),
    )


@router.get("/", response_model=List[EventResponse], summary="List all events")
async def list_events(request: Request) -> List[EventResponse]:
    require_admin(request)
    events = await Event.find_all().to_list()
    return [to_event_response(event) for event in events]


@router.get("/week", response_model=List[ScheduledEventResponse], summary="List events for the current week")
async def list_week_events(request: Request, date: Optional[str] = None) -> List[ScheduledEventResponse]:
    target_date = parse_date(date) or datetime.utcnow().date()
    week_start = target_date - timedelta(days=target_date.weekday())
    week_end = week_start + timedelta(days=6)

    current_user = await get_optional_user(request)
    user_course_ids: set[str] = set()
    user_type: Optional[UserType] = None
    current_user_id: Optional[str] = None
    related_student_ids: set[str] = set()
    if current_user:
        user_type = current_user.user_type
        current_user_id = str(current_user.id)
        user_course_ids = {str(item.id) for item in await get_courses_for_user(current_user)}
        if user_type == UserType.PARENT:
            linked_students = await get_linked_students_for_parent(current_user)
            related_student_ids = {str(student.id) for student in linked_students}
            for student in linked_students:
                user_course_ids.update(
                    str(item.id) for item in await get_courses_for_user(student)
                )

    scheduled: List[ScheduledEventResponse] = []

    events = await Event.find(Event.is_active == True).to_list()
    for event in events:
        if event.schedule_type == ScheduleType.ONCE:
            if not event.date:
                continue
            if not (week_start <= event.date <= week_end):
                continue
            occurrence_date = event.date
        else:
            if event.weekday is None:
                continue
            occurrence_date = week_start + timedelta(days=event.weekday)

        scheduled.append(
            ScheduledEventResponse(
                **to_event_response(event).model_dump(),
                occurrence_date=occurrence_date.isoformat(),
            )
        )

    courses = await Course.find_all().to_list()
    for course in courses:
        if current_user and user_type == UserType.TEACHER and not await can_edit_course(current_user, course):
            continue
        for group in await get_groups_for_course(course):
            if user_type == UserType.PARENT and not related_student_ids.intersection(group.students):
                continue
            for slot in group.schedule_slots:
                weekday = slot.weekday
                if weekday < 0 or weekday > 6:
                    continue
                occurrence_date = week_start + timedelta(days=weekday)
                if not (week_start <= occurrence_date <= week_end):
                    continue
                scheduled.append(
                    build_group_event_response(
                        course,
                        group,
                        occurrence_date,
                        user_course_ids,
                        user_type,
                        current_user_id,
                        related_student_ids,
                        weekday,
                        slot.start_time,
                        slot.end_time,
                    )
                )

    scheduled.sort(key=lambda item: (item.occurrence_date, item.start_time, item.title.lower()))
    return scheduled


@router.post("/", response_model=EventResponse, summary="Create event")
async def create_event(request: Request, payload: CreateEventRequest) -> EventResponse:
    require_admin(request)
    date_value = parse_date(payload.date)
    validate_schedule(payload.schedule_type, date_value, payload.weekday)

    event = Event(
        title=payload.title,
        description=payload.description,
        schedule_type=payload.schedule_type,
        date=date_value,
        weekday=payload.weekday,
        start_time=payload.start_time,
        end_time=payload.end_time,
        image_url=payload.image_url,
        button_color=payload.button_color,
        card_color=payload.card_color,
        text_color=payload.text_color,
        tags=payload.tags,
        is_active=payload.is_active,
    )
    await event.insert()
    return to_event_response(event)


@router.put("/{event_id}", response_model=EventResponse, summary="Update event")
async def update_event(request: Request, event_id: str, payload: UpdateEventRequest) -> EventResponse:
    require_admin(request)
    event = await Event.get(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    update_data = payload.model_dump(exclude_unset=True)
    if "date" in update_data:
        update_data["date"] = parse_date(update_data["date"])

    schedule_type = update_data.get("schedule_type", event.schedule_type)
    date_value = update_data.get("date", event.date)
    weekday = update_data.get("weekday", event.weekday)
    validate_schedule(schedule_type, date_value, weekday)

    for key, value in update_data.items():
        setattr(event, key, value)

    await event.save()
    return to_event_response(event)


@router.delete("/{event_id}", response_model=MessageResponse, summary="Delete event")
async def delete_event(request: Request, event_id: str) -> MessageResponse:
    require_admin(request)
    event = await Event.get(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    await event.delete()
    return MessageResponse(message="Event deleted", success=True)


@router.post("/upload", summary="Upload event image")
async def upload_event_image(request: Request, file: UploadFile = File(...)) -> dict:
    require_admin(request)
    ext = Path(file.filename).suffix.lower()
    if ext not in {".jpg", ".jpeg", ".png", ".webp", ".gif"}:
        raise HTTPException(status_code=400, detail="Unsupported file type")

    filename = f"{uuid4().hex}{ext}"
    target_path = event_uploads_dir / filename
    content = await file.read()
    target_path.write_bytes(content)
    await file.close()
    return {"url": f"/uploads/events/{filename}", "filename": filename}
