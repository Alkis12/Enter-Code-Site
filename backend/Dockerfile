FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY pyproject.toml poetry.lock ./

RUN pip install --no-cache-dir poetry==2.1.3 \
    && poetry config virtualenvs.create false \
    && poetry install --no-interaction --no-ansi --no-root

COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
