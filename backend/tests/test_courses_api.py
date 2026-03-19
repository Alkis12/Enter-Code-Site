import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from routers.courses import router as courses_router

from tests.test_support import AsyncListResult, FakeTopicRecord, course_response, make_client


class PublicCourseApiTest(unittest.TestCase):
    def setUp(self):
        self.client, self.app = make_client(courses_router)

    def tearDown(self):
        self.app.dependency_overrides.clear()

    def test_public_course_detail_returns_groups_and_lessons(self):
        course = SimpleNamespace(id="course-1", name="Python Basics")
        topics = [
            FakeTopicRecord(
                id="topic-1",
                name="Intro",
                description="First lesson",
                order=0,
                total_tasks=2,
            ),
            FakeTopicRecord(
                id="topic-2",
                name="Loops",
                description="Second lesson",
                order=1,
                total_tasks=3,
            ),
        ]
        topic_lookup = {str(topic.id): topic for topic in topics}
        groups = [
            SimpleNamespace(
                id="group-1",
                name="Morning",
                current_topic_id="topic-2",
                schedule_slots=[],
            )
        ]

        with (
            patch("routers.courses.Course.get", new=AsyncMock(return_value=course)),
            patch("routers.courses.Topic.course_id", "course_id", create=True),
            patch("routers.courses.Topic.find", return_value=AsyncListResult(topics)),
            patch("routers.courses.Topic.get", new=AsyncMock(side_effect=lambda topic_id: topic_lookup.get(topic_id))),
            patch("routers.courses.get_groups_for_course", new=AsyncMock(return_value=groups)),
            patch("routers.courses.serialize_course", new=AsyncMock(return_value=course_response())),
        ):
            response = self.client.get("/course/public/course-1")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["course"]["id"], "course-1")
        self.assertEqual(len(payload["groups"]), 1)
        self.assertEqual(payload["groups"][0]["current_topic_name"], "Loops")
        self.assertEqual(len(payload["lessons"]), 2)
        self.assertEqual(payload["lessons"][1]["total_tasks"], 3)


if __name__ == "__main__":
    unittest.main()
