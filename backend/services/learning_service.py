from typing import Dict, List, Optional, Set

from models.course import Course
from models.group import Group
from models.student_course_enrollment import StudentCourseEnrollment
from models.user import User, UserType
from services.billing_service import get_or_create_enrollment


async def get_groups_for_course(course: Course) -> List[Group]:
    if course.group_ids:
        groups: List[Group] = []
        for group_id in course.group_ids:
            group = await Group.get(group_id)
            if group:
                groups.append(group)
    else:
        groups = await Group.find(Group.course_id == str(course.id)).to_list()
    groups.sort(key=lambda item: (item.name or "").lower())
    return groups


async def get_course_students(course: Course) -> List[str]:
    student_ids: Set[str] = set(course.student_ids)
    for group in await get_groups_for_course(course):
        student_ids.update(group.students)
    return list(student_ids)


async def get_course_teachers(course: Course) -> List[str]:
    teacher_ids: Set[str] = set(course.teacher_ids)
    for group in await get_groups_for_course(course):
        teacher_ids.update(group.teachers)
    return list(teacher_ids)


async def get_courses_for_user(user: User) -> List[Course]:
    if user.user_type == UserType.ADMIN:
        return await Course.find_all().to_list()

    direct_query = {"$or": [{"student_ids": str(user.id)}, {"teacher_ids": str(user.id)}]}
    direct_courses = await Course.find(direct_query).to_list()
    group_courses = await Group.find({"$or": [{"students": str(user.id)}, {"teachers": str(user.id)}]}).to_list()
    group_course_ids = {group.course_id for group in group_courses}
    merged = {str(course.id): course for course in direct_courses}
    if group_course_ids:
        for course_id in group_course_ids:
            course = await Course.get(course_id)
            if course:
                merged[str(course.id)] = course
    return list(merged.values())


async def can_edit_course(user: User, course: Course) -> bool:
    if user.user_type == UserType.ADMIN:
        return True
    if user.user_type != UserType.TEACHER:
        return False
    teacher_ids = await get_course_teachers(course)
    return str(user.id) in teacher_ids or str(user.id) in course.teacher_ids


async def get_student_group_assignments(student_id: str) -> Dict[str, Group]:
    groups = await Group.find({"students": student_id}).to_list()
    assignments: Dict[str, Group] = {}
    for group in groups:
        assignments[group.course_id] = group
    return assignments


async def get_student_group_for_course(student_id: str, course_id: str) -> Optional[Group]:
    assignments = await get_student_group_assignments(student_id)
    return assignments.get(course_id)


def get_group_visible_topic_order(group: Optional[Group], ordered_topics: List[object]) -> int:
    if not ordered_topics:
        return -1
    if not group or not getattr(group, "current_topic_id", None):
        return ordered_topics[0].order

    for topic in ordered_topics:
        if str(topic.id) == str(group.current_topic_id):
            return topic.order
    return ordered_topics[0].order


async def sync_student_course_memberships(
    student_id: str,
    course_ids: List[str],
    course_group_ids: Optional[Dict[str, str]] = None,
) -> None:
    target_ids = set(course_ids)
    normalized_group_ids = {
        str(course_id): str(group_id)
        for course_id, group_id in (course_group_ids or {}).items()
        if str(course_id) in target_ids and group_id
    }
    courses = await Course.find_all().to_list()
    active_course_ids: Set[str] = set()
    for course in courses:
        course_id = str(course.id)
        has_member = student_id in course.student_ids
        should_have = course_id in target_ids
        if should_have and not has_member:
            course.student_ids.append(student_id)
            course.touch()
            await course.save()
        if not should_have and has_member:
            course.student_ids = [item for item in course.student_ids if item != student_id]
            course.touch()
            await course.save()

        course_groups = await get_groups_for_course(course)
        target_group_id = normalized_group_ids.get(course_id)
        if should_have:
            active_course_ids.add(course_id)
            await get_or_create_enrollment(
                student_id,
                course_id,
                group_id=target_group_id,
            )
        for group in course_groups:
            changed = False
            group_id = str(group.id)
            should_be_in_group = should_have and target_group_id == group_id
            if should_be_in_group and student_id not in group.students:
                group.students.append(student_id)
                changed = True
            if not should_be_in_group and student_id in group.students:
                group.students = [item for item in group.students if item != student_id]
                changed = True
            if changed:
                await group.save()

    stale_enrollments = await StudentCourseEnrollment.find(
        StudentCourseEnrollment.student_id == student_id,
    ).to_list()
    for enrollment in stale_enrollments:
        if enrollment.course_id in active_course_ids:
            continue
        await enrollment.delete()
