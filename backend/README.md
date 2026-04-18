# Nova — Backend

FastAPI-backend для Nova chat. См. [design spec](../docs/superpowers/specs/2026-04-18-nova-chat-design.md).

## Quickstart

    cd backend
    uv sync
    # `.env.example` is added in Task 2 (docker-compose). Skip the cp until then.
    cp .env.example .env
    uv run uvicorn app.main:app --reload --port 8080

## Tests

    uv run pytest
