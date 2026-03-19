from types import SimpleNamespace

from fastapi import FastAPI
from fastapi.testclient import TestClient

from models.task import TaskResult
from schemas.responses import TaskResponse


class AsyncListResult:
    def __init__(self, items):
        self.items = list(items)

    async def to_list(self):
        return list(self.items)

    def sort(self, *_args, **_kwargs):
        return self


class FakeTopicRecord(SimpleNamespace):
    async def get_total_tasks(self):
        return getattr(self, "total_tasks", 0)


class FakeTask:
    def __init__(self, result=None, language="python", requires_manual_review=True, tests=None):
        self.id = "task-1"
        self.topic_id = "topic-1"
        self.title = "Task title"
        self.condition = "Solve it"
        self.attachments = []
        self.points = 10
        self.starter_code = ""
        self.language = language
        self.requires_manual_review = requires_manual_review
        self.tests = list(tests or [])
        self.results = [result] if result else []
        self.order = 0
        self.saved = False

    def get_result_for_student(self, student_id):
        for result in self.results:
            if result.user_id == student_id:
                return result
        return None

    def upsert_result(self, student_id):
        existing = self.get_result_for_student(student_id)
        if existing:
            return existing
        created = TaskResult(user_id=student_id)
        self.results.append(created)
        return created

    def touch(self):
        return None

    async def save(self):
        self.saved = True


def make_client(*routers, overrides=None):
    app = FastAPI()
    for router in routers:
        app.include_router(router)
    app.dependency_overrides.update(overrides or {})
    return TestClient(app), app


def course_response(course_id="course-1", name="Python Basics"):
    return {
        "id": course_id,
        "name": name,
        "description": "Course description",
        "public_info": "",
        "accent_color": "#16a085",
        "cover_image": "",
        "group_ids": [],
        "topic_ids": [],
        "teacher_ids": [],
        "student_ids": [],
        "schedule_weekdays": [],
        "schedule_start_time": None,
        "schedule_end_time": None,
        "schedule_summary": "",
        "active_group_id": None,
        "active_group_name": None,
        "active_group_schedule_summary": "",
        "total_tasks": 0,
        "total_students": 0,
        "total_points": 0,
        "progress_percent": 0.0,
        "earned_points": 0,
        "can_edit": False,
        "finance": None,
    }


def topic_response(topic_id="topic-1", course_id="course-1", name="Intro"):
    return {
        "id": topic_id,
        "course_id": course_id,
        "name": name,
        "description": "Lesson description",
        "content": "",
        "resources": [],
        "task_ids": [],
        "total_tasks": 1,
        "total_points": 10,
        "progress_percent": 0.0,
        "earned_points": 0,
        "order": 0,
        "is_open": True,
        "can_access": True,
        "can_edit": False,
    }


def task_response(
    task_id="task-1",
    topic_id="topic-1",
    status="no_attempts",
    score=0,
    attempts=0,
    stdout="",
    stderr="",
):
    return {
        "id": task_id,
        "topic_id": topic_id,
        "title": "Task title",
        "condition": "Solve it",
        "attachments": [],
        "points": 10,
        "starter_code": "",
        "language": "python",
        "requires_manual_review": False,
        "order": 0,
        "tests": None,
        "pending_reviews": [],
        "newly_unlocked_achievements": [],
        "result": {
            "user_id": "student-1",
            "score": score,
            "status": status,
            "attempts": attempts,
            "solved_at": None,
            "reviewed_at": None,
            "review_comment": None,
            "last_submission": {
                "code": "print(42)",
                "passed": status == "correct",
                "passed_tests": attempts if attempts else 0,
                "total_tests": 1,
                "stdout": stdout,
                "stderr": stderr,
                "test_results": [],
                "waiting_manual_review": False,
                "review_comment": None,
                "created_at": "2026-03-19T00:00:00Z",
            }
            if status != "no_attempts"
            else None,
            "submission_history": [],
        },
    }


def task_response_model(**kwargs):
    return TaskResponse.model_validate(task_response(**kwargs))
