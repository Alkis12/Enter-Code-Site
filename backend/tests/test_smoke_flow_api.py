import unittest
from contextlib import ExitStack
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from models.task import TaskTestCase
from models.user import UserType
from routers.auth import router as auth_router
from routers.courses import router as courses_router
from routers.tasks import router as tasks_router
from routers.topics import router as topics_router
from services.auth_service import get_auth_service, get_current_user_dependency

from tests.test_support import (
    AsyncListResult,
    FakeTask,
    course_response,
    make_client,
    task_response_model,
    topic_response,
)


class FakeAuthService:
    async def login(self, _payload):
        return "access-token", "refresh-token", []

    async def get_current_user(self, _token):
        return SimpleNamespace(id="student-1", user_type=UserType.STUDENT)


class SmokeFlowApiTest(unittest.TestCase):
    def setUp(self):
        self.user = SimpleNamespace(
            id="student-1",
            user_type=UserType.STUDENT,
            save=AsyncMock(),
            award_points=lambda _points: None,
        )
        self.course = SimpleNamespace(id="course-1", name="Python Basics")
        self.topic = SimpleNamespace(
            id="topic-1",
            course_id="course-1",
            name="Intro",
            description="Lesson",
            order=0,
            is_open=True,
        )
        self.task = FakeTask(
            language="python",
            requires_manual_review=False,
            tests=[TaskTestCase(input_data="", expected_output="42")],
        )

        self.client, self.app = make_client(
            auth_router,
            courses_router,
            topics_router,
            tasks_router,
            overrides={
                get_auth_service: lambda: FakeAuthService(),
                get_current_user_dependency: lambda: self.user,
            },
        )

    def tearDown(self):
        self.app.dependency_overrides.clear()

    def test_login_course_lesson_submit_smoke_flow(self):
        async def serialize_task_response(task_obj, *_args, **_kwargs):
            current = task_obj.get_result_for_student("student-1")
            return task_response_model(
                status=current.status.value if current else "no_attempts",
                score=current.score if current else 0,
                attempts=current.attempts if current else 0,
                stdout="42" if current else "",
            )

        with ExitStack() as stack:
            stack.enter_context(
                patch("routers.courses.get_courses_for_user", new=AsyncMock(return_value=[self.course]))
            )
            stack.enter_context(patch("routers.courses.Course.get", new=AsyncMock(return_value=self.course)))
            stack.enter_context(patch("routers.courses.can_edit_course", new=AsyncMock(return_value=False)))
            stack.enter_context(patch("routers.courses.Topic.course_id", "course_id", create=True))
            stack.enter_context(patch("routers.courses.get_groups_for_course", new=AsyncMock(return_value=[])))
            stack.enter_context(patch("routers.courses.Topic.find", return_value=AsyncListResult([self.topic])))
            stack.enter_context(
                patch("routers.courses.serialize_course", new=AsyncMock(return_value=course_response()))
            )
            stack.enter_context(
                patch("routers.courses.serialize_topic", new=AsyncMock(return_value=topic_response()))
            )
            stack.enter_context(
                patch("routers.courses.lesson_is_available_for_user", new=AsyncMock(return_value=True))
            )
            stack.enter_context(patch("routers.topics.Topic.get", new=AsyncMock(return_value=self.topic)))
            stack.enter_context(patch("routers.topics.Course.get", new=AsyncMock(return_value=self.course)))
            stack.enter_context(
                patch("routers.topics.get_courses_for_user", new=AsyncMock(return_value=[self.course]))
            )
            stack.enter_context(patch("routers.topics.can_edit_course", new=AsyncMock(return_value=False)))
            stack.enter_context(patch("routers.topics.Topic.course_id", "course_id", create=True))
            stack.enter_context(patch("routers.topics.Task.topic_id", "topic_id", create=True))
            stack.enter_context(patch("routers.topics.Topic.find", return_value=AsyncListResult([self.topic])))
            stack.enter_context(patch("routers.topics.Task.find", return_value=AsyncListResult([self.task])))
            stack.enter_context(
                patch("routers.topics.serialize_course", new=AsyncMock(return_value=course_response()))
            )
            stack.enter_context(
                patch("routers.topics.serialize_topic", new=AsyncMock(return_value=topic_response()))
            )
            stack.enter_context(
                patch("routers.topics.lesson_is_available_for_user", new=AsyncMock(return_value=True))
            )
            stack.enter_context(patch("routers.topics.serialize_task", new=serialize_task_response))
            stack.enter_context(patch("routers.tasks.Task.get", new=AsyncMock(return_value=self.task)))
            stack.enter_context(patch("routers.tasks.get_task_course", new=AsyncMock(return_value=self.course)))
            stack.enter_context(
                patch("routers.tasks.get_courses_for_user", new=AsyncMock(return_value=[self.course]))
            )
            stack.enter_context(patch("routers.tasks.can_edit_course", new=AsyncMock(return_value=False)))
            stack.enter_context(patch("routers.tasks.Topic.get", new=AsyncMock(return_value=self.topic)))
            stack.enter_context(patch("routers.tasks.ensure_topic_access", new=AsyncMock(return_value=None)))
            stack.enter_context(patch("routers.tasks.run_python_solution", return_value=(True, 1, "42", "", [])))
            stack.enter_context(
                patch("routers.tasks.unlock_achievements_for_trigger", new=AsyncMock(return_value=[]))
            )
            stack.enter_context(patch("routers.tasks.serialize_task", new=serialize_task_response))
            login_response = self.client.post(
                "/auth/login",
                json={"tg_username": "student", "password": "secret123"},
            )
            course_response_payload = self.client.get("/course/course-1")
            topic_response_payload = self.client.get("/topic/topic-1")
            submit_response = self.client.post(
                "/task/task-1/submit",
                json={"code": "print(42)"},
            )

        self.assertEqual(login_response.status_code, 200)
        self.assertEqual(course_response_payload.status_code, 200)
        self.assertEqual(topic_response_payload.status_code, 200)
        self.assertEqual(submit_response.status_code, 200)
        self.assertEqual(submit_response.json()["result"]["status"], "correct")


if __name__ == "__main__":
    unittest.main()
