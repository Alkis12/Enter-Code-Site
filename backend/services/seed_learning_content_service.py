import json
import os
from pathlib import Path
from typing import Any

from models.course import Course
from models.task import Task, TaskTestCase
from models.topic import Topic
from models.user import User


SEED_PYTHON_DEMO_CONTENT = os.getenv("SEED_PYTHON_DEMO_CONTENT", "true").lower() in {
    "1",
    "true",
    "yes",
}
DEFAULT_TEACHER_USERNAME = os.getenv("DEFAULT_TEACHER_USERNAME", "teacher")
DEMO_FIXTURE_PATH = Path(__file__).resolve().parent.parent / "data" / "python_demo_course.json"


def load_python_demo_course_fixture() -> dict[str, Any]:
    with DEMO_FIXTURE_PATH.open("r", encoding="utf-8") as file:
        payload = json.load(file)

    if "name" not in payload or "topics" not in payload:
        raise ValueError("Invalid Python demo course fixture format")

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

    if not course:
        course = Course(
            name=course_payload["name"],
            description=course_payload.get("description", ""),
            accent_color=course_payload.get("accent_color", "#3776AB"),
            cover_image=course_payload.get("cover_image", ""),
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

    if not task:
        task = Task(
            topic_id=str(topic.id),
            title=task_payload["title"],
            condition=task_payload["condition"],
            attachments=task_payload.get("attachments", []),
            points=task_payload.get("points", 10),
            starter_code=task_payload.get("starter_code", ""),
            language=task_payload.get("language", "python"),
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
        "language": task_payload.get("language", "python"),
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


async def ensure_python_demo_learning_content() -> None:
    if not SEED_PYTHON_DEMO_CONTENT:
        return

    course_payload = load_python_demo_course_fixture()
    course = await _ensure_demo_course(course_payload)

    for topic_payload in course_payload["topics"]:
        topic = await _ensure_topic(course, topic_payload)
        for task_payload in topic_payload.get("tasks", []):
            await _ensure_task(topic, task_payload)
