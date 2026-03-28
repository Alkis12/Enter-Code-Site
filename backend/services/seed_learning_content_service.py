import json
import os
from pathlib import Path
from typing import Any

from models.course import Course
from models.programming_language import normalize_programming_language
from models.task import Task, TaskTestCase
from models.topic import Topic
from models.user import User


SEED_DEMO_LEARNING_CONTENT = os.getenv(
    "SEED_DEMO_LEARNING_CONTENT",
    os.getenv("SEED_PYTHON_DEMO_CONTENT", "true"),
).lower() in {
    "1",
    "true",
    "yes",
}
DEFAULT_TEACHER_USERNAME = os.getenv("DEFAULT_TEACHER_USERNAME", "teacher")
DEMO_FIXTURE_DIR = Path(__file__).resolve().parent.parent / "data"
DEMO_FIXTURE_NAMES = [
    "python_demo_course.json",
    "javascript_demo_course.json",
]


def load_demo_course_fixture(fixture_path: Path) -> dict[str, Any]:
    with fixture_path.open("r", encoding="utf-8") as file:
        payload = json.load(file)

    if "name" not in payload or "topics" not in payload:
        raise ValueError(f"Invalid demo course fixture format: {fixture_path.name}")

    return payload


def _append_unique(items: list[str], value: str) -> bool:
    if value in items:
        return False
    items.append(value)
    return True


async def _ensure_demo_course(course_payload: dict[str, Any]) -> Course:
    course = await Course.find_one(Course.name == course_payload["name"])
    teacher = await User.find_one(User.tg_username == DEFAULT_TEACHER_USERNAME)
    teacher_id = str(teacher.id) if teacher else None
    programming_language = normalize_programming_language(
        course_payload.get("programming_language", "python")
    ).value

    if not course:
        course = Course(
            name=course_payload["name"],
            description=course_payload.get("description", ""),
            accent_color=course_payload.get("accent_color", "#3776AB"),
            cover_image=course_payload.get("cover_image", ""),
            programming_language=programming_language,
            teacher_ids=[teacher_id] if teacher_id else [],
        )
        await course.insert()
        return course

    changed = False
    for field in ["description", "accent_color", "cover_image"]:
        value = course_payload.get(field, getattr(course, field))
        if getattr(course, field) != value:
            setattr(course, field, value)
            changed = True

    if getattr(course, "programming_language", "python") != programming_language:
        course.programming_language = programming_language
        changed = True

    if teacher_id and _append_unique(course.teacher_ids, teacher_id):
        changed = True

    if changed:
        course.touch()
        await course.save()

    return course


async def _ensure_topic(course: Course, topic_payload: dict[str, Any]) -> Topic:
    topic = await Topic.find_one(
        {"course_id": str(course.id), "name": topic_payload["name"]}
    )

    if not topic:
        topic = Topic(
            course_id=str(course.id),
            name=topic_payload["name"],
            description=topic_payload.get("description", ""),
            content=topic_payload.get("content", ""),
            resources=topic_payload.get("resources", []),
            order=topic_payload.get("order", 0),
        )
        await topic.insert()
        if _append_unique(course.topic_ids, str(topic.id)):
            course.touch()
            await course.save()
        return topic

    changed = False
    for field in ["description", "content", "resources", "order"]:
        value = topic_payload.get(field, getattr(topic, field))
        if getattr(topic, field) != value:
            setattr(topic, field, value)
            changed = True

    if changed:
        topic.touch()
        await topic.save()

    if _append_unique(course.topic_ids, str(topic.id)):
        course.touch()
        await course.save()

    return topic


async def _ensure_task(topic: Topic, task_payload: dict[str, Any]) -> Task:
    task = await Task.find_one(
        {"topic_id": str(topic.id), "title": task_payload["title"]}
    )
    tests = [TaskTestCase(**item) for item in task_payload.get("tests", [])]
    course = await Course.get(topic.course_id)
    task_language = normalize_programming_language(
        task_payload.get(
            "language",
            getattr(course, "programming_language", "python") if course else "python",
        )
    ).value

    if not task:
        task = Task(
            topic_id=str(topic.id),
            title=task_payload["title"],
            condition=task_payload["condition"],
            attachments=task_payload.get("attachments", []),
            points=task_payload.get("points", 10),
            starter_code=task_payload.get("starter_code", ""),
            language=task_language,
            requires_manual_review=task_payload.get("requires_manual_review", False),
            tests=tests,
            order=task_payload.get("order", 0),
        )
        await task.insert()
        if _append_unique(topic.task_ids, str(task.id)):
            topic.touch()
            await topic.save()
        return task

    changed = False
    updates = {
        "condition": task_payload["condition"],
        "attachments": task_payload.get("attachments", []),
        "points": task_payload.get("points", 10),
        "starter_code": task_payload.get("starter_code", ""),
        "language": task_language,
        "requires_manual_review": task_payload.get("requires_manual_review", False),
        "order": task_payload.get("order", 0),
        "tests": tests,
    }
    for field, value in updates.items():
        if getattr(task, field) != value:
            setattr(task, field, value)
            changed = True

    if changed:
        task.touch()
        await task.save()

    if _append_unique(topic.task_ids, str(task.id)):
        topic.touch()
        await topic.save()

    return task


async def ensure_demo_learning_content() -> None:
    if not SEED_DEMO_LEARNING_CONTENT:
        return

    for fixture_name in DEMO_FIXTURE_NAMES:
        course_payload = load_demo_course_fixture(DEMO_FIXTURE_DIR / fixture_name)
        course = await _ensure_demo_course(course_payload)

        for topic_payload in course_payload["topics"]:
            topic = await _ensure_topic(course, topic_payload)
            for task_payload in topic_payload.get("tasks", []):
                await _ensure_task(topic, task_payload)
