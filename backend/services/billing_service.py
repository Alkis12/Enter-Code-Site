from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Dict, Iterable, List

from models.attendance import AttendanceEntry, AttendanceSession
from models.course import Course
from models.group import Group, GroupScheduleSlot
from models.student_course_enrollment import (
    MonthlyPaymentRecord,
    PaymentMode,
    PrepaymentRecord,
    StudentCourseEnrollment,
)
from models.user import User


MONTH_LABELS = [
    "январь",
    "февраль",
    "март",
    "апрель",
    "май",
    "июнь",
    "июль",
    "август",
    "сентябрь",
    "октябрь",
    "ноябрь",
    "декабрь",
]


def utc_today() -> date:
    return datetime.utcnow().date()


def parse_date(value: str) -> date:
    return datetime.strptime(value, "%Y-%m-%d").date()


def format_date(value: date) -> str:
    return value.isoformat()


def parse_month(value: str) -> tuple[int, int]:
    year, month = value.split("-")
    return int(year), int(month)


def month_to_label(value: str) -> str:
    year, month = parse_month(value)
    return f"{MONTH_LABELS[month - 1].capitalize()} {year}"


def month_range(start_month: str, end_month: str) -> List[str]:
    year, month = parse_month(start_month)
    end_year, end_month_num = parse_month(end_month)
    result: List[str] = []
    while (year, month) <= (end_year, end_month_num):
        result.append(f"{year:04d}-{month:02d}")
        month += 1
        if month > 12:
            month = 1
            year += 1
    return result


async def get_or_create_enrollment(
    student_id: str,
    course_id: str,
    *,
    group_id: str | None = None,
    enrolled_on: str | None = None,
) -> StudentCourseEnrollment:
    enrollment = await StudentCourseEnrollment.find_one(
        StudentCourseEnrollment.student_id == student_id,
        StudentCourseEnrollment.course_id == course_id,
    )
    if enrollment:
        updated = False
        if group_id != enrollment.group_id:
            enrollment.group_id = group_id
            updated = True
        if updated:
            enrollment.touch()
            await enrollment.save()
        return enrollment

    if not enrolled_on:
        student = await User.get(student_id)
        enrolled_on = format_date((student.created_at if student else datetime.utcnow()).date())

    enrollment = StudentCourseEnrollment(
        student_id=student_id,
        course_id=course_id,
        group_id=group_id,
        enrolled_on=enrolled_on,
    )
    await enrollment.insert()
    return enrollment


async def get_enrollment(student_id: str, course_id: str) -> StudentCourseEnrollment | None:
    return await StudentCourseEnrollment.find_one(
        StudentCourseEnrollment.student_id == student_id,
        StudentCourseEnrollment.course_id == course_id,
    )


async def get_group_enrollments(course_id: str, group_id: str, student_ids: Iterable[str]) -> Dict[str, StudentCourseEnrollment]:
    student_id_list = [str(item) for item in student_ids]
    if not student_id_list:
        return {}

    existing = await StudentCourseEnrollment.find(
        {
            "course_id": course_id,
            "student_id": {"$in": student_id_list},
        }
    ).to_list()
    enrollment_map = {item.student_id: item for item in existing}

    for student_id in student_id_list:
        enrollment = enrollment_map.get(student_id)
        if enrollment is None:
            enrollment = await get_or_create_enrollment(
                student_id,
                course_id,
                group_id=group_id,
            )
            enrollment_map[student_id] = enrollment
        elif enrollment.group_id != group_id:
            enrollment.group_id = group_id
            enrollment.touch()
            await enrollment.save()

    return enrollment_map


def iter_group_occurrences(
    group: Group,
    date_from: date,
    date_to: date,
) -> List[tuple[str, GroupScheduleSlot]]:
    occurrences: List[tuple[str, GroupScheduleSlot]] = []
    if date_from > date_to:
        return occurrences

    for slot in group.schedule_slots:
        days_ahead = (slot.weekday - date_from.weekday()) % 7
        current = date_from + timedelta(days=days_ahead)
        while current <= date_to:
            occurrences.append((format_date(current), slot))
            current += timedelta(days=7)

    occurrences.sort(key=lambda item: (item[0], item[1].start_time, item[1].end_time or ""))
    return occurrences


async def list_group_sessions(
    course: Course,
    group: Group,
    *,
    date_from: str | None = None,
    date_to: str | None = None,
) -> List[AttendanceSession]:
    today = utc_today()
    enrollments = await get_group_enrollments(str(course.id), str(group.id), group.students)
    enrollment_dates = [parse_date(item.enrolled_on) for item in enrollments.values()]
    range_start = parse_date(date_from) if date_from else (min(enrollment_dates) if enrollment_dates else today)
    range_end = parse_date(date_to) if date_to else today + timedelta(days=45)

    persisted = await AttendanceSession.find(AttendanceSession.group_id == str(group.id)).to_list()
    persisted_map = {session.date: session for session in persisted if not session.is_cancelled}
    occupied_original_dates = {
        session.original_date or session.date
        for session in persisted
    }

    generated: List[AttendanceSession] = []
    for occurrence_date, slot in iter_group_occurrences(group, range_start, range_end):
        if occurrence_date in occupied_original_dates:
            continue

        entries: List[AttendanceEntry] = []
        for student_id, enrollment in enrollments.items():
            if parse_date(enrollment.enrolled_on) > parse_date(occurrence_date):
                continue
            entries.append(
                AttendanceEntry(
                    student_id=student_id,
                    present=False,
                    paid=False,
                    note="",
                )
            )

        generated.append(
            AttendanceSession(
                course_id=str(course.id),
                group_id=str(group.id),
                date=occurrence_date,
                original_date=None,
                start_time=slot.start_time,
                end_time=slot.end_time,
                entries=entries,
                comment="",
                created_by="system",
            )
        )

    sessions = [session for session in persisted if not session.is_cancelled] + generated
    sessions.sort(key=lambda item: (item.date, item.start_time or "", item.end_time or ""))
    return sessions


async def apply_prepayment(
    enrollment: StudentCourseEnrollment,
    course: Course,
    group: Group,
    lessons_count: int,
    note: str = "",
) -> int:
    if lessons_count <= 0:
        return 0

    sessions = await list_group_sessions(course, group)
    remaining = lessons_count
    for session in sessions:
        if parse_date(session.date) < utc_today():
            continue

        existing_entry = next((item for item in session.entries if item.student_id == enrollment.student_id), None)
        if existing_entry and existing_entry.paid:
            continue

        persisted = await AttendanceSession.find_one(
            AttendanceSession.group_id == str(group.id),
            AttendanceSession.date == session.date,
        )
        target = persisted or AttendanceSession(
            course_id=str(course.id),
            group_id=str(group.id),
            date=session.date,
            original_date=session.original_date,
            start_time=session.start_time,
            end_time=session.end_time,
            entries=session.entries,
            comment=session.comment,
            created_by="system",
        )

        updated_entries: List[AttendanceEntry] = []
        found = False
        for entry in target.entries:
            if entry.student_id == enrollment.student_id:
                updated_entries.append(
                    AttendanceEntry(
                        student_id=entry.student_id,
                        present=entry.present,
                        paid=True,
                        note=entry.note,
                    )
                )
                found = True
            else:
                updated_entries.append(entry)
        if not found:
            updated_entries.append(
                AttendanceEntry(
                    student_id=enrollment.student_id,
                    present=False,
                    paid=True,
                    note="",
                )
            )

        target.entries = updated_entries
        target.touch()
        if persisted:
            await target.save()
        else:
            await target.insert()

        remaining -= 1
        if remaining <= 0:
            break

    applied = lessons_count - remaining
    if applied > 0:
        enrollment.prepayment_history.append(
            PrepaymentRecord(
                lessons_count=applied,
                note=note,
            )
        )
        enrollment.touch()
        await enrollment.save()
    return applied


def build_monthly_payment(month: str, note: str = "") -> MonthlyPaymentRecord:
    return MonthlyPaymentRecord(
        month=month,
        label=month_to_label(month),
        note=note,
    )


async def mark_month_paid(enrollment: StudentCourseEnrollment, month: str, note: str = "") -> StudentCourseEnrollment:
    existing_index = next(
        (index for index, item in enumerate(enrollment.monthly_payments) if item.month == month),
        None,
    )
    payment = build_monthly_payment(month, note)
    if existing_index is None:
        enrollment.monthly_payments.append(payment)
    else:
        enrollment.monthly_payments[existing_index] = payment
    enrollment.monthly_payments.sort(key=lambda item: item.month, reverse=True)
    enrollment.touch()
    await enrollment.save()
    return enrollment


def build_payment_snapshot(
    enrollment: StudentCourseEnrollment,
    sessions: List[AttendanceSession],
    *,
    today: date | None = None,
) -> dict:
    current_day = today or utc_today()
    if enrollment.payment_mode == PaymentMode.SUBSCRIPTION:
        current_month = current_day.strftime("%Y-%m")
        start_month = enrollment.enrolled_on[:7]
        paid_months = {item.month for item in enrollment.monthly_payments}
        missing_months = [month for month in month_range(start_month, current_month) if month not in paid_months]
        debt_label = ""
        if len(missing_months) == 1:
            debt_label = f"Не оплачен {month_to_label(missing_months[0]).lower()}"
        elif missing_months:
            debt_label = f"Не оплачено месяцев: {len(missing_months)}"
        return {
            "payment_mode": enrollment.payment_mode,
            "debt_count": len(missing_months),
            "debt_label": debt_label,
            "monthly_payments": enrollment.monthly_payments,
            "unpaid_lessons_count": 0,
            "paid_lessons_ahead": 0,
        }

    unpaid_lessons_count = 0
    paid_lessons_ahead = 0
    enrollment_start = parse_date(enrollment.enrolled_on)
    for session in sessions:
        session_date = parse_date(session.date)
        if session_date < enrollment_start:
            continue
        entry = next((item for item in session.entries if item.student_id == enrollment.student_id), None)
        is_paid = bool(entry and entry.paid)
        if session_date <= current_day and not is_paid:
            unpaid_lessons_count += 1
        if session_date > current_day and is_paid:
            paid_lessons_ahead += 1

    debt_label = ""
    if unpaid_lessons_count == 1:
        debt_label = "Не оплачено 1 занятие"
    elif unpaid_lessons_count > 1:
        debt_label = f"Не оплачено занятий: {unpaid_lessons_count}"

    return {
        "payment_mode": enrollment.payment_mode,
        "debt_count": unpaid_lessons_count,
        "debt_label": debt_label,
        "monthly_payments": [],
        "unpaid_lessons_count": unpaid_lessons_count,
        "paid_lessons_ahead": paid_lessons_ahead,
    }


async def build_course_finance_snapshot(
    student_id: str,
    course: Course,
    group: Group | None,
) -> dict | None:
    enrollment = await get_or_create_enrollment(
        student_id,
        str(course.id),
        group_id=str(group.id) if group else None,
    )
    sessions = await list_group_sessions(course, group) if group else []
    snapshot = build_payment_snapshot(enrollment, sessions)
    snapshot["enrolled_on"] = enrollment.enrolled_on
    return snapshot
