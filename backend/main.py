import logging
import os
from contextlib import asynccontextmanager

import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from database import close_database, init_database, ping_database
from routers.achievements import router as achievements_router
from routers.auth import router as auth_router
from routers.courses import router as courses_router
from routers.events import router as events_router
from routers.groups import router as groups_router
from routers.subscriptions import router as subscriptions_router
from routers.tasks import router as tasks_router
from routers.teaching import router as teaching_router
from routers.topics import router as topics_router
from routers.users import router as users_router


load_dotenv()
logging.basicConfig(
    level=logging.INFO,
    filename=os.getenv("LOG_FILE", "app.log"),
    filemode="a",
    format="%(asctime)s | %(levelname)s | %(message)s",
)
logger = logging.getLogger("main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_database()
    try:
        yield
    finally:
        await close_database()


app = FastAPI(
    title="Enter Code Site API",
    description="API for the Enter Code learning platform",
    version="2.0.0",
    lifespan=lifespan,
)

uploads_dir = os.getenv("UPLOADS_DIR", "uploads")
os.makedirs(uploads_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "http://localhost:3001").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    logger.error("HTTP %s error on %s: %s", exc.status_code, request.url, exc.detail)
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "status_code": exc.status_code},
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled exception on %s: %s", request.url, exc, exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal server error",
            "status_code": 500,
            "message": "Unexpected application error",
        },
    )


app.include_router(auth_router)
app.include_router(users_router)
app.include_router(courses_router)
app.include_router(topics_router)
app.include_router(tasks_router)
app.include_router(teaching_router)
app.include_router(groups_router)
app.include_router(subscriptions_router)
app.include_router(events_router)
app.include_router(achievements_router)


@app.get("/", summary="Home", tags=["General"])
def root():
    return {"message": "Welcome to Enter Code Site!", "version": "2.0.0"}


@app.get("/health", summary="Health check", tags=["General"])
async def health_check():
    try:
        await ping_database()
        return {"status": "healthy", "database": "connected"}
    except Exception as exc:
        logger.error("Health check failed: %s", exc)
        raise HTTPException(
            status_code=503,
            detail={
                "status": "unhealthy",
                "error": str(exc),
                "message": "Service is temporarily unavailable",
            },
        ) from exc


if __name__ == "__main__":
    uvicorn.run("main:app")
