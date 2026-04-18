# Nova — Backend

FastAPI + SQLAlchemy + asyncpg backend для чат-приложения Nova.
См. [design spec](../docs/superpowers/specs/2026-04-18-nova-chat-design.md).

## Quickstart

### 1. Поднять LLM (Ollama)

Нужен OpenAI-совместимый endpoint. На macOS проще всего — Ollama:

    brew install ollama
    brew services start ollama          # API на :11434
    ollama pull qwen2.5:7b              # ~4 GB, Q4_K_M

Можно заменить на любую OpenAI-совместимую модель (`ollama pull llama3.1:8b`,
`mistral:7b`, и т.д.) — проставь `VLLM_MODEL` в `.env`.

Для vLLM (Linux+GPU):

    docker run --gpus all -p 8000:8000 vllm/vllm-openai:latest \
      --model bond005/meno-lite-0.1 --max-model-len 8192

### 2. Поднять всё остальное в Docker

    cp .env.example .env
    cd ..
    docker compose up -d                # postgres + mailpit + backend

Backend автоматически применит Alembic-миграции и поднимет uvicorn на `:8080`.

### 3. Разработка бэкенда локально (без Docker)

    docker compose up -d postgres mailpit
    cd backend
    uv sync
    uv run alembic upgrade head
    uv run uvicorn app.main:app --reload --port 8080

### 4. Полезные точки входа

- Swagger: http://localhost:8080/api/docs
- Mailpit (письма с OTP): http://localhost:8025
- Ollama: http://localhost:11434

## Тесты

    uv run pytest -v

## API

| Method | Path | Описание |
|---|---|---|
| GET  | `/api/v1/health` | Liveness + статус LLM |
| POST | `/api/v1/auth/request-otp` | Запрос OTP-кода на email |
| POST | `/api/v1/auth/verify-otp` | Подтверждение кода, JWT-cookie |
| GET  | `/api/v1/auth/me` | Текущий пользователь |
| POST | `/api/v1/auth/logout` | Выход |
| GET  | `/api/v1/chats` | Список чатов юзера |
| POST | `/api/v1/chats` | Создать чат |
| GET  | `/api/v1/chats/{id}` | Один чат |
| PATCH| `/api/v1/chats/{id}` | Переименовать |
| DELETE | `/api/v1/chats/{id}` | Удалить |
| GET  | `/api/v1/chats/{id}/messages` | История сообщений |
| POST | `/api/v1/chats/{id}/messages` | Отправить сообщение → SSE-стрим |
| POST | `/api/v1/chats/{id}/regenerate` | Перегенерировать ответ → SSE |
| GET  | `/api/v1/chats/{id}/export` | Экспорт в Markdown |

## Env

Полный список — см. `.env.example`. Ключевые:

    DATABASE_URL         postgresql+asyncpg://nova:nova@localhost:5432/nova
    JWT_SECRET           секрет ≥32 символов
    OTP_PEPPER           pepper для OTP-хеша
    SMTP_HOST/PORT       mailpit (localhost:1025) или реальный SMTP
    VLLM_URL             OpenAI-совместимый endpoint (Ollama :11434/v1 по умолчанию)
    VLLM_MODEL           имя модели (`qwen2.5:7b`, `llama3.1:8b`, и т.д.)
