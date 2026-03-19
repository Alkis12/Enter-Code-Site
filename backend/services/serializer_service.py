from datetime import datetime
from typing import List, Optional

from models.achievement import Achievement
from models.attendance import AttendanceSession
from models.course import Course
from models.course_request import CourseRequest
from models.group import Group
from models.news_article import NewsArticle
from models.task import Task, TaskStatus, TaskSubmission
from models.topic import Topic
from models.user import User, UserType
from schemas.responses import (
    AchievementResponse,
    AchievementNoticeResponse,
    CourseMemberResponse,
    CourseOptionResponse,
    CourseResponse,
    DashboardPendingReviewResponse,
    GroupOptionResponse,
    GroupResponse,
    LinkedParentResponse,
    LeaderboardEntryResponse,
    NewsArticleResponse,
    PendingTaskReviewResponse,
    CourseRequestResponse,
    StudentAdminResponse,
    StudentCourseAttendanceResponse,
    StudentCourseProgressResponse,
    TaskResponse,
    TaskResultResponse,
    TaskSubmissionResponse,
    TaskTestCaseResponse,
    TaskTestRunResultResponse,
    TopicResponse,
    UserResponse,
)
from services.learning_service import (
    can_edit_course,
    get_course_students,
    get_course_teachers,
    get_groups_for_course,
    get_student_group_assignments,
)
from services.billing_service import build_course_finance_snapshot
from services.user_service import get_parents_for_student


WEEKDAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]


def serialize_user(user: User) -> UserResponse:
    return UserResponse(
        user_id=str(user.id),
        name=user.name,
        surname=user.surname,
        tg_username=user.tg_username,
        telegram_id=user.telegram_id,
        user_type=user.user_type,
        status=user.status,
        phone=user.phone,
        avatar_url=user.avatar_url,
        bio=user.bio,
        subscription_status=user.subscription_status if user.user_type == UserType.STUDENT else None,
        lessons_remaining=user.lessons_remaining if user.user_type == UserType.STUDENT else None,
        points=user.points,
    )


def build_schedule_summary(course: Course) -> str:
    if not course.schedule_weekdays or not course.schedule_start_time:
        return ""

    labels = [
        WEEKDAY_LABELS[item]
        for item in sorted(set(course.schedule_weekdays))
        if 0 <= item < len(WEEKDAY_LABELS)
    ]
    if not labels:
        return ""

    summary = " ".join(labels)
    if course.schedule_end_time:
        return f"{summary} {course.schedule_start_time}-{course.schedule_end_time}"
    return f"{summary} {course.schedule_start_time}"


def build_group_schedule_summary(group: Group) -> str:
    if not group.schedule_slots:
        return ""

    parts: List[str] = []
    for slot in sorted(group.schedule_slots, key=lambda item: (item.weekday, item.start_time, item.end_time or "")):
        if slot.weekday < 0 or slot.weekday >= len(WEEKDAY_LABELS):
            continue
        label = WEEKDAY_LABELS[slot.weekday]
        if slot.end_time:
            parts.append(f"{label} {slot.start_time}-{slot.end_time}")
        else:
            parts.append(f"{label} {slot.start_time}")
    return " · ".join(parts)


async def build_group_leaderboard(course: Course, group: Group) -> List[LeaderboardEntryResponse]:
    leaderboard: List[LeaderboardEntryResponse] = []
    for student_id in group.students:
        user = await User.get(student_id)
        if not user:
            continue
        leaderboard.append(
            LeaderboardEntryResponse(
                user_id=str(user.id),
                name=user.name,
                surname=user.surname,
                tg_username=user.tg_username,
                points=await course.get_user_points(str(user.id)),
                progress_percent=await course.get_user_success_percent(str(user.id)),
            )
        )
    leaderboard.sort(key=lambda item: (-item.points, item.surname, item.name))
    return leaderboard


async def serialize_group(group: Group, course: Optional[Course] = None) -> GroupResponse:
    current_topic_name = None
    if group.current_topic_id:
        topic = await Topic.get(group.current_topic_id)
        if topic:
            current_topic_name = topic.name
    return GroupResponse(
        id=str(group.id),
        course_id=group.course_id,
        name=group.name,
        students=group.students,
        teachers=group.teachers,
        schedule_slots=group.schedule_slots,
        schedule_summary=build_group_schedule_summary(group),
        current_topic_id=group.current_topic_id,
        current_topic_name=current_topic_name,
        leaderboard=await build_group_leaderboard(course, group) if course else [],
        total_students=len(group.students),
    )


async def serialize_course(course: Course, user: Optional[User] = None) -> CourseResponse:
    total_tasks = await course.get_total_tasks()
    total_students = len(await get_course_students(course))
    total_points = await course.get_total_points()
    earned_points = 0
    progress_percent = 0.0
    editable = False
    teacher_ids = await get_course_teachers(course)
    student_ids = await get_course_students(course)
    active_group_id = None
    active_group_name = None
    active_group_schedule_summary = ""
    finance = None
    if user and user.user_type == UserType.STUDENT:
        earned_points = await course.get_user_points(str(user.id))
        progress_percent = await course.get_user_success_percent(str(user.id))
    if user:
        editable = await can_edit_course(user, course)
        if user.user_type == UserType.STUDENT:
            assignments = await get_student_group_assignments(str(user.id))
            active_group = assignments.get(str(course.id))
            if active_group:
                active_group_id = str(active_group.id)
                active_group_name = active_group.name
                active_group_schedule_summary = build_group_schedule_summary(active_group)
                finance = await build_course_finance_snapshot(str(user.id), course, active_group)
    return CourseResponse(
        id=str(course.id),
        name=course.name,
        description=course.description,
        public_info=course.public_info,
        accent_color=course.accent_color,
        cover_image=course.cover_image,
        group_ids=course.group_ids,
        topic_ids=course.topic_ids,
        teacher_ids=teacher_ids,
        student_ids=student_ids,
        schedule_weekdays=course.schedule_weekdays,
        schedule_start_time=course.schedule_start_time,
        schedule_end_time=course.schedule_end_time,
        schedule_summary=active_group_schedule_summary or build_schedule_summary(course),
        active_group_id=active_group_id,
        active_group_name=active_group_name,
        active_group_schedule_summary=active_group_schedule_summary,
        total_tasks=total_tasks,
        total_students=total_students,
        total_points=total_points,
        progress_percent=progress_percent,
        earned_points=earned_points,
        can_edit=editable,
        finance=finance,
    )


async def serialize_topic(
    topic: Topic,
    user: Optional[User] = None,
    can_edit: bool = False,
    can_access: Optional[bool] = None,
) -> TopicResponse:
    total_tasks = await topic.get_total_tasks()
    total_points = await topic.get_total_points()
    earned_points = 0
    progress_percent = 0.0
    if user:
        earned_points = await topic.get_user_points(str(user.id))
        progress_percent = await topic.get_user_success_percent(str(user.id))
    access_allowed = can_edit if can_access is None else can_access
    return TopicResponse(
        id=str(topic.id),
        course_id=topic.course_id,
        name=topic.name,
        description=topic.description,
        content=topic.content,
        resources=topic.resources,
        task_ids=topic.task_ids,
        total_tasks=total_tasks,
        total_points=total_points,
        progress_percent=progress_percent,
        earned_points=earned_points,
        order=topic.order,
        is_open=topic.is_open,
        can_access=access_allowed,
        can_edit=can_edit,
    )


def serialize_submission(submission: Optional[TaskSubmission]) -> Optional[TaskSubmissionResponse]:
    if not submission:
        return None

    return TaskSubmissionResponse(
        code=submission.code,
        passed=submission.passed,
        passed_tests=submission.passed_tests,
        total_tests=submission.total_tests,
        stdout=submission.stdout,
        stderr=submission.stderr,
        test_results=[
            TaskTestRunResultResponse(
                input_data=item.input_data,
                expected_output=item.expected_output,
                actual_output=item.actual_output,
                stderr=item.stderr,
                passed=item.passed,
            )
            for item in submission.test_results
        ],
        waiting_manual_review=submission.waiting_manual_review,
        review_comment=submission.review_comment,
        created_at=submission.created_at,
    )


async def build_pending_task_reviews(task: Task) -> List[PendingTaskReviewResponse]:
    pending_reviews: List[PendingTaskReviewResponse] = []
    for result in task.results:
        if result.status != TaskStatus.PENDING_REVIEW or not result.last_submission:
            continue
        student = await User.get(result.user_id)
        if not student:
            continue
        pending_reviews.append(
            PendingTaskReviewResponse(
                user_id=str(student.id),
                name=student.name,
                surname=student.surname,
                tg_username=student.tg_username,
                attempts=result.attempts,
                review_comment=result.review_comment,
                last_submission=serialize_submission(result.last_submission),
            )
        )
    pending_reviews.sort(
        key=lambda item: item.last_submission.created_at if item.last_submission else datetime.min,
        reverse=True,
    )
    return pending_reviews


async def serialize_task(task: Task, user: Optional[User] = None, can_edit: bool = False) -> TaskResponse:
    result = None
    if user:
        model_result = task.get_result_for_student(str(user.id))
        if model_result:
            submission_history = []
            for item in reversed(model_result.submission_history):
                serialized_submission = serialize_submission(item)
                if serialized_submission is not None:
                    submission_history.append(serialized_submission)
            result = TaskResultResponse(
                user_id=model_result.user_id,
                score=model_result.score,
                status=model_result.status,
                attempts=model_result.attempts,
                solved_at=model_result.solved_at,
                reviewed_at=model_result.reviewed_at,
                review_comment=model_result.review_comment,
                last_submission=serialize_submission(model_result.last_submission),
                submission_history=submission_history,
            )

    tests = None
    pending_reviews: List[PendingTaskReviewResponse] = []
    if can_edit:
        tests = [
            TaskTestCaseResponse(
                input_data=test.input_data,
                expected_output=test.expected_output,
            )
            for test in task.tests
        ]
        pending_reviews = await build_pending_task_reviews(task)

    return TaskResponse(
        id=str(task.id),
        topic_id=task.topic_id,
        title=task.title,
        condition=task.condition,
        attachments=task.attachments,
        points=task.points,
        starter_code=task.starter_code,
        language=task.language,
        requires_manual_review=task.requires_manual_review,
        tests=tests,
        order=task.order,
        result=result,
        pending_reviews=pending_reviews,
    )


def serialize_achievement(
    achievement: Achievement,
    user: User,
    editable: bool = False,
) -> AchievementResponse:
    unlocked = next(
        (item for item in user.unlocked_achievements if item.achievement_id == str(achievement.id)),
        None,
    )
    if unlocked:
        state = "unlocked"
        unlocked_at = unlocked.unlocked_at
    elif achievement.is_hidden:
        state = "hidden"
        unlocked_at = None
    else:
        state = "locked"
        unlocked_at = None
    return AchievementResponse(
        id=str(achievement.id),
        key=achievement.key,
        title=achievement.title,
        description=achievement.description,
        avatar_url=achievement.avatar_url,
        trigger=achievement.trigger,
        course_id=achievement.course_id,
        state=state,
        unlocked_at=unlocked_at,
        editable=editable,
    )


def serialize_achievement_notice(achievement: Achievement) -> AchievementNoticeResponse:
    return AchievementNoticeResponse(
        id=str(achievement.id),
        title=achievement.title,
        description=achievement.description,
        avatar_url=achievement.avatar_url,
        course_id=achievement.course_id,
    )


async def build_leaderboard(course: Course) -> List[LeaderboardEntryResponse]:
    leaderboard: List[LeaderboardEntryResponse] = []
    student_ids = await get_course_students(course)
    for student_id in student_ids:
        user = await User.get(student_id)
        if not user:
            continue
        leaderboard.append(
            LeaderboardEntryResponse(
                user_id=str(user.id),
                name=user.name,
                surname=user.surname,
                tg_username=user.tg_username,
                points=await course.get_user_points(str(user.id)),
                progress_percent=await course.get_user_success_percent(str(user.id)),
            )
        )
    leaderboard.sort(key=lambda item: (-item.points, item.surname, item.name))
    return leaderboard


async def build_dashboard_pending_reviews(
    user: User,
    courses: List[Course],
) -> List[DashboardPendingReviewResponse]:
    if user.user_type not in {UserType.TEACHER, UserType.ADMIN}:
        return []

    pending_reviews: List[DashboardPendingReviewResponse] = []
    for course in courses:
        if not await can_edit_course(user, course):
            continue

        topics = await Topic.find(Topic.course_id == str(course.id)).to_list()
        for topic in topics:
            tasks = await Task.find(Task.topic_id == str(topic.id)).to_list()
            for task in tasks:
                for result in task.results:
                    if result.status != TaskStatus.PENDING_REVIEW or not result.last_submission:
                        continue
                    student = await User.get(result.user_id)
                    if not student:
                        continue
                    pending_reviews.append(
                        DashboardPendingReviewResponse(
                            course_id=str(course.id),
                            course_name=course.name,
                            lesson_id=str(topic.id),
                            lesson_name=topic.name,
                            task_id=str(task.id),
                            task_title=task.title,
                            student_user_id=str(student.id),
                            student_name=student.name,
                            student_surname=student.surname,
                            student_tg_username=student.tg_username,
                            attempts=result.attempts,
                            review_comment=result.review_comment,
                            last_submission=serialize_submission(result.last_submission),
                        )
                    )

    pending_reviews.sort(
        key=lambda item: item.last_submission.created_at if item.last_submission else datetime.min,
        reverse=True,
    )
    return pending_reviews


async def serialize_course_option(course: Course) -> CourseOptionResponse:
    groups = await get_groups_for_course(course)
    return CourseOptionResponse(
        id=str(course.id),
        name=course.name,
        groups=[
            GroupOptionResponse(
                id=str(group.id),
                name=group.name,
            )
            for group in groups
        ],
    )


def serialize_course_member(user: User) -> CourseMemberResponse:
    return CourseMemberResponse(
        user_id=str(user.id),
        name=user.name,
        surname=user.surname,
        tg_username=user.tg_username,
        avatar_url=user.avatar_url,
    )


def serialize_linked_parent(user: User) -> LinkedParentResponse:
    return LinkedParentResponse(
        user_id=str(user.id),
        name=user.name,
        surname=user.surname,
        tg_username=user.tg_username,
        telegram_id=user.telegram_id,
        phone=user.phone,
    )


async def build_student_course_attendance_snapshot(
    student_id: str,
    course_id: str,
    group: Optional[Group],
) -> StudentCourseAttendanceResponse:
    if not group:
        return StudentCourseAttendanceResponse()

    sessions = await AttendanceSession.find(
        AttendanceSession.course_id == course_id,
        AttendanceSession.group_id == str(group.id),
        AttendanceSession.is_cancelled == False,
    ).to_list()

    total_sessions = 0
    attended_sessions = 0
    paid_sessions = 0
    for session in sessions:
        entry = next((item for item in session.entries if item.student_id == student_id), None)
        if not entry:
            continue
        total_sessions += 1
        if entry.present:
            attended_sessions += 1
        if entry.paid:
            paid_sessions += 1

    attendance_percent = round(attended_sessions / total_sessions * 100, 2) if total_sessions else 0.0
    return StudentCourseAttendanceResponse(
        total_sessions=total_sessions,
        attended_sessions=attended_sessions,
        paid_sessions=paid_sessions,
        attendance_percent=attendance_percent,
    )


async def serialize_student_admin(student: User, courses: List[Course]) -> StudentAdminResponse:
    course_progress: List[StudentCourseProgressResponse] = []
    total_points = 0
    earned_points = 0
    assignments = await get_student_group_assignments(str(student.id))
    course_group_ids = {course_id: str(group.id) for course_id, group in assignments.items()}
    course_group_names = {course_id: group.name for course_id, group in assignments.items()}
    parents = await get_parents_for_student(str(student.id))

    for course in courses:
        course_id = str(course.id)
        course_total_points = await course.get_total_points()
        course_earned_points = await course.get_user_points(str(student.id))
        total_points += course_total_points
        earned_points += course_earned_points
        course_progress.append(
            StudentCourseProgressResponse(
                course_id=course_id,
                course_name=course.name,
                group_id=course_group_ids.get(course_id),
                group_name=course_group_names.get(course_id),
                earned_points=course_earned_points,
                total_points=course_total_points,
                progress_percent=round(course_earned_points / course_total_points * 100, 2)
                if course_total_points
                else 0.0,
                finance=await build_course_finance_snapshot(
                    str(student.id),
                    course,
                    assignments.get(course_id),
                ),
                attendance=await build_student_course_attendance_snapshot(
                    str(student.id),
                    course_id,
                    assignments.get(course_id),
                ),
            )
        )

    progress_percent = round(earned_points / total_points * 100, 2) if total_points else 0.0

    return StudentAdminResponse(
        user_id=str(student.id),
        name=student.name,
        surname=student.surname,
        tg_username=student.tg_username,
        telegram_id=student.telegram_id,
        phone=student.phone,
        status=student.status,
        points=student.points,
        course_ids=[str(course.id) for course in courses],
        course_group_ids=course_group_ids,
        course_group_names=course_group_names,
        course_names=[course.name for course in courses],
        total_points=total_points,
        progress_percent=progress_percent,
        course_progress=course_progress,
        parents=[serialize_linked_parent(parent) for parent in parents],
    )


def serialize_course_request(item: CourseRequest) -> CourseRequestResponse:
    return CourseRequestResponse(
        id=str(item.id),
        course_id=item.course_id,
        course_name=item.course_name,
        contact_name=item.contact_name,
        contact_value=item.contact_value,
        comment=item.comment,
        created_at=item.created_at,
    )


def serialize_news_article(
    article: NewsArticle,
    editable: bool = False,
) -> NewsArticleResponse:
    return NewsArticleResponse(
        id=str(article.id),
        slug=article.slug,
        title=article.title,
        intro=article.intro,
        preview=article.preview,
        body=article.body,
        is_published=article.is_published,
        created_at=article.created_at,
        updated_at=article.updated_at,
        editable=editable,
    )
