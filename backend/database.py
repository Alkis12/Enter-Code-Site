import motor.motor_asyncio
from beanie import init_beanie
from models.user import User
import logging
import os
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger("database")
MONGODB_URL = os.getenv("MONGODB_URL")

async def init_database():
    """Initialize the MongoDB database and Beanie ODM."""
    client = motor.motor_asyncio.AsyncIOMotorClient(MONGODB_URL)
    await init_beanie(database=client.get_default_database(), document_models=[User])
    logger.info("Database initialized successfully")

async def close_database():
    # No explicit close needed for motor client in most cases
    logger.info("Database connection closed (if applicable)") 