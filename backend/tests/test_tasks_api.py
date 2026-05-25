import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from models.task import TaskResult, TaskStatus, TaskSubmission
from models.user import UserType
from routers.tasks import router as tasks_router
from services.auth_service import get_current_user_dependency

from tests.test_support import FakeTask, make_client, task_response_model


class TasksApiTest(unittest.TestCase):
    def tearDown(self):
        if hasattr(self, "app"):
            self.app.dependency_overrides.clear()

    def test_run_endpoint_returns_program_output(self):
        user = SimpleNamespace(id="student-1", user_type=UserType.STUDENT)
        client, self.app = make_client(
            tasks_router,
            overrides={get_current_user_dependency: lambda: user},
        )
        task = FakeTask(language="python", requires_manual_review=False)
        course = SimpleNamespace(id="course-1")
        topic = SimpleNamespace(id="topic-1", course_id="course-1", order=0, is_open=True)

        with (
            patch("routers.tasks.Task.get", new=AsyncMock(return_value=task)),
            patch("routers.tasks.get_task_course", new=AsyncMock(return_value=course)),
            patch("routers.tasks.get_courses_for_user", new=AsyncMock(return_value=[course])),
            patch("routers.tasks.can_edit_course", new=AsyncMock(return_value=False)),
            patch("routers.tasks.Topic.get", new=AsyncMock(return_value=topic)),
            patch("routers.tasks.ensure_topic_access", new=AsyncMock(return_value=None)),
            patch("routers.tasks.run_python_program", return_value=(True, 0, "42", "", False)),
        ):
            response = client.post(
                "/task/task-1/run",
                json={"code": "print(42)", "input_data": ""},
            )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["success"])
        self.assertEqual(payload["stdout"], "42")

    def test_run_endpoint_supports_javascript(self):
        user = SimpleNamespace(id="student-1", user_type=UserType.STUDENT)
        client, self.app = make_client(
            tasks_router,
            overrides={get_current_user_dependency: lambda: user},
        )
        task = FakeTask(language="javascript", requires_manual_review=False)
        course = SimpleNamespace(id="course-1")
        topic = SimpleNamespace(id="topic-1", course_id="course-1", order=0, is_open=True)

        with (
            patch("routers.tasks.Task.get", new=AsyncMock(return_value=task)),
            patch("routers.tasks.get_task_course", new=AsyncMock(return_value=course)),
            patch("routers.tasks.get_courses_for_user", new=AsyncMock(return_value=[course])),
            patch("routers.tasks.can_edit_course", new=AsyncMock(return_value=False)),
            patch("routers.tasks.Topic.get", new=AsyncMock(return_value=topic)),
            patch("routers.tasks.ensure_topic_access", new=AsyncMock(return_value=None)),
            patch("routers.tasks.run_javascript_program", return_value=(True, 0, "42", "", False)),
        ):
            response = client.post(
                "/task/task-1/run",
                json={"code": "console.log(42)", "input_data": ""},
            )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["success"])
        self.assertEqual(payload["stdout"], "42")

    def test_add_task_rejects_language_switch_inside_course(self):
        teacher = SimpleNamespace(id="teacher-1", user_type=UserType.TEACHER)
        client, self.app = make_client(
            tasks_router,
            overrides={get_current_user_dependency: lambda: teacher},
        )
        topic = SimpleNamespace(id="topic-1", course_id="course-1")
        course = SimpleNamespace(id="course-1", programming_language="python")

        with (
            patch("routers.tasks.Topic.get", new=AsyncMock(return_value=topic)),
            patch("routers.tasks.Course.get", new=AsyncMock(return_value=course)),
            patch("routers.tasks.can_edit_course", new=AsyncMock(return_value=True)),
        ):
            response = client.post(
                "/task/add",
                json={
                    "topic_id": "topic-1",
                    "title": "JS task inside Python course",
                    "condition": "Print 42",
                    "language": "javascript",
                    "tests": [{"input_data": "", "expected_output": "42"}],
                },
            )

        self.assertEqual(response.status_code, 400)
        self.assertIn("языком Python", response.json()["detail"])

    def test_add_task_defaults_to_course_language(self):
        teacher = SimpleNamespace(id="teacher-1", user_type=UserType.TEACHER)
        client, self.app = make_client(
            tasks_router,
            overrides={get_current_user_dependency: lambda: teacher},
        )
        topic = SimpleNamespace(id="topic-1", course_id="course-1", task_ids=[], touch=lambda: None, save=AsyncMock())
        course = SimpleNamespace(id="course-1", programming_language="javascript")
        created_tasks = []

        class CapturedTask(FakeTask):
            def __init__(self, **kwargs):
                super().__init__(
                    language=kwargs.get("language", "python"),
                    requires_manual_review=kwargs.get("requires_manual_review", False),
                    tests=kwargs.get("tests", []),
                )
                self.id = "task-1"
                self.topic_id = kwargs.get("topic_id", "topic-1")
                self.title = kwargs.get("title", "Task title")
                self.condition = kwargs.get("condition", "Solve it")
                self.attachments = kwargs.get("attachments", [])
                self.points = kwargs.get("points", 10)
                self.starter_code = kwargs.get("starter_code", "")
                self.order = kwargs.get("order", 0)
                created_tasks.append(self)

            async def insert(self):
                return None

        with (
            patch("routers.tasks.Topic.get", new=AsyncMock(return_value=topic)),
            patch("routers.tasks.Course.get", new=AsyncMock(return_value=course)),
            patch("routers.tasks.can_edit_course", new=AsyncMock(return_value=True)),
            patch("routers.tasks.Task", CapturedTask),
        ):
            response = client.post(
                "/task/add",
                json={
                    "topic_id": "topic-1",
                    "title": "JS task",
                    "condition": "Print 42",
                    "tests": [{"input_data": "", "expected_output": "42"}],
                },
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(created_tasks[0].language, "javascript")

    def test_topic_route_is_not_shadowed_by_task_detail_route(self):
        user = SimpleNamespace(id="student-1", user_type=UserType.STUDENT)
        client, self.app = make_client(
            tasks_router,
            overrides={get_current_user_dependency: lambda: user},
        )
        topic = SimpleNamespace(id="topic-1", course_id="course-1", order=0, is_open=True)
        course = SimpleNamespace(id="course-1")
        task = FakeTask(language="python", requires_manual_review=False)

        with (
            patch("routers.tasks.Topic.get", new=AsyncMock(return_value=topic)),
            patch("routers.tasks.Course.get", new=AsyncMock(return_value=course)),
            patch("routers.tasks.get_courses_for_user", new=AsyncMock(return_value=[course])),
            patch("routers.tasks.can_edit_course", new=AsyncMock(return_value=False)),
            patch("routers.tasks.ensure_topic_access", new=AsyncMock(return_value=None)),
            patch("routers.tasks.Task.topic_id", "topic_id", create=True),
            patch("routers.tasks.Task.find", return_value=SimpleNamespace(to_list=AsyncMock(return_value=[task]))),
        ):
            response = client.get("/task/topic/topic-1")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()[0]["id"], "task-1")

    def test_review_endpoint_approves_pending_submission(self):
        teacher = SimpleNamespace(id="teacher-1", user_type=UserType.TEACHER)
        client, self.app = make_client(
            tasks_router,
            overrides={get_current_user_dependency: lambda: teacher},
        )
        result = TaskResult(
            user_id="student-1",
            status=TaskStatus.PENDING_REVIEW,
            attempts=1,
            last_submission=TaskSubmission(
                code="print(42)",
                passed=True,
                passed_tests=1,
                total_tests=1,
                waiting_manual_review=True,
            ),
        )
        task = FakeTask(result=result, requires_manual_review=True)
        course = SimpleNamespace(id="course-1")
        student = SimpleNamespace(
            id="student-1",
            user_type=UserType.STUDENT,
            award_points=lambda _points: None,
            save=AsyncMock(),
        )

        async def serialize_task_response(task_obj, *_args, **_kwargs):
            current = task_obj.get_result_for_student("student-1")
            return task_response_model(
                status=current.status.value,
                score=current.score,
                attempts=current.attempts,
            )

        with (
            patch("routers.tasks.Task.get", new=AsyncMock(return_value=task)),
            patch("routers.tasks.get_task_course", new=AsyncMock(return_value=course)),
            patch("routers.tasks.can_edit_course", new=AsyncMock(return_value=True)),
            patch("routers.tasks.User.get", new=AsyncMock(return_value=student)),
            patch("routers.tasks.unlock_achievements_for_trigger", new=AsyncMock(return_value=[])),
            patch("routers.tasks.serialize_task", new=serialize_task_response),
        ):
            response = client.post(
                "/task/task-1/review/student-1",
                json={"approve": True, "comment": "Looks good"},
            )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["result"]["status"], "correct")
        self.assertEqual(payload["result"]["score"], 10)


if __name__ == "__main__":
    unittest.main()
