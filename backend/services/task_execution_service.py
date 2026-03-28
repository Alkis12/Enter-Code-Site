import asyncio
import os
import time
from collections import defaultdict, deque
from typing import Awaitable, Callable, TypeVar

from fastapi import HTTPException


RUN_CONCURRENCY = int(os.getenv("TASK_RUN_CONCURRENCY", "2"))
RUN_WINDOW_SECONDS = int(os.getenv("TASK_RUN_RATE_WINDOW_SECONDS", "30"))
RUN_WINDOW_LIMIT = int(os.getenv("TASK_RUN_RATE_LIMIT", "12"))
SUBMIT_WINDOW_SECONDS = int(os.getenv("TASK_SUBMIT_RATE_WINDOW_SECONDS", "30"))
SUBMIT_WINDOW_LIMIT = int(os.getenv("TASK_SUBMIT_RATE_LIMIT", "6"))

_runner_semaphore = asyncio.Semaphore(RUN_CONCURRENCY)
_run_timestamps: dict[str, deque[float]] = defaultdict(deque)
_submit_timestamps: dict[str, deque[float]] = defaultdict(deque)
_rate_lock = asyncio.Lock()

T = TypeVar("T")


async def _consume_rate_limit(
    bucket: dict[str, deque[float]],
    key: str,
    limit: int,
    window_seconds: int,
    error_detail: str,
) -> None:
    now = time.monotonic()
    async with _rate_lock:
        history = bucket[key]
        while history and now - history[0] > window_seconds:
            history.popleft()
        if len(history) >= limit:
            raise HTTPException(status_code=429, detail=error_detail)
        history.append(now)


async def run_code_with_queue(
    user_id: str,
    task_id: str,
    action: Callable[[], T],
) -> T:
    await _consume_rate_limit(
        _run_timestamps,
        f"{user_id}:{task_id}",
        RUN_WINDOW_LIMIT,
        RUN_WINDOW_SECONDS,
        "Слишком много запусков подряд. Подождите немного и попробуйте снова.",
    )
    async with _runner_semaphore:
        return await asyncio.to_thread(action)


async def submit_code_with_queue(
    user_id: str,
    task_id: str,
    action: Callable[[], T],
) -> T:
    await _consume_rate_limit(
        _submit_timestamps,
        f"{user_id}:{task_id}",
        SUBMIT_WINDOW_LIMIT,
        SUBMIT_WINDOW_SECONDS,
        "Слишком много отправок подряд. Подождите немного и отправьте решение еще раз.",
    )
    async with _runner_semaphore:
        return await asyncio.to_thread(action)
