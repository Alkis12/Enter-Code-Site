import os
import logging
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn
from contextlib import asynccontextmanager
from database import init_database, close_database

# Конфигурация
load_dotenv()
logging.basicConfig(
    level=logging.INFO,
    filename=os.getenv("LOG_FILE", "app.log"),
    filemode="a",
    format="%(asctime)s | %(levelname)s | %(message)s"
)
logger = logging.getLogger("main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_database()
    yield
    await close_database()

app = FastAPI(
    title="Enter Code Site API",
    description="API для платформы обучения программированию",
    version="2.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Глобальная обработка исключений
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    logger.error(f"HTTP {exc.status_code} error on {request.url}: {exc.detail}")
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "status_code": exc.status_code}
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception on {request.url}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Внутренняя ошибка сервера",
            "status_code": 500,
            "message": "Произошла непредвиденная ошибка"
        }
    )

# Подключаем роутеры
from routers.auth import router as auth_router
from routers.users import router as users_router
from routers.courses import router as courses_router
from routers.topics import router as topics_router
from routers.tasks import router as tasks_router
from routers.groups import router as groups_router
from routers.subscriptions import router as subscriptions_router

app.include_router(auth_router)
app.include_router(users_router)
app.include_router(courses_router)
app.include_router(topics_router)
app.include_router(tasks_router)
app.include_router(groups_router)
app.include_router(subscriptions_router)

@app.get("/", summary="Главная страница", tags=["Общее"])
def root():
    return {"message": "Добро пожаловать в Enter Code Site!", "version": "2.0.0"}

@app.get("/health", summary="Проверка состояния приложения", tags=["Общее"])
async def health_check():
    """Быстрая проверка состояния приложения и базы данных"""
    try:
        import motor.motor_asyncio
        client = motor.motor_asyncio.AsyncIOMotorClient(os.getenv("MONGODB_URL"))
        await client.admin.command('ping')
        client.close()
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(
            status_code=503, 
            detail={
                "status": "unhealthy", 
                "error": str(e),
                "message": "Сервис временно недоступен"
            }
        )

if __name__ == "__main__":
    uvicorn.run("main:app")
