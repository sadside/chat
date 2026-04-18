# Plan 1 — Backend Foundation & Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Поднять полностью рабочий бэкенд Nova с passwordless OTP-аутентификацией, готовый к интеграции с фронтом и последующему добавлению чат-функционала.

**Architecture:** FastAPI (async) + SQLAlchemy 2.0 + asyncpg + Alembic + Pydantic v2. Инфраструктура (PostgreSQL + Mailpit) поднимается через docker-compose. JWT-токен в httpOnly cookie (HS256). OTP — 6 цифр, sha256-хеш с pepper, TTL 10 минут, rate-limit 3 запроса/15мин на email. Email абстрагирован через `EmailSender` Protocol с реализациями `SMTPSender` и `ConsoleSender`.

**Tech Stack:** Python 3.12 · FastAPI · uvicorn · SQLAlchemy 2.0 async · asyncpg · Alembic · Pydantic v2 · pydantic-settings · PyJWT · passlib-less (не нужен — OTP, не пароли) · aiosmtplib · slowapi · structlog · pytest · pytest-asyncio · httpx · uv (deps manager) · Docker Compose · PostgreSQL 16 · Mailpit.

**Repo layout (итоговый после плана):**
```
chat/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── deps.py
│   │   ├── core/
│   │   │   ├── security.py
│   │   │   ├── exceptions.py
│   │   │   ├── logging.py
│   │   │   └── rate_limit.py
│   │   ├── db/
│   │   │   ├── base.py
│   │   │   ├── session.py
│   │   │   └── models.py
│   │   ├── schemas/
│   │   │   └── auth.py
│   │   ├── api/v1/
│   │   │   ├── auth.py
│   │   │   ├── health.py
│   │   │   └── router.py
│   │   ├── services/
│   │   │   ├── otp_service.py
│   │   │   ├── auth_service.py
│   │   │   └── email/
│   │   │       ├── base.py
│   │   │       ├── console.py
│   │   │       └── smtp.py
│   │   └── alembic/
│   │       ├── env.py
│   │       └── versions/
│   ├── tests/
│   │   ├── conftest.py
│   │   ├── unit/
│   │   └── integration/
│   ├── pyproject.toml
│   ├── uv.lock
│   ├── alembic.ini
│   ├── Dockerfile
│   ├── .env.example
│   └── .env                 # gitignored
├── docker-compose.yml
├── .gitignore
└── docs/
    └── superpowers/
        ├── specs/2026-04-18-nova-chat-design.md
        └── plans/2026-04-18-plan-1-backend-foundation-auth.md
```

---

## Preamble — шаги перед Task 1

- [ ] **P.1: Инициализировать git-репозиторий**

Из корня `chat/`:

```bash
git init
git branch -m main
```

- [ ] **P.2: Создать `.gitignore`**

Создать файл `.gitignore` в корне:

```gitignore
# Python
__pycache__/
*.py[cod]
*.egg-info/
.venv/
venv/
.pytest_cache/
.mypy_cache/
.ruff_cache/

# Env
.env
.env.local
*.env

# Node
node_modules/
dist/
.vite/

# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Project
/data/
pgdata/
```

- [ ] **P.3: Первый коммит со spec'ом**

```bash
git add .gitignore docs/
git commit -m "chore: init repo with design spec"
```

---

## Task 1: Backend project skeleton (uv + pyproject)

**Files:**
- Create: `backend/pyproject.toml`
- Create: `backend/.python-version`
- Create: `backend/README.md`

- [ ] **Step 1.1: Установить uv (если не установлен)**

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
# проверить: uv --version   (ожидаем: 0.4+ или новее)
```

- [ ] **Step 1.2: Создать `backend/pyproject.toml`**

```toml
[project]
name = "nova-backend"
version = "0.1.0"
description = "Nova chat backend"
requires-python = ">=3.12"
dependencies = [
    "fastapi>=0.115",
    "uvicorn[standard]>=0.32",
    "sqlalchemy[asyncio]>=2.0.36",
    "asyncpg>=0.30",
    "alembic>=1.14",
    "pydantic>=2.9",
    "pydantic-settings>=2.6",
    "pyjwt[crypto]>=2.10",
    "httpx[http2]>=0.28",
    "aiosmtplib>=5.0",
    "slowapi>=0.1.9",
    "structlog>=24.4",
    "python-multipart>=0.0.12",
]

[dependency-groups]
dev = [
    "pytest>=8.3",
    "pytest-asyncio>=0.24",
    "pytest-cov>=6.0",
    "aiosqlite>=0.20",
    "ruff>=0.8",
]

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
pythonpath = ["."]

[tool.ruff]
line-length = 100
target-version = "py312"

[tool.ruff.lint]
select = ["E", "F", "I", "W", "UP", "B", "SIM", "RUF"]
ignore = ["E501"]

[tool.ruff.format]
quote-style = "double"
indent-style = "space"
```

- [ ] **Step 1.3: Создать `backend/.python-version`**

```
3.12
```

- [ ] **Step 1.4: Создать `backend/README.md` (минимум)**

```markdown
# Nova — Backend

FastAPI-backend для Nova chat. См. [design spec](../docs/superpowers/specs/2026-04-18-nova-chat-design.md).

## Quickstart

    cd backend
    uv sync
    cp .env.example .env
    uv run uvicorn app.main:app --reload --port 8080

## Tests

    uv run pytest
```

- [ ] **Step 1.5: Зафиксировать зависимости**

```bash
cd backend
uv sync
# создаст .venv/ и uv.lock
```

- [ ] **Step 1.6: Commit**

```bash
cd ..
git add backend/pyproject.toml backend/.python-version backend/README.md backend/uv.lock
git commit -m "feat(backend): scaffold uv project with core deps"
```

---

## Task 2: Docker Compose (postgres + mailpit)

**Files:**
- Create: `docker-compose.yml`
- Create: `backend/.env.example`

- [ ] **Step 2.1: Создать `docker-compose.yml` в корне**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: nova
      POSTGRES_PASSWORD: nova
      POSTGRES_DB: nova
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U nova -d nova"]
      interval: 5s
      timeout: 3s
      retries: 10

  mailpit:
    image: axllent/mailpit:latest
    restart: unless-stopped
    ports:
      - "1025:1025"   # SMTP
      - "8025:8025"   # Web UI
    environment:
      MP_MAX_MESSAGES: 500
      MP_SMTP_AUTH_ACCEPT_ANY: 1
      MP_SMTP_AUTH_ALLOW_INSECURE: 1

volumes:
  pgdata:
```

- [ ] **Step 2.2: Создать `backend/.env.example`**

```env
# App
APP_ENV=development
APP_HOST=0.0.0.0
APP_PORT=8080
APP_CORS_ORIGINS=http://localhost:5173

# Database
DATABASE_URL=postgresql+asyncpg://nova:nova@localhost:5432/nova

# JWT
JWT_SECRET=dev-secret-change-me-in-prod-min-32-chars-long
JWT_ALGORITHM=HS256
JWT_TTL_HOURS=168
JWT_COOKIE_NAME=access_token
JWT_COOKIE_SECURE=false
JWT_COOKIE_SAMESITE=lax

# OTP
OTP_PEPPER=dev-otp-pepper-change-me
OTP_TTL_MINUTES=10
OTP_MAX_ATTEMPTS=5
OTP_REQUEST_LIMIT=3
OTP_REQUEST_WINDOW_MIN=15
OTP_CODE_LENGTH=6

# Email
EMAIL_BACKEND=smtp
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=noreply@nova.local
SMTP_TLS=false
```

- [ ] **Step 2.3: Скопировать в `backend/.env`**

```bash
cd backend
cp .env.example .env
cd ..
```

- [ ] **Step 2.4: Поднять инфраструктуру и проверить**

```bash
docker compose up -d postgres mailpit
docker compose ps
# ожидание: оба контейнера "Up"/"healthy"

# Проверка postgres:
docker compose exec postgres psql -U nova -d nova -c "SELECT 1;"
# ожидание: "1 row"

# Проверка Mailpit UI:
curl -sSf http://localhost:8025/api/v1/info
# ожидание: JSON с полем "Version"
```

- [ ] **Step 2.5: Commit**

```bash
git add docker-compose.yml backend/.env.example
git commit -m "feat(infra): add docker-compose with postgres and mailpit"
```

---

## Task 3: Settings (pydantic-settings)

**Files:**
- Create: `backend/app/__init__.py` (пустой)
- Create: `backend/app/config.py`
- Create: `backend/tests/__init__.py` (пустой)
- Create: `backend/tests/unit/__init__.py` (пустой)
- Create: `backend/tests/unit/test_config.py`

- [ ] **Step 3.1: Создать пустые __init__.py**

```bash
cd backend
mkdir -p app tests/unit tests/integration
touch app/__init__.py tests/__init__.py tests/unit/__init__.py tests/integration/__init__.py
```

- [ ] **Step 3.2: Написать failing test `tests/unit/test_config.py`**

```python
import pytest
from pydantic import ValidationError

from app.config import Settings


def test_settings_load_from_env(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://u:p@host/db")
    monkeypatch.setenv("JWT_SECRET", "x" * 32)
    monkeypatch.setenv("OTP_PEPPER", "pepper")
    monkeypatch.setenv("SMTP_FROM", "noreply@example.com")
    monkeypatch.setenv("APP_CORS_ORIGINS", "http://a.com,http://b.com")

    settings = Settings()

    assert settings.database_url == "postgresql+asyncpg://u:p@host/db"
    assert settings.jwt_secret == "x" * 32
    assert settings.otp_pepper == "pepper"
    assert settings.app_cors_origins == ["http://a.com", "http://b.com"]
    assert settings.otp_code_length == 6
    assert settings.otp_ttl_minutes == 10


def test_settings_rejects_short_jwt_secret(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://u:p@host/db")
    monkeypatch.setenv("JWT_SECRET", "short")
    monkeypatch.setenv("OTP_PEPPER", "pepper")
    monkeypatch.setenv("SMTP_FROM", "noreply@example.com")
    with pytest.raises(ValidationError):
        Settings()
```

- [ ] **Step 3.3: Запустить тест — должен падать**

```bash
uv run pytest tests/unit/test_config.py -v
# ожидание: ModuleNotFoundError или ImportError (app.config ещё нет)
```

- [ ] **Step 3.4: Создать `app/config.py`**

```python
from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # App
    app_env: Literal["development", "production"] = "development"
    app_host: str = "0.0.0.0"
    app_port: int = 8080
    app_cors_origins: list[str] = Field(default_factory=list)

    # Database
    database_url: str

    # JWT
    jwt_secret: str = Field(min_length=32)
    jwt_algorithm: str = "HS256"
    jwt_ttl_hours: int = 168
    jwt_cookie_name: str = "access_token"
    jwt_cookie_secure: bool = False
    jwt_cookie_samesite: Literal["lax", "strict", "none"] = "lax"

    # OTP
    otp_pepper: str
    otp_ttl_minutes: int = 10
    otp_max_attempts: int = 5
    otp_request_limit: int = 3
    otp_request_window_min: int = 15
    otp_code_length: int = 6

    # Email
    email_backend: Literal["smtp", "console"] = "smtp"
    smtp_host: str = "localhost"
    smtp_port: int = 1025
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str
    smtp_tls: bool = False

    @field_validator("app_cors_origins", mode="before")
    @classmethod
    def _split_cors(cls, v: str | list[str]) -> list[str]:
        if isinstance(v, str):
            return [o.strip() for o in v.split(",") if o.strip()]
        return v


@lru_cache
def get_settings() -> Settings:
    return Settings()
```

- [ ] **Step 3.5: Запустить тесты — должны пройти**

```bash
uv run pytest tests/unit/test_config.py -v
# ожидание: 2 passed
```

- [ ] **Step 3.6: Commit**

```bash
cd ..
git add backend/app backend/tests
git commit -m "feat(backend): add Settings from env with validation"
```

---

## Task 4: Logging (structlog)

**Files:**
- Create: `backend/app/core/__init__.py`
- Create: `backend/app/core/logging.py`
- Create: `backend/tests/unit/test_logging.py`

- [ ] **Step 4.1: Создать пустой __init__.py**

```bash
cd backend
mkdir -p app/core
touch app/core/__init__.py
```

- [ ] **Step 4.2: Написать failing test `tests/unit/test_logging.py`**

```python
import logging

from app.core.logging import configure_logging, get_logger


def test_get_logger_returns_bound_logger():
    configure_logging(level="INFO", json_logs=False)
    logger = get_logger("test")
    assert logger is not None
    # smoke: не падает
    logger.info("hello", foo="bar")


def test_configure_logging_sets_level():
    configure_logging(level="DEBUG", json_logs=False)
    assert logging.getLogger().level == logging.DEBUG
```

- [ ] **Step 4.3: Запустить — fail**

```bash
uv run pytest tests/unit/test_logging.py -v
# ожидание: ImportError
```

- [ ] **Step 4.4: Создать `app/core/logging.py`**

```python
from __future__ import annotations

import logging
import sys
from typing import Any

import structlog


def configure_logging(level: str = "INFO", json_logs: bool = False) -> None:
    level_int = getattr(logging, level.upper(), logging.INFO)

    timestamper = structlog.processors.TimeStamper(fmt="iso", utc=True)

    shared_processors: list[Any] = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        timestamper,
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
    ]

    if json_logs:
        renderer: Any = structlog.processors.JSONRenderer()
    else:
        renderer = structlog.dev.ConsoleRenderer(colors=sys.stdout.isatty())

    structlog.configure(
        processors=[*shared_processors, renderer],
        wrapper_class=structlog.make_filtering_bound_logger(level_int),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )

    # Проксируем stdlib logging в structlog, чтобы uvicorn/sqlalchemy логи не ломали формат.
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=level_int,
        force=True,
    )


def get_logger(name: str | None = None) -> structlog.stdlib.BoundLogger:
    return structlog.get_logger(name)
```

- [ ] **Step 4.5: Добавить structlog в deps (если не было — уже было в Task 1)**

Пропустить, уже в pyproject.toml.

- [ ] **Step 4.6: Запустить тесты — pass**

```bash
uv run pytest tests/unit/test_logging.py -v
# ожидание: 2 passed
```

- [ ] **Step 4.7: Commit**

```bash
cd ..
git add backend/app/core backend/tests/unit/test_logging.py
git commit -m "feat(backend): add structlog configuration"
```

---

## Task 5: Custom exceptions

**Files:**
- Create: `backend/app/core/exceptions.py`
- Create: `backend/tests/unit/test_exceptions.py`

- [ ] **Step 5.1: Написать failing test `tests/unit/test_exceptions.py`**

```python
import pytest

from app.core.exceptions import (
    AppException,
    NotFoundError,
    UnauthorizedError,
    BadRequestError,
    RateLimitError,
)


def test_app_exception_carries_code_and_status():
    exc = AppException(code="X", message="m", status_code=418)
    assert exc.code == "X"
    assert exc.message == "m"
    assert exc.status_code == 418
    assert str(exc) == "m"


def test_not_found_defaults():
    exc = NotFoundError("missing")
    assert exc.status_code == 404
    assert exc.code == "NOT_FOUND"


def test_unauthorized_defaults():
    exc = UnauthorizedError()
    assert exc.status_code == 401
    assert exc.code == "UNAUTHORIZED"


def test_bad_request_defaults():
    exc = BadRequestError("bad")
    assert exc.status_code == 400
    assert exc.code == "BAD_REQUEST"


def test_rate_limit_defaults():
    exc = RateLimitError("slow down")
    assert exc.status_code == 429
    assert exc.code == "RATE_LIMITED"
```

- [ ] **Step 5.2: Запустить — fail**

```bash
cd backend
uv run pytest tests/unit/test_exceptions.py -v
# ожидание: ImportError
```

- [ ] **Step 5.3: Создать `app/core/exceptions.py`**

```python
from __future__ import annotations


class AppException(Exception):
    """Domain-level exception that maps cleanly to an HTTP response."""

    code: str = "APP_ERROR"
    status_code: int = 500
    message: str = "Application error"

    def __init__(
        self,
        message: str | None = None,
        *,
        code: str | None = None,
        status_code: int | None = None,
    ) -> None:
        if message is not None:
            self.message = message
        if code is not None:
            self.code = code
        if status_code is not None:
            self.status_code = status_code
        super().__init__(self.message)


class NotFoundError(AppException):
    code = "NOT_FOUND"
    status_code = 404
    message = "Resource not found"


class UnauthorizedError(AppException):
    code = "UNAUTHORIZED"
    status_code = 401
    message = "Authentication required"


class BadRequestError(AppException):
    code = "BAD_REQUEST"
    status_code = 400
    message = "Bad request"


class RateLimitError(AppException):
    code = "RATE_LIMITED"
    status_code = 429
    message = "Too many requests"
```

- [ ] **Step 5.4: Запустить — pass**

```bash
uv run pytest tests/unit/test_exceptions.py -v
# ожидание: 5 passed
```

- [ ] **Step 5.5: Commit**

```bash
cd ..
git add backend/app/core/exceptions.py backend/tests/unit/test_exceptions.py
git commit -m "feat(backend): add domain exceptions hierarchy"
```

---

## Task 6: FastAPI app factory + /health endpoint

**Files:**
- Create: `backend/app/api/__init__.py`
- Create: `backend/app/api/v1/__init__.py`
- Create: `backend/app/api/v1/health.py`
- Create: `backend/app/api/v1/router.py`
- Create: `backend/app/main.py`
- Create: `backend/tests/integration/__init__.py` (если не создан)
- Create: `backend/tests/integration/test_health.py`
- Create: `backend/tests/conftest.py`

- [ ] **Step 6.1: Создать __init__ файлы**

```bash
cd backend
mkdir -p app/api/v1
touch app/api/__init__.py app/api/v1/__init__.py
```

- [ ] **Step 6.2: Написать failing test `tests/integration/test_health.py`**

```python
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_endpoint_returns_ok(async_client: AsyncClient):
    response = await async_client.get("/api/v1/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
```

- [ ] **Step 6.3: Создать `tests/conftest.py`**

```python
from __future__ import annotations

import asyncio
from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.main import create_app


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture
async def async_client() -> AsyncGenerator[AsyncClient, None]:
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
```

- [ ] **Step 6.4: Запустить — fail**

```bash
uv run pytest tests/integration/test_health.py -v
# ожидание: ImportError app.main
```

- [ ] **Step 6.5: Создать `app/api/v1/health.py`**

```python
from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health", summary="Liveness probe")
async def health() -> dict[str, str]:
    return {"status": "ok"}
```

- [ ] **Step 6.6: Создать `app/api/v1/router.py`**

```python
from __future__ import annotations

from fastapi import APIRouter

from app.api.v1 import health

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(health.router)
```

- [ ] **Step 6.7: Создать `app/main.py`**

```python
from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.router import api_router
from app.config import get_settings
from app.core.exceptions import AppException
from app.core.logging import configure_logging, get_logger


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging(
        level="DEBUG" if settings.app_env == "development" else "INFO",
        json_logs=settings.app_env == "production",
    )

    app = FastAPI(
        title="Nova API",
        version="0.1.0",
        docs_url="/api/docs" if settings.app_env == "development" else None,
        redoc_url=None,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.app_cors_origins or ["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.exception_handler(AppException)
    async def app_exception_handler(_: Request, exc: AppException) -> JSONResponse:
        logger = get_logger("app.errors")
        logger.warning("app_exception", code=exc.code, message=exc.message)
        return JSONResponse(
            status_code=exc.status_code,
            content={"code": exc.code, "message": exc.message},
        )

    app.include_router(api_router)
    return app


app = create_app()
```

- [ ] **Step 6.8: Запустить — pass**

```bash
uv run pytest tests/integration/test_health.py -v
# ожидание: 1 passed
```

- [ ] **Step 6.9: Поднять сервер вручную и проверить**

```bash
uv run uvicorn app.main:app --port 8080 &
sleep 2
curl -s http://localhost:8080/api/v1/health
# ожидание: {"status":"ok"}
curl -s http://localhost:8080/api/docs | head -5
# ожидание: HTML-страница Swagger UI

# Остановить:
kill %1
```

- [ ] **Step 6.10: Commit**

```bash
cd ..
git add backend/app backend/tests
git commit -m "feat(backend): FastAPI app factory with /health and exception handler"
```

---

## Task 7: DB base + session + Alembic

**Files:**
- Create: `backend/app/db/__init__.py`
- Create: `backend/app/db/base.py`
- Create: `backend/app/db/session.py`
- Create: `backend/alembic.ini`
- Create: `backend/app/alembic/env.py`
- Create: `backend/app/alembic/script.py.mako`
- Create: `backend/app/alembic/versions/` (директория)

- [ ] **Step 7.1: Создать папки**

```bash
cd backend
mkdir -p app/db app/alembic/versions
touch app/db/__init__.py
```

- [ ] **Step 7.2: Создать `app/db/base.py`**

```python
from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """Declarative base for all ORM models."""


class UuidPkMixin:
    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )


class TimestampsMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
```

- [ ] **Step 7.3: Создать `app/db/session.py`**

```python
from __future__ import annotations

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.config import get_settings


def _make_engine():
    settings = get_settings()
    return create_async_engine(
        settings.database_url,
        echo=False,
        pool_pre_ping=True,
        pool_size=10,
        max_overflow=20,
    )


engine = _make_engine()
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session
```

- [ ] **Step 7.4: Инициализировать alembic**

```bash
uv run alembic init -t async app/alembic
# создаст alembic.ini, app/alembic/env.py, app/alembic/script.py.mako
```

- [ ] **Step 7.5: Отредактировать `alembic.ini` — установить `script_location`**

Найти строку `script_location = alembic` и заменить на:

```ini
script_location = app/alembic
```

И удалить строку `sqlalchemy.url = driver://user:pass@localhost/dbname` (URL возьмём из settings в env.py).

- [ ] **Step 7.6: Переписать `app/alembic/env.py`**

Заменить весь файл на:

```python
from __future__ import annotations

import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from app.config import get_settings
from app.db.base import Base

# --- импорт всех моделей, чтобы autogenerate их видел ---
from app.db import models  # noqa: F401

config = context.config
config.set_main_option("sqlalchemy.url", get_settings().database_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

- [ ] **Step 7.7: Создать пустой `app/db/models.py` (наполним в следующей таске)**

```python
from __future__ import annotations

# ORM models go here. Re-exports are added as models are introduced.

__all__: list[str] = []
```

- [ ] **Step 7.8: Smoke-тест — alembic умеет сгенерить пустую миграцию**

```bash
docker compose up -d postgres
uv run alembic revision -m "bootstrap" --autogenerate
# создаст файл в app/alembic/versions/ вида xxxx_bootstrap.py

uv run alembic upgrade head
# ожидание: INFO [alembic.runtime.migration] ... Running upgrade  -> xxxx, bootstrap
```

- [ ] **Step 7.9: Commit**

```bash
cd ..
git add backend/app/db backend/app/alembic backend/alembic.ini
git commit -m "feat(backend): add SQLAlchemy async base and Alembic"
```

---

## Task 8: ORM models (User, OtpCode, Chat, Message)

**Files:**
- Modify: `backend/app/db/models.py`
- Create: `backend/tests/integration/test_models.py`
- Create: `backend/app/alembic/versions/<autogen>_init_schema.py` (via autogenerate)

> **Важно для тестов БД:** интеграционные тесты используют реальный postgres (по `DATABASE_URL`). Для изоляции создаём отдельную схему/БД per run. Здесь — используем существующую nova БД, но внутри каждого теста откатываемся транзакцией через fixture.

- [ ] **Step 8.1: Написать failing test `tests/integration/test_models.py`**

```python
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

import pytest
from sqlalchemy import select

from app.db.models import Chat, Message, OtpCode, User


@pytest.mark.asyncio
async def test_create_user(db_session):
    user = User(email="a@b.com")
    db_session.add(user)
    await db_session.flush()

    assert isinstance(user.id, UUID)
    assert user.email == "a@b.com"
    assert user.created_at is not None


@pytest.mark.asyncio
async def test_create_otp_code(db_session):
    otp = OtpCode(
        email="a@b.com",
        code_hash="x" * 64,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=10),
    )
    db_session.add(otp)
    await db_session.flush()

    assert otp.id is not None
    assert otp.attempts == 0
    assert otp.consumed_at is None


@pytest.mark.asyncio
async def test_create_chat_with_messages(db_session):
    user = User(email="a@b.com")
    db_session.add(user)
    await db_session.flush()

    chat = Chat(user_id=user.id, title="Hello")
    db_session.add(chat)
    await db_session.flush()

    msg1 = Message(chat_id=chat.id, role="user", content="Hi")
    msg2 = Message(chat_id=chat.id, role="assistant", content="Hello!")
    db_session.add_all([msg1, msg2])
    await db_session.flush()

    result = await db_session.execute(
        select(Message).where(Message.chat_id == chat.id).order_by(Message.created_at)
    )
    messages = list(result.scalars())
    assert len(messages) == 2
    assert messages[0].content == "Hi"
    assert messages[1].aborted is False


@pytest.mark.asyncio
async def test_user_email_is_unique(db_session):
    from sqlalchemy.exc import IntegrityError

    db_session.add(User(email="dup@x.com"))
    await db_session.flush()
    db_session.add(User(email="dup@x.com"))
    with pytest.raises(IntegrityError):
        await db_session.flush()
```

- [ ] **Step 8.2: Добавить fixture `db_session` в `tests/conftest.py`**

Заменить `conftest.py` на:

```python
from __future__ import annotations

import asyncio
from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import get_settings
from app.db.base import Base
from app.main import create_app


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session")
async def db_engine():
    settings = get_settings()
    engine = create_async_engine(settings.database_url, echo=False)
    # создаём схему один раз на сессию тестов (через метаданные, не через alembic —
    # alembic покрывается отдельным smoke-тестом)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(db_engine) -> AsyncGenerator[AsyncSession, None]:
    """Каждый тест — отдельная транзакция, откатываемая в конце."""
    connection = await db_engine.connect()
    trans = await connection.begin()
    Session = async_sessionmaker(bind=connection, expire_on_commit=False)
    async with Session() as session:
        try:
            yield session
        finally:
            await trans.rollback()
            await connection.close()


@pytest_asyncio.fixture
async def async_client(db_session) -> AsyncGenerator[AsyncClient, None]:
    from app.db.session import get_session

    app = create_app()
    app.dependency_overrides[get_session] = lambda: _override_session(db_session)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


async def _override_session(session: AsyncSession):
    yield session
```

- [ ] **Step 8.3: Запустить тест — fail**

```bash
cd backend
uv run pytest tests/integration/test_models.py -v
# ожидание: ImportError (User не определён)
```

- [ ] **Step 8.4: Реализовать `app/db/models.py`**

Заменить файл на:

```python
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampsMixin, UuidPkMixin


class User(UuidPkMixin, Base):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    chats: Mapped[list["Chat"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )


class OtpCode(UuidPkMixin, Base):
    __tablename__ = "otp_codes"

    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    code_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    consumed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        index=True,
    )


class Chat(UuidPkMixin, TimestampsMixin, Base):
    __tablename__ = "chats"

    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False, default="New chat")

    user: Mapped["User"] = relationship(back_populates="chats")
    messages: Mapped[list["Message"]] = relationship(
        back_populates="chat",
        cascade="all, delete-orphan",
        order_by="Message.created_at",
    )


class Message(UuidPkMixin, Base):
    __tablename__ = "messages"

    chat_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("chats.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role: Mapped[str] = mapped_column(String(16), nullable=False)
    content: Mapped[str] = mapped_column(String, nullable=False)
    aborted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    chat: Mapped["Chat"] = relationship(back_populates="messages")


__all__ = ["User", "OtpCode", "Chat", "Message"]
```

- [ ] **Step 8.5: Запустить тесты**

```bash
uv run pytest tests/integration/test_models.py -v
# ожидание: 4 passed
```

- [ ] **Step 8.6: Сгенерировать Alembic миграцию**

Удалить bootstrap-миграцию из Task 7 (была пустая smoke-миграция), затем:

```bash
rm -f app/alembic/versions/*bootstrap*.py
uv run alembic revision --autogenerate -m "init schema"
# создаст файл типа app/alembic/versions/<hash>_init_schema.py

# Сбросить БД (т.к. тесты могли создать таблицы через create_all) и применить миграцию:
docker compose down -v
docker compose up -d postgres
sleep 3
uv run alembic upgrade head
# ожидание: Running upgrade  -> <hash>, init schema
```

- [ ] **Step 8.7: Проверить что миграция корректная**

```bash
docker compose exec postgres psql -U nova -d nova -c "\dt"
# ожидание: 5 таблиц (alembic_version, users, otp_codes, chats, messages)

docker compose exec postgres psql -U nova -d nova -c "\d users"
# ожидание: колонки id, email, created_at + unique на email
```

- [ ] **Step 8.8: Смоук-тест через pytest** (схема уже актуальна из create_all; миграция — отдельный путь):

```bash
uv run pytest tests/integration/test_models.py -v
# ожидание: 4 passed
```

- [ ] **Step 8.9: Commit**

```bash
cd ..
git add backend/app/db/models.py backend/app/alembic/versions backend/tests
git commit -m "feat(backend): add User/OtpCode/Chat/Message models + init migration"
```

---

## Task 9: OtpService (pure unit)

**Files:**
- Create: `backend/app/services/__init__.py`
- Create: `backend/app/services/otp_service.py`
- Create: `backend/tests/unit/test_otp_service.py`

- [ ] **Step 9.1: Создать __init__**

```bash
cd backend
mkdir -p app/services
touch app/services/__init__.py
```

- [ ] **Step 9.2: Написать failing test**

```python
# tests/unit/test_otp_service.py
from __future__ import annotations

from app.services.otp_service import generate_code, hash_code, verify_code


def test_generate_code_has_expected_length():
    for length in (4, 6, 8):
        code = generate_code(length=length)
        assert len(code) == length
        assert code.isdigit()


def test_generate_code_randomness_smoke():
    codes = {generate_code() for _ in range(50)}
    assert len(codes) > 40  # крайне маловероятно совпадение


def test_hash_and_verify_round_trip():
    code = "123456"
    pepper = "dev-pepper"
    h = hash_code(code, pepper=pepper)
    assert verify_code(code, h, pepper=pepper) is True


def test_verify_rejects_wrong_code():
    h = hash_code("123456", pepper="p")
    assert verify_code("000000", h, pepper="p") is False


def test_verify_rejects_wrong_pepper():
    h = hash_code("123456", pepper="p1")
    assert verify_code("123456", h, pepper="p2") is False


def test_hash_is_hex_fixed_length():
    h = hash_code("123456", pepper="x")
    assert len(h) == 64
    int(h, 16)  # valid hex
```

- [ ] **Step 9.3: Запустить — fail**

```bash
uv run pytest tests/unit/test_otp_service.py -v
# ImportError
```

- [ ] **Step 9.4: Реализовать `app/services/otp_service.py`**

```python
from __future__ import annotations

import hashlib
import hmac
import secrets


def generate_code(length: int = 6) -> str:
    """Cryptographically-secure numeric OTP of the given length."""
    if length < 4 or length > 10:
        raise ValueError("OTP length must be between 4 and 10")
    upper = 10**length
    value = secrets.randbelow(upper)
    return str(value).zfill(length)


def hash_code(code: str, *, pepper: str) -> str:
    """sha256(code + pepper) → hex digest."""
    return hashlib.sha256(f"{code}{pepper}".encode()).hexdigest()


def verify_code(code: str, expected_hash: str, *, pepper: str) -> bool:
    return hmac.compare_digest(hash_code(code, pepper=pepper), expected_hash)
```

- [ ] **Step 9.5: Запустить — pass**

```bash
uv run pytest tests/unit/test_otp_service.py -v
# 6 passed
```

- [ ] **Step 9.6: Commit**

```bash
cd ..
git add backend/app/services backend/tests/unit/test_otp_service.py
git commit -m "feat(backend): OTP generate/hash/verify helpers"
```

---

## Task 10: EmailSender (Protocol + Console + SMTP)

**Files:**
- Create: `backend/app/services/email/__init__.py`
- Create: `backend/app/services/email/base.py`
- Create: `backend/app/services/email/console.py`
- Create: `backend/app/services/email/smtp.py`
- Create: `backend/tests/unit/test_email_console.py`
- Create: `backend/tests/integration/test_email_smtp.py`

- [ ] **Step 10.1: Создать пустой __init__**

```bash
cd backend
mkdir -p app/services/email
touch app/services/email/__init__.py
```

- [ ] **Step 10.2: Failing test для Console sender**

```python
# tests/unit/test_email_console.py
from __future__ import annotations

import pytest

from app.services.email.console import ConsoleSender


@pytest.mark.asyncio
async def test_console_sender_logs_otp(capsys):
    sender = ConsoleSender(from_addr="noreply@test")
    await sender.send_otp(to="a@b.com", code="123456")
    captured = capsys.readouterr()
    assert "a@b.com" in captured.out
    assert "123456" in captured.out
```

- [ ] **Step 10.3: Failing test для SMTP sender (интеграционный, требует Mailpit)**

```python
# tests/integration/test_email_smtp.py
from __future__ import annotations

import httpx
import pytest

from app.services.email.smtp import SMTPSender


@pytest.mark.asyncio
async def test_smtp_sender_delivers_to_mailpit():
    # очищаем Mailpit перед тестом
    async with httpx.AsyncClient() as http:
        await http.delete("http://localhost:8025/api/v1/messages")

    sender = SMTPSender(
        host="localhost",
        port=1025,
        username="",
        password="",
        from_addr="noreply@nova.local",
        use_tls=False,
    )
    await sender.send_otp(to="user@test.com", code="654321")

    # проверяем что письмо долетело
    async with httpx.AsyncClient() as http:
        resp = await http.get("http://localhost:8025/api/v1/messages")
    assert resp.status_code == 200
    messages = resp.json()["messages"]
    assert len(messages) == 1
    assert messages[0]["To"][0]["Address"] == "user@test.com"
    assert "654321" in messages[0]["Snippet"]
```

- [ ] **Step 10.4: Запустить — fail**

```bash
uv run pytest tests/unit/test_email_console.py tests/integration/test_email_smtp.py -v
# ImportError
```

- [ ] **Step 10.5: Создать `base.py`**

```python
# app/services/email/base.py
from __future__ import annotations

from typing import Protocol


class EmailSender(Protocol):
    async def send_otp(self, *, to: str, code: str) -> None: ...
```

- [ ] **Step 10.6: Создать `console.py`**

```python
# app/services/email/console.py
from __future__ import annotations


class ConsoleSender:
    def __init__(self, *, from_addr: str) -> None:
        self._from = from_addr

    async def send_otp(self, *, to: str, code: str) -> None:
        # stdout намеренно — это dev-fallback
        print(f"[EMAIL] from={self._from} to={to} OTP={code}")
```

- [ ] **Step 10.7: Создать `smtp.py`**

```python
# app/services/email/smtp.py
from __future__ import annotations

from email.message import EmailMessage

import aiosmtplib


class SMTPSender:
    def __init__(
        self,
        *,
        host: str,
        port: int,
        username: str,
        password: str,
        from_addr: str,
        use_tls: bool,
    ) -> None:
        self._host = host
        self._port = port
        self._username = username
        self._password = password
        self._from = from_addr
        self._use_tls = use_tls

    async def send_otp(self, *, to: str, code: str) -> None:
        msg = EmailMessage()
        msg["From"] = self._from
        msg["To"] = to
        msg["Subject"] = f"Your Nova login code: {code}"
        msg.set_content(
            f"Your one-time login code is: {code}\n\n"
            f"It expires in a few minutes. If you did not request it, ignore this email.\n"
        )

        await aiosmtplib.send(
            msg,
            hostname=self._host,
            port=self._port,
            username=self._username or None,
            password=self._password or None,
            use_tls=self._use_tls,
            start_tls=False,
        )
```

- [ ] **Step 10.8: Запустить — pass**

```bash
docker compose up -d mailpit
uv run pytest tests/unit/test_email_console.py tests/integration/test_email_smtp.py -v
# 2 passed
```

- [ ] **Step 10.9: Commit**

```bash
cd ..
git add backend/app/services/email backend/tests
git commit -m "feat(backend): EmailSender protocol + Console and SMTP implementations"
```

---

## Task 11: JWT security helpers

**Files:**
- Create: `backend/app/core/security.py`
- Create: `backend/tests/unit/test_security.py`

- [ ] **Step 11.1: Failing test**

```python
# tests/unit/test_security.py
from __future__ import annotations

from datetime import timedelta
from uuid import uuid4

import pytest

from app.core.exceptions import UnauthorizedError
from app.core.security import decode_access_token, encode_access_token


def test_encode_decode_round_trip():
    user_id = uuid4()
    token = encode_access_token(
        user_id=user_id,
        secret="x" * 32,
        algorithm="HS256",
        ttl=timedelta(hours=1),
    )
    payload = decode_access_token(token, secret="x" * 32, algorithm="HS256")
    assert payload["sub"] == str(user_id)


def test_decode_rejects_wrong_secret():
    user_id = uuid4()
    token = encode_access_token(
        user_id=user_id,
        secret="x" * 32,
        algorithm="HS256",
        ttl=timedelta(hours=1),
    )
    with pytest.raises(UnauthorizedError):
        decode_access_token(token, secret="y" * 32, algorithm="HS256")


def test_decode_rejects_expired_token():
    user_id = uuid4()
    token = encode_access_token(
        user_id=user_id,
        secret="x" * 32,
        algorithm="HS256",
        ttl=timedelta(seconds=-1),
    )
    with pytest.raises(UnauthorizedError):
        decode_access_token(token, secret="x" * 32, algorithm="HS256")


def test_decode_rejects_malformed_token():
    with pytest.raises(UnauthorizedError):
        decode_access_token("not-a-jwt", secret="x" * 32, algorithm="HS256")
```

- [ ] **Step 11.2: Запустить — fail**

```bash
cd backend
uv run pytest tests/unit/test_security.py -v
# ImportError
```

- [ ] **Step 11.3: Реализовать `app/core/security.py`**

```python
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

import jwt
from jwt.exceptions import InvalidTokenError

from app.core.exceptions import UnauthorizedError


def encode_access_token(
    *,
    user_id: UUID,
    secret: str,
    algorithm: str,
    ttl: timedelta,
) -> str:
    now = datetime.now(tz=timezone.utc)
    payload = {
        "sub": str(user_id),
        "iat": int(now.timestamp()),
        "exp": int((now + ttl).timestamp()),
    }
    return jwt.encode(payload, secret, algorithm=algorithm)


def decode_access_token(
    token: str,
    *,
    secret: str,
    algorithm: str,
) -> dict[str, Any]:
    try:
        return jwt.decode(token, secret, algorithms=[algorithm])
    except InvalidTokenError as exc:
        raise UnauthorizedError("Invalid or expired token") from exc


def cookie_kwargs(
    *,
    secure: bool,
    samesite: str,
    max_age_seconds: int,
) -> dict[str, Any]:
    return {
        "httponly": True,
        "secure": secure,
        "samesite": samesite,
        "max_age": max_age_seconds,
        "path": "/",
    }
```

- [ ] **Step 11.4: Запустить — pass**

```bash
uv run pytest tests/unit/test_security.py -v
# 4 passed
```

- [ ] **Step 11.5: Commit**

```bash
cd ..
git add backend/app/core/security.py backend/tests/unit/test_security.py
git commit -m "feat(backend): JWT encode/decode + cookie kwargs helper"
```

---

## Task 12: Auth schemas (Pydantic DTOs)

**Files:**
- Create: `backend/app/schemas/__init__.py`
- Create: `backend/app/schemas/auth.py`
- Create: `backend/tests/unit/test_auth_schemas.py`

- [ ] **Step 12.1: Failing test**

```python
# tests/unit/test_auth_schemas.py
from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.schemas.auth import MeOut, RequestOtpIn, UserOut, VerifyOtpIn


def test_request_otp_in_valid():
    dto = RequestOtpIn(email="User@Example.COM")
    assert dto.email == "user@example.com"  # нормализация


def test_request_otp_in_rejects_bad_email():
    with pytest.raises(ValidationError):
        RequestOtpIn(email="not-an-email")


def test_verify_otp_in_requires_6_digits():
    VerifyOtpIn(email="a@b.com", code="123456")
    with pytest.raises(ValidationError):
        VerifyOtpIn(email="a@b.com", code="12345")
    with pytest.raises(ValidationError):
        VerifyOtpIn(email="a@b.com", code="abcdef")


def test_me_out_has_user_field():
    from uuid import uuid4

    uid = uuid4()
    out = MeOut(user=UserOut(id=uid, email="a@b.com"))
    assert out.user.email == "a@b.com"
    assert out.user.id == uid
```

- [ ] **Step 12.2: Запустить — fail**

```bash
cd backend
uv run pytest tests/unit/test_auth_schemas.py -v
```

- [ ] **Step 12.3: Создать `__init__`**

```bash
mkdir -p app/schemas
touch app/schemas/__init__.py
```

- [ ] **Step 12.4: Реализовать `app/schemas/auth.py`**

```python
from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class RequestOtpIn(BaseModel):
    email: EmailStr

    @field_validator("email", mode="before")
    @classmethod
    def _lower(cls, v: str) -> str:
        return v.strip().lower() if isinstance(v, str) else v


class VerifyOtpIn(BaseModel):
    email: EmailStr
    code: str = Field(pattern=r"^\d{4,10}$")

    @field_validator("email", mode="before")
    @classmethod
    def _lower(cls, v: str) -> str:
        return v.strip().lower() if isinstance(v, str) else v


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: EmailStr


class MeOut(BaseModel):
    user: UserOut
```

- [ ] **Step 12.5: Установить email-validator (не было в deps)**

```bash
uv add "pydantic[email]"
# или: uv add email-validator
```

- [ ] **Step 12.6: Запустить — pass**

```bash
uv run pytest tests/unit/test_auth_schemas.py -v
# 4 passed
```

- [ ] **Step 12.7: Commit**

```bash
cd ..
git add backend/app/schemas backend/tests/unit/test_auth_schemas.py backend/pyproject.toml backend/uv.lock
git commit -m "feat(backend): auth Pydantic DTOs"
```

---

## Task 13: AuthService — request_otp

**Files:**
- Create: `backend/app/services/auth_service.py`
- Create: `backend/tests/integration/test_auth_service_request.py`

- [ ] **Step 13.1: Failing test**

```python
# tests/integration/test_auth_service_request.py
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock

import pytest
from sqlalchemy import select

from app.core.exceptions import RateLimitError
from app.db.models import OtpCode
from app.services.auth_service import AuthService


def _make_service(session, sender: AsyncMock, **overrides) -> AuthService:
    return AuthService(
        session=session,
        email_sender=sender,
        pepper="test-pepper",
        code_length=6,
        ttl_minutes=10,
        request_limit=3,
        request_window_minutes=15,
        jwt_secret="x" * 32,
        jwt_algorithm="HS256",
        jwt_ttl_hours=168,
        **overrides,
    )


@pytest.mark.asyncio
async def test_request_otp_sends_email_and_stores_hash(db_session):
    sender = AsyncMock()
    service = _make_service(db_session, sender)

    await service.request_otp(email="A@B.com")

    sender.send_otp.assert_awaited_once()
    kwargs = sender.send_otp.await_args.kwargs
    assert kwargs["to"] == "a@b.com"
    code = kwargs["code"]
    assert len(code) == 6

    stored = (await db_session.execute(select(OtpCode))).scalars().all()
    assert len(stored) == 1
    assert stored[0].email == "a@b.com"
    assert stored[0].code_hash != code  # хеш, не plain
    assert stored[0].consumed_at is None


@pytest.mark.asyncio
async def test_request_otp_normalizes_email(db_session):
    sender = AsyncMock()
    service = _make_service(db_session, sender)
    await service.request_otp(email="  User@Example.COM  ")
    stored = (await db_session.execute(select(OtpCode))).scalars().first()
    assert stored.email == "user@example.com"


@pytest.mark.asyncio
async def test_request_otp_rate_limit(db_session):
    sender = AsyncMock()
    service = _make_service(db_session, sender, request_limit=2)

    await service.request_otp(email="a@b.com")
    await service.request_otp(email="a@b.com")

    with pytest.raises(RateLimitError):
        await service.request_otp(email="a@b.com")


@pytest.mark.asyncio
async def test_request_otp_rate_limit_scoped_by_email(db_session):
    sender = AsyncMock()
    service = _make_service(db_session, sender, request_limit=1)

    await service.request_otp(email="a@b.com")
    # другой email — не должен попасть под лимит
    await service.request_otp(email="b@c.com")
```

- [ ] **Step 13.2: Запустить — fail**

```bash
cd backend
uv run pytest tests/integration/test_auth_service_request.py -v
```

- [ ] **Step 13.3: Реализовать `app/services/auth_service.py` (request_otp часть)**

```python
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BadRequestError, RateLimitError, UnauthorizedError
from app.core.security import encode_access_token
from app.db.models import OtpCode, User
from app.services.email.base import EmailSender
from app.services.otp_service import generate_code, hash_code, verify_code


class AuthService:
    def __init__(
        self,
        *,
        session: AsyncSession,
        email_sender: EmailSender,
        pepper: str,
        code_length: int,
        ttl_minutes: int,
        request_limit: int,
        request_window_minutes: int,
        jwt_secret: str,
        jwt_algorithm: str,
        jwt_ttl_hours: int,
        max_attempts: int = 5,
    ) -> None:
        self._session = session
        self._sender = email_sender
        self._pepper = pepper
        self._code_length = code_length
        self._ttl = timedelta(minutes=ttl_minutes)
        self._request_limit = request_limit
        self._request_window = timedelta(minutes=request_window_minutes)
        self._jwt_secret = jwt_secret
        self._jwt_algorithm = jwt_algorithm
        self._jwt_ttl = timedelta(hours=jwt_ttl_hours)
        self._max_attempts = max_attempts

    @staticmethod
    def _normalize_email(email: str) -> str:
        return email.strip().lower()

    async def request_otp(self, *, email: str) -> None:
        email = self._normalize_email(email)
        await self._check_rate_limit(email)

        code = generate_code(length=self._code_length)
        record = OtpCode(
            email=email,
            code_hash=hash_code(code, pepper=self._pepper),
            expires_at=datetime.now(tz=timezone.utc) + self._ttl,
        )
        self._session.add(record)
        await self._session.flush()

        await self._sender.send_otp(to=email, code=code)

    async def _check_rate_limit(self, email: str) -> None:
        since = datetime.now(tz=timezone.utc) - self._request_window
        stmt = select(func.count()).select_from(OtpCode).where(
            OtpCode.email == email,
            OtpCode.created_at >= since,
        )
        count = (await self._session.execute(stmt)).scalar_one()
        if count >= self._request_limit:
            raise RateLimitError("Too many OTP requests. Try again later.")
```

- [ ] **Step 13.4: Запустить — pass**

```bash
uv run pytest tests/integration/test_auth_service_request.py -v
# 4 passed
```

- [ ] **Step 13.5: Commit**

```bash
cd ..
git add backend/app/services/auth_service.py backend/tests/integration/test_auth_service_request.py
git commit -m "feat(backend): AuthService.request_otp with rate limit"
```

---

## Task 14: AuthService — verify_otp

**Files:**
- Modify: `backend/app/services/auth_service.py`
- Create: `backend/tests/integration/test_auth_service_verify.py`

- [ ] **Step 14.1: Failing test**

```python
# tests/integration/test_auth_service_verify.py
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock

import pytest
from sqlalchemy import select

from app.core.exceptions import BadRequestError, UnauthorizedError
from app.core.security import decode_access_token
from app.db.models import OtpCode, User
from app.services.auth_service import AuthService


def _make_service(session, **overrides) -> AuthService:
    return AuthService(
        session=session,
        email_sender=AsyncMock(),
        pepper="p",
        code_length=6,
        ttl_minutes=10,
        request_limit=100,
        request_window_minutes=15,
        jwt_secret="x" * 32,
        jwt_algorithm="HS256",
        jwt_ttl_hours=168,
        **overrides,
    )


@pytest.mark.asyncio
async def test_verify_otp_creates_user_on_first_login(db_session):
    service = _make_service(db_session)
    await service.request_otp(email="new@x.com")
    sent_code = service._sender.send_otp.await_args.kwargs["code"]

    token, user = await service.verify_otp(email="new@x.com", code=sent_code)
    assert user.email == "new@x.com"
    payload = decode_access_token(token, secret="x" * 32, algorithm="HS256")
    assert payload["sub"] == str(user.id)


@pytest.mark.asyncio
async def test_verify_otp_reuses_existing_user(db_session):
    service = _make_service(db_session)
    existing = User(email="back@x.com")
    db_session.add(existing)
    await db_session.flush()

    await service.request_otp(email="back@x.com")
    code = service._sender.send_otp.await_args.kwargs["code"]

    _, user = await service.verify_otp(email="back@x.com", code=code)
    assert user.id == existing.id


@pytest.mark.asyncio
async def test_verify_otp_rejects_wrong_code(db_session):
    service = _make_service(db_session)
    await service.request_otp(email="a@b.com")

    with pytest.raises(BadRequestError):
        await service.verify_otp(email="a@b.com", code="000000")


@pytest.mark.asyncio
async def test_verify_otp_consumes_code(db_session):
    service = _make_service(db_session)
    await service.request_otp(email="a@b.com")
    code = service._sender.send_otp.await_args.kwargs["code"]

    await service.verify_otp(email="a@b.com", code=code)

    # второй verify тем же кодом — fail
    with pytest.raises(BadRequestError):
        await service.verify_otp(email="a@b.com", code=code)


@pytest.mark.asyncio
async def test_verify_otp_rejects_expired_code(db_session):
    service = _make_service(db_session, ttl_minutes=-1)  # уже просрочен
    await service.request_otp(email="a@b.com")
    code = service._sender.send_otp.await_args.kwargs["code"]

    with pytest.raises(BadRequestError):
        await service.verify_otp(email="a@b.com", code=code)


@pytest.mark.asyncio
async def test_verify_otp_max_attempts(db_session):
    service = _make_service(db_session, max_attempts=3)
    await service.request_otp(email="a@b.com")

    # 3 неудачных попытки — записываются в attempts
    for _ in range(3):
        with pytest.raises(BadRequestError):
            await service.verify_otp(email="a@b.com", code="000000")

    # теперь даже правильный код не должен работать
    correct = service._sender.send_otp.await_args.kwargs["code"]
    with pytest.raises(BadRequestError):
        await service.verify_otp(email="a@b.com", code=correct)
```

- [ ] **Step 14.2: Запустить — fail**

```bash
cd backend
uv run pytest tests/integration/test_auth_service_verify.py -v
# AttributeError: AuthService has no verify_otp
```

- [ ] **Step 14.3: Добавить `verify_otp` в `auth_service.py`**

Дописать в конец класса:

```python
    async def verify_otp(self, *, email: str, code: str) -> tuple[str, User]:
        email = self._normalize_email(email)

        otp = await self._get_active_otp(email)
        if otp is None:
            raise BadRequestError("No active OTP for this email")

        if otp.attempts >= self._max_attempts:
            raise BadRequestError("Too many attempts. Request a new code.")

        if datetime.now(tz=timezone.utc) >= otp.expires_at:
            raise BadRequestError("OTP expired. Request a new code.")

        if not verify_code(code, otp.code_hash, pepper=self._pepper):
            otp.attempts += 1
            await self._session.flush()
            raise BadRequestError("Invalid code")

        otp.consumed_at = datetime.now(tz=timezone.utc)
        await self._session.flush()

        user = await self._get_or_create_user(email)

        token = encode_access_token(
            user_id=user.id,
            secret=self._jwt_secret,
            algorithm=self._jwt_algorithm,
            ttl=self._jwt_ttl,
        )
        return token, user

    async def _get_active_otp(self, email: str) -> OtpCode | None:
        stmt = (
            select(OtpCode)
            .where(OtpCode.email == email, OtpCode.consumed_at.is_(None))
            .order_by(OtpCode.created_at.desc())
            .limit(1)
        )
        return (await self._session.execute(stmt)).scalar_one_or_none()

    async def _get_or_create_user(self, email: str) -> User:
        stmt = select(User).where(User.email == email)
        user = (await self._session.execute(stmt)).scalar_one_or_none()
        if user is None:
            user = User(email=email)
            self._session.add(user)
            await self._session.flush()
        return user
```

- [ ] **Step 14.4: Запустить — pass**

```bash
uv run pytest tests/integration/test_auth_service_verify.py -v
# 6 passed
```

- [ ] **Step 14.5: Commit**

```bash
cd ..
git add backend/app/services/auth_service.py backend/tests/integration/test_auth_service_verify.py
git commit -m "feat(backend): AuthService.verify_otp with attempts & expiry"
```

---

## Task 15: FastAPI dependencies (get_session, get_auth_service, get_current_user)

**Files:**
- Create: `backend/app/deps.py`
- Create: `backend/tests/unit/test_deps.py`

- [ ] **Step 15.1: Failing test (для get_current_user helper)**

```python
# tests/unit/test_deps.py
from __future__ import annotations

from uuid import uuid4

import pytest
from fastapi import Request

from app.config import Settings
from app.core.exceptions import UnauthorizedError
from app.core.security import encode_access_token
from app.deps import extract_user_id_from_request
from datetime import timedelta


def _make_settings() -> Settings:
    import os
    os.environ["DATABASE_URL"] = "postgresql+asyncpg://x:x@h/x"
    os.environ["JWT_SECRET"] = "x" * 32
    os.environ["OTP_PEPPER"] = "p"
    os.environ["SMTP_FROM"] = "x@x"
    from app.config import get_settings
    get_settings.cache_clear()
    return get_settings()


def _make_request(cookies: dict[str, str]) -> Request:
    scope = {
        "type": "http",
        "headers": [
            (b"cookie", "; ".join(f"{k}={v}" for k, v in cookies.items()).encode()),
        ],
    }
    return Request(scope)


def test_extract_user_id_from_valid_cookie():
    settings = _make_settings()
    uid = uuid4()
    token = encode_access_token(
        user_id=uid,
        secret=settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
        ttl=timedelta(hours=1),
    )
    req = _make_request({settings.jwt_cookie_name: token})
    assert extract_user_id_from_request(req, settings=settings) == uid


def test_extract_user_id_missing_cookie_raises():
    settings = _make_settings()
    req = _make_request({})
    with pytest.raises(UnauthorizedError):
        extract_user_id_from_request(req, settings=settings)


def test_extract_user_id_invalid_token_raises():
    settings = _make_settings()
    req = _make_request({settings.jwt_cookie_name: "garbage"})
    with pytest.raises(UnauthorizedError):
        extract_user_id_from_request(req, settings=settings)
```

- [ ] **Step 15.2: Запустить — fail**

```bash
cd backend
uv run pytest tests/unit/test_deps.py -v
```

- [ ] **Step 15.3: Реализовать `app/deps.py`**

```python
from __future__ import annotations

from collections.abc import AsyncGenerator
from uuid import UUID

from fastapi import Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.core.exceptions import UnauthorizedError
from app.core.security import decode_access_token
from app.db.models import User
from app.db.session import AsyncSessionLocal
from app.services.auth_service import AuthService
from app.services.email.base import EmailSender
from app.services.email.console import ConsoleSender
from app.services.email.smtp import SMTPSender


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


def get_email_sender(settings: Settings = Depends(get_settings)) -> EmailSender:
    if settings.email_backend == "console":
        return ConsoleSender(from_addr=settings.smtp_from)
    return SMTPSender(
        host=settings.smtp_host,
        port=settings.smtp_port,
        username=settings.smtp_user,
        password=settings.smtp_password,
        from_addr=settings.smtp_from,
        use_tls=settings.smtp_tls,
    )


def get_auth_service(
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
    sender: EmailSender = Depends(get_email_sender),
) -> AuthService:
    return AuthService(
        session=session,
        email_sender=sender,
        pepper=settings.otp_pepper,
        code_length=settings.otp_code_length,
        ttl_minutes=settings.otp_ttl_minutes,
        request_limit=settings.otp_request_limit,
        request_window_minutes=settings.otp_request_window_min,
        jwt_secret=settings.jwt_secret,
        jwt_algorithm=settings.jwt_algorithm,
        jwt_ttl_hours=settings.jwt_ttl_hours,
        max_attempts=settings.otp_max_attempts,
    )


def extract_user_id_from_request(request: Request, *, settings: Settings) -> UUID:
    token = request.cookies.get(settings.jwt_cookie_name)
    if not token:
        raise UnauthorizedError()
    payload = decode_access_token(
        token, secret=settings.jwt_secret, algorithm=settings.jwt_algorithm
    )
    try:
        return UUID(payload["sub"])
    except (KeyError, ValueError) as exc:
        raise UnauthorizedError() from exc


async def get_current_user(
    request: Request,
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> User:
    user_id = extract_user_id_from_request(request, settings=settings)
    stmt = select(User).where(User.id == user_id)
    user = (await session.execute(stmt)).scalar_one_or_none()
    if user is None:
        raise UnauthorizedError()
    return user
```

- [ ] **Step 15.4: Запустить — pass**

```bash
uv run pytest tests/unit/test_deps.py -v
# 3 passed
```

- [ ] **Step 15.5: Commit**

```bash
cd ..
git add backend/app/deps.py backend/tests/unit/test_deps.py
git commit -m "feat(backend): FastAPI deps (session, AuthService, current_user)"
```

---

## Task 16: Auth endpoints (request-otp, verify-otp, me, logout)

**Files:**
- Create: `backend/app/api/v1/auth.py`
- Modify: `backend/app/api/v1/router.py`
- Create: `backend/tests/integration/test_auth_endpoints.py`

- [ ] **Step 16.1: Failing test — полный e2e auth-flow**

```python
# tests/integration/test_auth_endpoints.py
from __future__ import annotations

from unittest.mock import AsyncMock

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.db.models import OtpCode, User


@pytest.mark.asyncio
async def test_request_otp_returns_204(async_client: AsyncClient, patch_email_sender):
    resp = await async_client.post(
        "/api/v1/auth/request-otp",
        json={"email": "new@user.com"},
    )
    assert resp.status_code == 204
    patch_email_sender.send_otp.assert_awaited_once()


@pytest.mark.asyncio
async def test_request_otp_invalid_email_400(async_client: AsyncClient):
    resp = await async_client.post(
        "/api/v1/auth/request-otp",
        json={"email": "not-email"},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_verify_otp_sets_cookie_and_returns_user(
    async_client: AsyncClient, patch_email_sender
):
    # 1. Request
    await async_client.post(
        "/api/v1/auth/request-otp", json={"email": "login@x.com"}
    )
    code = patch_email_sender.send_otp.await_args.kwargs["code"]

    # 2. Verify
    resp = await async_client.post(
        "/api/v1/auth/verify-otp",
        json={"email": "login@x.com", "code": code},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["user"]["email"] == "login@x.com"
    assert "access_token" in resp.cookies


@pytest.mark.asyncio
async def test_verify_otp_wrong_code_400(async_client: AsyncClient, patch_email_sender):
    await async_client.post(
        "/api/v1/auth/request-otp", json={"email": "x@x.com"}
    )
    resp = await async_client.post(
        "/api/v1/auth/verify-otp",
        json={"email": "x@x.com", "code": "000000"},
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_me_requires_auth(async_client: AsyncClient):
    resp = await async_client.get("/api/v1/auth/me")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_me_returns_user_when_authenticated(
    async_client: AsyncClient, patch_email_sender
):
    await async_client.post("/api/v1/auth/request-otp", json={"email": "a@a.com"})
    code = patch_email_sender.send_otp.await_args.kwargs["code"]
    await async_client.post(
        "/api/v1/auth/verify-otp", json={"email": "a@a.com", "code": code}
    )

    resp = await async_client.get("/api/v1/auth/me")
    assert resp.status_code == 200
    assert resp.json()["user"]["email"] == "a@a.com"


@pytest.mark.asyncio
async def test_logout_clears_cookie(async_client: AsyncClient, patch_email_sender):
    await async_client.post("/api/v1/auth/request-otp", json={"email": "a@a.com"})
    code = patch_email_sender.send_otp.await_args.kwargs["code"]
    await async_client.post(
        "/api/v1/auth/verify-otp", json={"email": "a@a.com", "code": code}
    )

    resp = await async_client.post("/api/v1/auth/logout")
    assert resp.status_code == 204
    # cookie очищена → /me возвращает 401
    me = await async_client.get("/api/v1/auth/me")
    assert me.status_code == 401
```

- [ ] **Step 16.2: Добавить fixture `patch_email_sender` в `tests/conftest.py`**

Дополнить conftest.py (добавить в конец):

```python
from unittest.mock import AsyncMock


@pytest_asyncio.fixture
async def patch_email_sender(db_session):
    """Заменяет EmailSender на AsyncMock, чтобы отслеживать вызовы send_otp."""
    from app.deps import get_email_sender
    from app.main import create_app
    from app.db.session import get_session

    mock_sender = AsyncMock()
    mock_sender.send_otp = AsyncMock()

    app = create_app()
    app.dependency_overrides[get_email_sender] = lambda: mock_sender
    app.dependency_overrides[get_session] = lambda: _override_session(db_session)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Заменяем глобальный async_client fixture effectively:
        # сохранять ссылку на sender нужно для assertions
        mock_sender._client = client
        yield mock_sender
```

Это ломает старую логику `async_client`. Нужна более чистая реализация — переделаем `conftest.py` полностью:

Замена `tests/conftest.py`:

```python
from __future__ import annotations

import asyncio
from collections.abc import AsyncGenerator
from unittest.mock import AsyncMock

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import get_settings
from app.db.base import Base
from app.db.session import get_session
from app.deps import get_email_sender
from app.main import create_app


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session")
async def db_engine():
    settings = get_settings()
    engine = create_async_engine(settings.database_url, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(db_engine) -> AsyncGenerator[AsyncSession, None]:
    connection = await db_engine.connect()
    trans = await connection.begin()
    Session = async_sessionmaker(bind=connection, expire_on_commit=False)
    async with Session() as session:
        try:
            yield session
        finally:
            await trans.rollback()
            await connection.close()


async def _override_session_factory(session: AsyncSession):
    async def _gen():
        yield session
    return _gen


@pytest_asyncio.fixture
async def patch_email_sender() -> AsyncMock:
    sender = AsyncMock()
    sender.send_otp = AsyncMock()
    return sender


@pytest_asyncio.fixture
async def async_client(
    db_session: AsyncSession,
    patch_email_sender: AsyncMock,
) -> AsyncGenerator[AsyncClient, None]:
    app = create_app()

    async def _session_override():
        yield db_session

    app.dependency_overrides[get_session] = _session_override
    app.dependency_overrides[get_email_sender] = lambda: patch_email_sender

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
```

> **Замечание:** `db_session` использует внешнюю транзакцию + rollback, так что данные между тестами не утекают. `async_client` использует override `get_session`, который отдаёт ту же самую `db_session`; чтобы service-слой не ломался коммитом, `AuthService` вызывает только `flush` (не `commit`) — см. реализацию.

- [ ] **Step 16.3: Запустить — fail**

```bash
cd backend
uv run pytest tests/integration/test_auth_endpoints.py -v
# 404 на /api/v1/auth/*
```

- [ ] **Step 16.4: Создать `app/api/v1/auth.py`**

```python
from __future__ import annotations

from fastapi import APIRouter, Depends, Response, status

from app.config import Settings, get_settings
from app.core.security import cookie_kwargs
from app.db.models import User
from app.deps import get_auth_service, get_current_user
from app.schemas.auth import MeOut, RequestOtpIn, UserOut, VerifyOtpIn
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/request-otp", status_code=status.HTTP_204_NO_CONTENT)
async def request_otp(
    payload: RequestOtpIn,
    service: AuthService = Depends(get_auth_service),
) -> Response:
    await service.request_otp(email=payload.email)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/verify-otp", response_model=MeOut)
async def verify_otp(
    payload: VerifyOtpIn,
    response: Response,
    service: AuthService = Depends(get_auth_service),
    settings: Settings = Depends(get_settings),
) -> MeOut:
    token, user = await service.verify_otp(email=payload.email, code=payload.code)
    response.set_cookie(
        key=settings.jwt_cookie_name,
        value=token,
        **cookie_kwargs(
            secure=settings.jwt_cookie_secure,
            samesite=settings.jwt_cookie_samesite,
            max_age_seconds=settings.jwt_ttl_hours * 3600,
        ),
    )
    return MeOut(user=UserOut.model_validate(user))


@router.get("/me", response_model=MeOut)
async def me(current: User = Depends(get_current_user)) -> MeOut:
    return MeOut(user=UserOut.model_validate(current))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    response: Response,
    settings: Settings = Depends(get_settings),
) -> Response:
    response.delete_cookie(key=settings.jwt_cookie_name, path="/")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
```

- [ ] **Step 16.5: Зарегистрировать в `app/api/v1/router.py`**

```python
from __future__ import annotations

from fastapi import APIRouter

from app.api.v1 import auth, health

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(health.router)
api_router.include_router(auth.router)
```

- [ ] **Step 16.6: Запустить — pass**

```bash
uv run pytest tests/integration/test_auth_endpoints.py -v
# 7 passed
```

- [ ] **Step 16.7: Полный прогон всех тестов**

```bash
uv run pytest -v
# ожидание: all passed (>= 30 tests)
```

- [ ] **Step 16.8: Commit**

```bash
cd ..
git add backend/app/api/v1/auth.py backend/app/api/v1/router.py backend/tests/conftest.py backend/tests/integration/test_auth_endpoints.py
git commit -m "feat(backend): auth endpoints (request-otp, verify-otp, me, logout)"
```

---

## Task 17: Rate limit middleware (slowapi)

**Files:**
- Create: `backend/app/core/rate_limit.py`
- Modify: `backend/app/main.py`
- Modify: `backend/app/api/v1/auth.py`
- Create: `backend/tests/integration/test_rate_limit.py`

> **Примечание:** сервисный rate-limit по email (в AuthService) уже есть. slowapi добавляет IP-level лимит как вторую линию защиты от ботов.

- [ ] **Step 17.1: Failing test**

```python
# tests/integration/test_rate_limit.py
from __future__ import annotations

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_request_otp_ip_rate_limit(async_client: AsyncClient):
    # 10 запросов подряд с одного IP → 11-й блокируется
    for i in range(10):
        await async_client.post(
            "/api/v1/auth/request-otp",
            json={"email": f"user{i}@x.com"},
        )
    resp = await async_client.post(
        "/api/v1/auth/request-otp",
        json={"email": "overflow@x.com"},
    )
    assert resp.status_code == 429
```

- [ ] **Step 17.2: Запустить — fail (или flaky, пока без лимита)**

```bash
cd backend
uv run pytest tests/integration/test_rate_limit.py -v
```

- [ ] **Step 17.3: Создать `app/core/rate_limit.py`**

```python
from __future__ import annotations

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
```

- [ ] **Step 17.4: Добавить лимитер в `app/main.py` (после `create_app` скелета)**

Добавить импорт и в `create_app`:

```python
# В начало файла:
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.core.rate_limit import limiter

# Внутри create_app, сразу после создания `app = FastAPI(...)`:
    app.state.limiter = limiter
    app.add_middleware(SlowAPIMiddleware)

    @app.exception_handler(RateLimitExceeded)
    async def rate_limit_handler(_: Request, exc: RateLimitExceeded):
        return JSONResponse(
            status_code=429,
            content={"code": "RATE_LIMITED", "message": "Too many requests"},
        )
```

- [ ] **Step 17.5: Применить лимит к `/auth/request-otp`**

В `app/api/v1/auth.py` добавить декоратор:

```python
from fastapi import Request

from app.core.rate_limit import limiter

# изменить сигнатуру request_otp:
@router.post("/request-otp", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("10/minute")
async def request_otp(
    request: Request,
    payload: RequestOtpIn,
    service: AuthService = Depends(get_auth_service),
) -> Response:
    await service.request_otp(email=payload.email)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
```

> slowapi требует `request: Request` как первый positional arg в endpoint'е для работы декоратора.

- [ ] **Step 17.6: Запустить — pass**

```bash
uv run pytest tests/integration/test_rate_limit.py -v
# 1 passed
```

- [ ] **Step 17.7: Полный прогон**

```bash
uv run pytest -v
# ожидание: all passed
```

- [ ] **Step 17.8: Commit**

```bash
cd ..
git add backend/app/core/rate_limit.py backend/app/main.py backend/app/api/v1/auth.py backend/tests
git commit -m "feat(backend): slowapi IP-level rate limiting on request-otp"
```

---

## Task 18: Dockerfile + запуск через compose

**Files:**
- Create: `backend/Dockerfile`
- Create: `backend/.dockerignore`
- Modify: `docker-compose.yml`

- [ ] **Step 18.0: Создать `backend/.dockerignore`**

```
.venv
__pycache__
*.pyc
.pytest_cache
.ruff_cache
.mypy_cache
.env
.env.*
tests/
docs/
.git
```

- [ ] **Step 18.1: Создать `backend/Dockerfile`**

```dockerfile
# syntax=docker/dockerfile:1.7

FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# установить uv
RUN pip install --no-cache-dir uv==0.5.*

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

COPY . .

EXPOSE 8080

CMD ["sh", "-c", "uv run alembic upgrade head && uv run uvicorn app.main:app --host 0.0.0.0 --port 8080"]
```

- [ ] **Step 18.2: Добавить `backend` сервис в `docker-compose.yml`**

```yaml
  backend:
    build: ./backend
    restart: unless-stopped
    env_file: ./backend/.env
    environment:
      DATABASE_URL: postgresql+asyncpg://nova:nova@postgres:5432/nova
      SMTP_HOST: mailpit
    ports:
      - "8080:8080"
    depends_on:
      postgres:
        condition: service_healthy
      mailpit:
        condition: service_started
    extra_hosts:
      - "host.docker.internal:host-gateway"
```

- [ ] **Step 18.3: Собрать и поднять**

```bash
docker compose build backend
docker compose up -d backend
docker compose logs -f backend | head -30
# ожидание: "Running upgrade ..." затем "Uvicorn running on http://0.0.0.0:8080"
```

- [ ] **Step 18.4: Smoke-проверка**

```bash
curl -s http://localhost:8080/api/v1/health
# {"status":"ok"}

# Полный OTP-цикл:
curl -s -X POST http://localhost:8080/api/v1/auth/request-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"test@local"}'
# 204

# Посмотреть код в Mailpit:
# Открыть http://localhost:8025 в браузере → взять 6 цифр из письма

# Или через API:
curl -s http://localhost:8025/api/v1/messages | python -c "
import json, sys, re
msgs = json.load(sys.stdin)['messages']
snippet = msgs[0]['Snippet']
print(re.search(r'\d{6}', snippet).group())
"

# Verify (заменить CODE на реальный):
curl -s -X POST http://localhost:8080/api/v1/auth/verify-otp \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"email":"test@local","code":"CODE"}'

# Me:
curl -s http://localhost:8080/api/v1/auth/me -b cookies.txt
# {"user":{"id":"...","email":"test@local"}}
```

- [ ] **Step 18.5: Commit**

```bash
git add backend/Dockerfile docker-compose.yml
git commit -m "feat(infra): containerize backend in docker-compose"
```

---

## Task 19: Final polish — ruff + README

**Files:**
- Modify: `backend/README.md`
- Possibly modify: source files (ruff fixes)

- [ ] **Step 19.1: Запустить ruff**

```bash
cd backend
uv run ruff check app tests
uv run ruff check --fix app tests
uv run ruff format app tests
```

- [ ] **Step 19.2: Полный прогон тестов**

```bash
uv run pytest -v
# ожидание: all passed
```

- [ ] **Step 19.3: Обновить `backend/README.md`**

Заменить на:

```markdown
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
```

- [ ] **Step 19.4: Commit**

```bash
cd ..
git add backend/README.md backend/app backend/tests
git commit -m "chore(backend): ruff format + README polish"
```

---

## Self-review checklist

После выполнения всех тасков выполнить sanity-проверку:

- [ ] `docker compose up -d` поднимает postgres, mailpit, backend
- [ ] `curl http://localhost:8080/api/v1/health` → `{"status":"ok"}`
- [ ] Полный OTP-цикл через curl работает (см. Task 18.4)
- [ ] `uv run pytest` — все тесты зелёные
- [ ] `uv run ruff check` — 0 ошибок
- [ ] Swagger UI открывается на `/api/docs` и показывает 4 auth endpoint'а

### Проверка покрытия spec'ом

| Spec section | Реализовано в |
|---|---|
| FastAPI + async skeleton | Task 6 |
| PostgreSQL + SQLAlchemy + Alembic | Tasks 7–8 |
| ORM models (4 таблицы) | Task 8 |
| OTP generate/hash/verify | Task 9 |
| Email abstraction (Console + SMTP) | Task 10 |
| JWT encode/decode + cookie | Tasks 11, 16 |
| Auth DTOs | Task 12 |
| AuthService.request_otp + rate limit по email | Task 13 |
| AuthService.verify_otp + attempts/expiry | Task 14 |
| FastAPI deps + get_current_user | Task 15 |
| REST endpoints /auth/* | Task 16 |
| slowapi IP rate limit | Task 17 |
| Docker compose (инфра + бэк) | Tasks 2, 18 |
| structlog + exception handlers | Tasks 4–6 |

**Вне scope плана 1 (оставлено для будущих планов):**
- `/chats/*`, `/messages/*`, `/health` с vLLM-статусом → Plan 2
- `app/services/llm_client.py`, `context_builder.py`, `title_generator.py` → Plan 2
- Frontend → Plans 3, 4

---

## Execution options

**Plan complete.** Two execution options:

**1. Subagent-Driven (recommended)** — dispatch fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
