import logging
from models.user import User

logger = logging.getLogger("user_repository")

class UserRepository:
    """
    Repository for user-related database operations.
    """
    async def get_all(self):
        """Get all users from the database."""
        return await User.find_all().to_list()

    async def get_by_tg_username(self, tg_username: str):
        """Get a user by their Telegram username."""
        return await User.find_one(User.tg_username == tg_username)

    async def get_by_phone(self, phone: str):
        """Get a user by their phone number."""
        return await User.find_one(User.phone == phone)