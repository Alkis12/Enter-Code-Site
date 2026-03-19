import unittest
from types import SimpleNamespace

from services.auth_service import get_auth_service
from routers.auth import router as auth_router
from models.user import UserType

from tests.test_support import make_client


class FakeAuthService:
    async def login(self, _payload):
        return "access-token", "refresh-token", []

    async def get_current_user(self, _token):
        return SimpleNamespace(id="user-1", user_type=UserType.STUDENT)


class AuthApiTest(unittest.TestCase):
    def setUp(self):
        self.client, self.app = make_client(
            auth_router,
            overrides={get_auth_service: lambda: FakeAuthService()},
        )

    def tearDown(self):
        self.app.dependency_overrides.clear()

    def test_login_returns_session_payload(self):
        response = self.client.post(
            "/auth/login",
            json={"tg_username": "student", "password": "secret123"},
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["access_token"], "access-token")
        self.assertEqual(payload["refresh_token"], "refresh-token")
        self.assertEqual(payload["user_type"], "student")


if __name__ == "__main__":
    unittest.main()
