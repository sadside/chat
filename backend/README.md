# Nova — Backend

FastAPI + SQLAlchemy + asyncpg backend для Nova chat.
См. [design spec](../docs/superpowers/specs/2026-04-18-nova-chat-design.md).

## Quickstart

### 1. Поднять инфраструктуру

    docker compose up -d postgres mailpit

### 2. Запустить миграции + бэкенд (локально)

    cd backend
    uv sync
    cp .env.example .env
    uv run alembic upgrade head
    uv run uvicorn app.main:app --reload --port 8080

Или всё в docker:

    docker compose up -d

### 3. Swagger UI

    http://localhost:8080/api/docs

### 4. Mailpit (письма с OTP)

    http://localhost:8025

## Тесты

    uv run pytest -v

## Структура

См. [план реализации](../docs/superpowers/plans/2026-04-18-plan-1-backend-foundation-auth.md).

## API (Phase 1)

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/health` | Liveness probe |
| POST | `/api/v1/auth/request-otp` | Запрос OTP-кода на email |
| POST | `/api/v1/auth/verify-otp` | Верификация + JWT cookie |
| GET | `/api/v1/auth/me` | Текущий пользователь |
| POST | `/api/v1/auth/logout` | Очистка cookie |

## Env

Полный список переменных — см. `.env.example`.
