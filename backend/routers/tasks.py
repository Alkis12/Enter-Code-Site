from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException

from models.achievement import AchievementTrigger
from models.course import Course
from models.programming_language import (
    ProgrammingLanguage,
    get_programming_language_label,
    normalize_programming_language,
)
from models.task import Task, TaskStatus, TaskSubmission, TaskTestCase
from models.topic import Topic
from models.user import User, UserType
from schemas.requests import (
    CreateTaskRequest,
    RunTaskCodeRequest,
    ReviewTaskSubmissionRequest,
    SubmitTaskSolutionRequest,
    UpdateTaskRequest,
)
from schemas.responses import MessageResponse, TaskCodeRunResponse, TaskResponse
from services.achievement_service import unlock_achievements_for_trigger
from services.auth_service import get_current_user_dependency, require_role
from services.code_runner_service import (
    run_javascript_program,
    run_javascript_solution,
    run_python_program,
    run_python_solution,
)
from services.learning_service import (
    can_edit_course,
    get_courses_for_user,
    get_group_visible_topic_order,
    get_student_group_for_course,
)
from services.serializer_service import serialize_achievement_notice, serialize_task
from services.task_execution_service import run_code_with_queue, submit_code_with_queue


router = APIRouter(prefix="/task", tags=["Задачи"])


def lesson_is_available(topic: Topic, ordered_topics: list[Topic]) -> bool:
    if topic.is_open:
        return True
    if not ordered_topics:
        return True
    return str(ordered_topics[0].id) == str(topic.id)


def get_course_language(course: Course) -> str:
    return normalize_programming_language(getattr(course, "programming_language", "python")).value


def ensure_task_language_matches_course(requested_language: str | None, course: Course) -> str:
    course_language = get_course_language(course)
    if requested_language is None:
        return course_language

    normalized_requested = normalize_programming_language(requested_language).value
    if normalized_requested != course_language:
        raise HTTPException(
            status_code=400,
            detail=(
                "Этот курс закреплен за языком "
                f"{get_programming_language_label(course_language)}. "
                "Язык отдельной задачи менять нельзя."
            ),
        )
    return course_language


def run_solution_for_language(language: str, code: str, tests: list[TaskTestCase]):
    normalized_language = normalize_programming_language(language)
    if normalized_language == ProgrammingLanguage.JAVASCRIPT:
        return run_javascript_solution(code, tests)
    return run_python_solution(code, tests)


def run_program_for_language(language: str, code: str, input_data: str):
    normalized_language = normalize_programming_language(language)
    if normalized_language == ProgrammingLanguage.JAVASCRIPT:
        return run_javascript_program(code, input_data=input_data)
    return run_python_program(code, input_data=input_data)


async def ensure_topic_access(user: User, topic: Topic, editable: bool) -> None:
    if editable or user.user_type != UserType.STUDENT:
        return
    course_topics = await Topic.find(Topic.course_id == topic.course_id).to_list()
    course_topics.sort(key=lambda item: item.order)
    course = await Course.get(topic.course_id)
    student_group = await get_student_group_for_course(str(user.id), str(course.id)) if course else None
    visible_order = get_group_visible_topic_order(student_group, course_topics)
    if topic.order > visible_order:
        raise HTTPException(status_code=403, detail="Тема пока заблокирована")


async def get_task_course(task: Task) -> Course:
    topic = await Topic.get(task.topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Урок не найден")
    course = await Course.get(topic.course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Курс не найден")
    return course


@router.post("/add", response_model=MessageResponse)
async def add_task(
    payload: CreateTaskRequest,
    user: User = Depends(require_role(UserType.TEACHER)),
):
    topic = await Topic.get(payload.topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Урок не найден")
    course = await Course.get(topic.course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Курс не найден")
    if not await can_edit_course(user, course):
        raise HTTPException(status_code=403, detail="Нет прав на изменение урока")

    task = Task(
        topic_id=payload.topic_id,
        title=payload.title,
        condition=payload.condition,
        attachments=payload.attachments,
        points=payload.points,
        starter_code=payload.starter_code,
        language=ensure_task_language_matches_course(payload.language, course),
        requires_manual_review=payload.requires_manual_review,
        tests=[TaskTestCase(**item.model_dump()) for item in payload.tests],
        order=payload.order,
    )
    await task.insert()
    topic.task_ids.append(str(task.id))
    topic.touch()
    await topic.save()
    return MessageResponse(message=f"Задача '{task.title}' создана", success=True)


@router.put("/{task_id}", response_model=MessageResponse)
async def update_task(
    task_id: str,
    payload: UpdateTaskRequest,
    user: User = Depends(require_role(UserType.TEACHER)),
):
    task = await Task.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Задача не найдена")
    course = await get_task_course(task)
    if not await can_edit_course(user, course):
        raise HTTPException(status_code=403, detail="Нет прав на изменение задачи")

    for field in [
        "title",
        "condition",
        "attachments",
        "points",
        "starter_code",
        "requires_manual_review",
        "order",
    ]:
        value = getattr(payload, field)
        if value is not None:
            setattr(task, field, value)
    task.language = ensure_task_language_matches_course(payload.language, course)
    if payload.tests is not None:
        task.tests = [TaskTestCase(**item.model_dump()) for item in payload.tests]
    task.touch()
    await task.save()
    return MessageResponse(message="Задача обновлена", success=True)


@router.delete("/{task_id}", response_model=MessageResponse)
async def delete_task(
    task_id: str,
    user: User = Depends(require_role(UserType.TEACHER)),
):
    task = await Task.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Задача не найдена")
    topic = await Topic.get(task.topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Урок не найден")
    course = await Course.get(topic.course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Курс не найден")
    if not await can_edit_course(user, course):
        raise HTTPException(status_code=403, detail="Нет прав на удаление задачи")

    topic.task_ids = [item for item in topic.task_ids if item != str(task.id)]
    topic.touch()
    await topic.save()
    await task.delete()
    return MessageResponse(message="Задача удалена", success=True)

@router.get("/topic/{topic_id}", response_model=List[TaskResponse])
async def tasks_for_topic(
    topic_id: str,
    user: User = Depends(get_current_user_dependency),
):
    topic = await Topic.get(topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Урок не найден")
    course = await Course.get(topic.course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Курс не найден")
    user_courses = {str(item.id) for item in await get_courses_for_user(user)}
    if user.user_type != UserType.ADMIN and str(course.id) not in user_courses:
        raise HTTPException(status_code=403, detail="Нет доступа к задачам урока")
    editable = await can_edit_course(user, course)
    await ensure_topic_access(user, topic, editable)
    tasks = await Task.find(Task.topic_id == topic_id).to_list()
    tasks.sort(key=lambda item: item.order)
    return [await serialize_task(task, user, can_edit=editable) for task in tasks]

@router.get("/{task_id}", response_model=TaskResponse)
async def task_detail(
    task_id: str,
    user: User = Depends(get_current_user_dependency),
):
    task = await Task.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Задача не найдена")
    course = await get_task_course(task)
    user_courses = {str(item.id) for item in await get_courses_for_user(user)}
    if user.user_type != UserType.ADMIN and str(course.id) not in user_courses:
        raise HTTPException(status_code=403, detail="Нет доступа к задаче")
    editable = await can_edit_course(user, course)
    topic = await Topic.get(task.topic_id)
    if topic:
        await ensure_topic_access(user, topic, editable)
    return await serialize_task(task, user, can_edit=editable)


@router.post("/{task_id}/submit", response_model=TaskResponse)
async def submit_task_solution(
    task_id: str,
    payload: SubmitTaskSolutionRequest,
    user: User = Depends(require_role(UserType.STUDENT)),
):
    if user.user_type != UserType.STUDENT:
        raise HTTPException(status_code=400, detail="Решения могут отправлять только ученики")

    task = await Task.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Задача не найдена")
    course = await get_task_course(task)
    user_courses = {str(item.id) for item in await get_courses_for_user(user)}
    if str(course.id) not in user_courses:
        raise HTTPException(status_code=403, detail="Нет доступа к задаче")

    topic = await Topic.get(task.topic_id)
    if topic:
        await ensure_topic_access(user, topic, editable=False)

    result = task.upsert_result(str(user.id))
    already_solved = result.status == TaskStatus.CORRECT

    passed, passed_tests, stdout, stderr, test_results = await submit_code_with_queue(
        str(user.id),
        str(task.id),
        lambda: run_solution_for_language(
            task.language,
            payload.code,
            task.tests,
        ),
    )
    waiting_manual_review = passed and task.requires_manual_review and not already_solved

    result.attempts += 1
    result.review_comment = None
    submission = TaskSubmission(
        code=payload.code,
        passed=passed,
        passed_tests=passed_tests,
        total_tests=len(task.tests),
        stdout=stdout,
        stderr=stderr,
        test_results=test_results,
        waiting_manual_review=waiting_manual_review,
    )
    result.add_submission(submission)

    newly_unlocked = await unlock_achievements_for_trigger(user, AchievementTrigger.FIRST_SUBMISSION)

    if passed:
        if waiting_manual_review:
            result.status = TaskStatus.PENDING_REVIEW
            result.score = 0
            result.solved_at = None
            result.reviewed_at = None
        else:
            result.status = TaskStatus.CORRECT
            result.score = task.points
            result.solved_at = result.solved_at or datetime.utcnow()
            if not already_solved:
                user.award_points(task.points)
                newly_unlocked.extend(
                    await unlock_achievements_for_trigger(
                        user,
                        AchievementTrigger.FIRST_SOLVED_TASK,
                        course_id=str(course.id),
                    )
                )
    elif not already_solved:
        result.status = TaskStatus.WRONG_ANSWER
        result.score = 0
        result.solved_at = None

    task.touch()
    await task.save()
    await user.save()
    response = await serialize_task(task, user, can_edit=False)
    response.newly_unlocked_achievements = [
        serialize_achievement_notice(item) for item in newly_unlocked
    ]
    return response


@router.post("/{task_id}/run", response_model=TaskCodeRunResponse)
async def run_task_code(
    task_id: str,
    payload: RunTaskCodeRequest,
    user: User = Depends(get_current_user_dependency),
):
    task = await Task.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Задача не найдена")

    course = await get_task_course(task)
    user_courses = {str(item.id) for item in await get_courses_for_user(user)}
    if user.user_type != UserType.ADMIN and str(course.id) not in user_courses:
        raise HTTPException(status_code=403, detail="Нет доступа к задаче")

    editable = await can_edit_course(user, course)
    topic = await Topic.get(task.topic_id)
    if topic:
        await ensure_topic_access(user, topic, editable)

    success, exit_code, stdout, stderr, timed_out = await run_code_with_queue(
        str(user.id),
        str(task.id),
        lambda: run_program_for_language(
            task.language,
            payload.code,
            payload.input_data,
        ),
    )
    return TaskCodeRunResponse(
        input_data=payload.input_data,
        stdout=stdout,
        stderr=stderr,
        success=success,
        exit_code=exit_code,
        timed_out=timed_out,
    )


@router.post("/{task_id}/review/{student_id}", response_model=TaskResponse)
async def review_task_submission(
    task_id: str,
    student_id: str,
    payload: ReviewTaskSubmissionRequest,
    user: User = Depends(require_role(UserType.TEACHER)),
):
    task = await Task.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Задача не найдена")
    course = await get_task_course(task)
    if not await can_edit_course(user, course):
        raise HTTPException(status_code=403, detail="Нет прав на ручную проверку")

    student = await User.get(student_id)
    if not student or student.user_type != UserType.STUDENT:
        raise HTTPException(status_code=404, detail="Ученик не найден")

    result = task.get_result_for_student(student_id)
    if not result or not result.last_submission:
        raise HTTPException(status_code=404, detail="У ученика нет отправки по задаче")
    if result.status != TaskStatus.PENDING_REVIEW:
        raise HTTPException(status_code=400, detail="Задача не ожидает ручной проверки")

    result.review_comment = payload.comment
    result.reviewed_at = datetime.utcnow()
    result.last_submission.waiting_manual_review = False
    result.last_submission.review_comment = payload.comment

    if payload.approve:
        result.status = TaskStatus.CORRECT
        result.score = task.points
        result.solved_at = result.solved_at or datetime.utcnow()
        student.award_points(task.points)
        newly_unlocked = await unlock_achievements_for_trigger(
            student,
            AchievementTrigger.FIRST_SOLVED_TASK,
            course_id=str(course.id),
        )
    else:
        newly_unlocked = []
        result.status = TaskStatus.WRONG_ANSWER
        result.score = 0
        result.solved_at = None

    task.touch()
    await task.save()
    await student.save()
    response = await serialize_task(task, user, can_edit=True)
    response.newly_unlocked_achievements = [
        serialize_achievement_notice(item) for item in newly_unlocked
    ]
    return response
