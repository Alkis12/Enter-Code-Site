import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from models.user import UserType
from routers.topics import router as topics_router
from services.auth_service import get_current_user_dependency

from tests.test_support import AsyncListResult, course_response, make_client, task_response, topic_response


class TopicDetailApiTest(unittest.TestCase):
    def setUp(self):
        self.user = SimpleNamespace(id="student-1", user_type=UserType.STUDENT)
        self.client, self.app = make_client(
            topics_router,
            overrides={get_current_user_dependency: lambda: self.user},
        )

    def tearDown(self):
        self.app.dependency_overrides.clear()

    def test_topic_detail_returns_lesson_with_tasks(self):
        course = SimpleNamespace(id="course-1", name="Python Basics")
        topic = SimpleNamespace(
            id="topic-1",
            course_id="course-1",
            name="Intro",
            description="Lesson",
            order=0,
            is_open=True,
        )
        task = SimpleNamespace(id="task-1", topic_id="topic-1", order=0)

        with (
            patch("routers.topics.Topic.get", new=AsyncMock(return_value=topic)),
            patch("routers.topics.Course.get", new=AsyncMock(return_value=course)),
            patch("routers.topics.get_courses_for_user", new=AsyncMock(return_value=[course])),
            patch("routers.topics.can_edit_course", new=AsyncMock(return_value=False)),
            patch("routers.topics.Topic.course_id", "course_id", create=True),
            patch("routers.topics.Task.topic_id", "topic_id", create=True),
            patch("routers.topics.Topic.find", return_value=AsyncListResult([topic])),
            patch("routers.topics.Task.find", return_value=AsyncListResult([task])),
            patch("routers.topics.lesson_is_available_for_user", new=AsyncMock(return_value=True)),
            patch("routers.topics.serialize_course", new=AsyncMock(return_value=course_response())),
            patch("routers.topics.serialize_topic", new=AsyncMock(return_value=topic_response())),
            patch("routers.topics.serialize_task", new=AsyncMock(return_value=task_response())),
        ):
            response = self.client.get("/topic/topic-1")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["course"]["id"], "course-1")
        self.assertEqual(payload["lesson"]["id"], "topic-1")
        self.assertEqual(len(payload["tasks"]), 1)
        self.assertEqual(payload["tasks"][0]["id"], "task-1")


if __name__ == "__main__":
    unittest.main()
