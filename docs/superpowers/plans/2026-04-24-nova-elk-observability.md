# Nova ELK + Grafana Observability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship end-to-end structured logging with `traceId` propagation from the Nova React frontend through the FastAPI backend into the existing `lab/docker-elk-main/` stack via Filebeat, plus provisioned Grafana dashboards for overview and per-trace drill-down.

**Architecture:** Backend emits JSON on stdout (structlog, already configured) with field names matching the Go lab demo (`@timestamp`, `level`, `msg`, `traceId`). Filebeat autodiscovers the backend container by label, parses JSON, ships to Logstash. Frontend batches browser logs and POSTs to `/api/v1/_telemetry/logs`, which re-emits them through the same backend logger. One index, one pipeline, one set of dashboards — identical to what the Go demo already produces.

**Tech Stack:** FastAPI, structlog (already in deps), slowapi, React + TanStack Router, ky (existing), Filebeat 8.5, Logstash 8.5, Elasticsearch 8.5, Grafana.

**Spec:** [`docs/superpowers/specs/2026-04-24-nova-elk-observability-design.md`](../specs/2026-04-24-nova-elk-observability-design.md)

---

## File inventory

**Backend — create:**
- `backend/app/core/trace.py`
- `backend/app/core/middleware.py`
- `backend/app/api/v1/telemetry.py`
- `backend/app/schemas/telemetry.py`
- `backend/tests/unit/core/test_trace.py`
- `backend/tests/unit/core/test_middleware.py`
- `backend/tests/unit/api/test_telemetry.py`
- `backend/tests/integration/test_trace_e2e.py`

**Backend — modify:**
- `backend/app/core/logging.py` — match Go lab schema (`msg`, `@timestamp`, event renamer).
- `backend/app/config.py` — add `log_format` setting (`"json"` | `"console"`).
- `backend/app/main.py` — call `configure_logging` with `log_format`, register `TraceMiddleware`, include telemetry router.
- `backend/app/api/v1/router.py` — include telemetry router.
- `backend/app/services/auth_service.py` — instrumentation logs.
- `backend/app/services/chat_service.py` (or wherever chats CRUD lives — confirm at task time).
- `backend/app/services/message_service.py` — instrumentation logs around validate / save user / LLM call / save assistant.

**Frontend — create:**
- `frontend/src/shared/logger/traceId.ts`
- `frontend/src/shared/logger/clientLogger.ts`
- `frontend/src/shared/logger/index.ts`
- `frontend/src/shared/logger/clientLogger.test.ts`
- `frontend/src/shared/logger/traceId.test.ts`

**Frontend — modify:**
- `frontend/src/shared/api/client.ts` — ky hooks for `X-Trace-Id` header and 4xx/5xx/network auto-log.
- `frontend/src/shared/api/client.test.ts` — expand.
- `frontend/src/app/main.tsx` (or equivalent root) — initialize logger, attach `window.onerror`, `unhandledrejection`.
- Router (find TanStack Router bootstrap) — emit `nav` log on route change.
- Login feature — emit `user.login` on success.
- Message-send feature — mint traceId, thread it into API call, emit `user.message_send`.
- Regenerate feature — same pattern, emit `user.regenerate`.

**Infrastructure — create:**
- `lab/docker-elk-main/grafana/provisioning/datasources/elasticsearch.yml`
- `lab/docker-elk-main/grafana/provisioning/dashboards/dashboards.yml`
- `lab/docker-elk-main/grafana/dashboards/nova-overview.json`
- `lab/docker-elk-main/grafana/dashboards/nova-trace-explorer.json`

**Infrastructure — modify:**
- `lab/docker-elk-main/docker-compose.yml` — add `filebeat` and `grafana` volume mounts; declare `elk` network as external OR name it so the chat stack can join it.
- `lab/docker-elk-main/extensions/filebeat/config/filebeat.yml` — replace default autodiscover with label-scoped autodiscover, JSON-decode processor, output to Logstash (not Elasticsearch directly), disable monitoring to avoid auth.
- `docker-compose.yml` (project root) — join `elk` network, label backend container.
- `lab/README.md` — add "Nova chat integration" section with smoke-test instructions.

---

## Phase 1 — Backend log schema parity with Go lab

### Task 1.1: Rename logger fields to match Go lab

**Files:**
- Modify: `backend/app/core/logging.py`

**Context:** The Go demo emits `{"@timestamp", "level", "msg", "traceId"}`. Python structlog currently emits `{"timestamp", "level", "event"}`. We need identical keys so one Kibana query and one Grafana panel work for both apps.

- [ ] **Step 1: Edit `backend/app/core/logging.py` processor chain**

Replace the body of `configure_logging` so that:
- `TimeStamper` uses `key="@timestamp"`.
- Insert `structlog.processors.EventRenamer("msg")` after the stdlib processors and before the renderer in both the structlog `processors` chain AND the `ProcessorFormatter` chain.

Final `shared_processors` (used by both structlog and stdlib bridge):

```python
shared_processors: list[Any] = [
    structlog.contextvars.merge_contextvars,
    structlog.stdlib.add_log_level,
    structlog.processors.TimeStamper(fmt="iso", utc=True, key="@timestamp"),
    structlog.processors.StackInfoRenderer(),
    structlog.processors.format_exc_info,
    structlog.processors.EventRenamer("msg"),
]
```

Keep the stdlib bridge identical (`foreign_pre_chain=shared_processors`, `remove_processors_meta`, then `renderer`).

- [ ] **Step 2: Add/update unit test for schema**

Create `backend/tests/unit/core/test_logging_schema.py`:

```python
from __future__ import annotations

import io
import json
import logging

import structlog

from app.core.logging import configure_logging, get_logger


def test_json_output_uses_msg_and_at_timestamp(capsys):
    configure_logging(level="INFO", json_logs=True)
    log = get_logger("test")
    log.info("hello", traceId="abc-123", foo="bar")
    out = capsys.readouterr().out.strip().splitlines()[-1]
    rec = json.loads(out)
    assert rec["msg"] == "hello"
    assert rec["traceId"] == "abc-123"
    assert rec["foo"] == "bar"
    assert rec["level"] == "info"
    assert "@timestamp" in rec
    assert "timestamp" not in rec
    assert "event" not in rec
```

- [ ] **Step 3: Run the test**

Run: `cd backend && uv run pytest tests/unit/core/test_logging_schema.py -v`
Expected: PASS (both assertions). If `event` still present — verify EventRenamer is installed after `format_exc_info`.

- [ ] **Step 4: Commit**

```bash
git add backend/app/core/logging.py backend/tests/unit/core/test_logging_schema.py
git commit -m "feat(backend): align log schema with Go lab (msg, @timestamp)"
```

---

### Task 1.2: Force JSON logs regardless of env

**Files:**
- Modify: `backend/app/config.py`
- Modify: `backend/app/main.py`

**Context:** Currently JSON logs only turn on in `production`. For ELK demo we want JSON always (env=dev included). Expose a `log_format` setting so devs who want pretty console can still get it.

- [ ] **Step 1: Read existing `backend/app/config.py` to locate `Settings` class**

Run: `grep -n "log" backend/app/config.py` and scan the Settings class.

- [ ] **Step 2: Add `log_format` field to `Settings`**

Inside the Settings class (alongside similar simple settings):

```python
log_format: str = "json"  # "json" | "console"
log_level: str = "INFO"
```

Remove any reads of `app_env` inside `main.py` that steered log_format — those move here.

- [ ] **Step 3: Update `backend/app/main.py` to use new settings**

Replace the `configure_logging(...)` call:

```python
configure_logging(
    level=settings.log_level,
    json_logs=settings.log_format == "json",
)
```

- [ ] **Step 4: Add `.env.example` hint**

In `backend/.env.example`, append (if not present):

```
LOG_FORMAT=json
LOG_LEVEL=INFO
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/config.py backend/app/main.py backend/.env.example
git commit -m "feat(backend): explicit LOG_FORMAT/LOG_LEVEL settings, default json"
```

---

## Phase 2 — TraceId propagation

### Task 2.1: Create `core/trace.py`

**Files:**
- Create: `backend/app/core/trace.py`
- Create: `backend/tests/unit/core/test_trace.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/unit/core/test_trace.py`:

```python
from __future__ import annotations

import asyncio
import json
import uuid

from app.core.logging import configure_logging, get_logger
from app.core.trace import bind_trace, get_trace_id, new_trace_id, reset_trace


def test_new_trace_id_is_uuid4_string():
    tid = new_trace_id()
    uuid.UUID(tid)  # raises if invalid
    assert len(tid) == 36


def test_bind_trace_sets_contextvar():
    tid = new_trace_id()
    token = bind_trace(tid)
    try:
        assert get_trace_id() == tid
    finally:
        reset_trace(token)


def test_bind_trace_makes_structlog_include_trace_id(capsys):
    configure_logging(level="INFO", json_logs=True)
    tid = new_trace_id()
    token = bind_trace(tid)
    try:
        get_logger("t").info("ping")
    finally:
        reset_trace(token)
    rec = json.loads(capsys.readouterr().out.strip().splitlines()[-1])
    assert rec["traceId"] == tid


async def test_trace_id_isolated_between_tasks():
    async def task(n: int) -> str | None:
        tid = f"trace-{n}"
        token = bind_trace(tid)
        try:
            await asyncio.sleep(0)
            return get_trace_id()
        finally:
            reset_trace(token)

    a, b = await asyncio.gather(task(1), task(2))
    assert a == "trace-1"
    assert b == "trace-2"
```

(pytest-asyncio is in `auto` mode — see `backend/pyproject.toml` — so no `@pytest.mark.asyncio` needed.)

- [ ] **Step 2: Run the test to confirm it fails**

Run: `cd backend && uv run pytest tests/unit/core/test_trace.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.core.trace'`.

- [ ] **Step 3: Implement `backend/app/core/trace.py`**

```python
"""Request-scoped traceId contextvar, integrated with structlog contextvars.

We use structlog's public contextvars API so every record automatically picks
up traceId via the `merge_contextvars` processor (already in the logging
config). Callers get a TraceToken they pass to `reset_trace` in a finally
block.
"""

from __future__ import annotations

import uuid

import structlog

_CONTEXT_KEY = "traceId"


def new_trace_id() -> str:
    """Return a fresh uuid4 string."""
    return str(uuid.uuid4())


class TraceToken:
    """Snapshot of contextvars taken *before* bind_trace ran."""

    __slots__ = ("previous",)

    def __init__(self, previous: dict) -> None:
        self.previous = previous


def bind_trace(trace_id: str) -> TraceToken:
    """Bind trace_id onto structlog contextvars. Returns a reset token."""
    previous = dict(structlog.contextvars.get_contextvars())
    structlog.contextvars.bind_contextvars(**{_CONTEXT_KEY: trace_id})
    return TraceToken(previous=previous)


def reset_trace(token: TraceToken) -> None:
    """Restore contextvars to the snapshot captured by bind_trace."""
    structlog.contextvars.clear_contextvars()
    if token.previous:
        structlog.contextvars.bind_contextvars(**token.previous)


def get_trace_id() -> str | None:
    return structlog.contextvars.get_contextvars().get(_CONTEXT_KEY)
```

- [ ] **Step 4: Run tests to confirm pass**

Run: `cd backend && uv run pytest tests/unit/core/test_trace.py -v`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/app/core/trace.py backend/tests/unit/core/test_trace.py
git commit -m "feat(backend): traceId contextvar integrated with structlog"
```

---

### Task 2.2: Create `core/middleware.py` with `TraceMiddleware`

**Files:**
- Create: `backend/app/core/middleware.py`
- Create: `backend/tests/unit/core/test_middleware.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/unit/core/test_middleware.py`:

```python
from __future__ import annotations

import json
import uuid

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.logging import configure_logging
from app.core.middleware import TraceMiddleware


@pytest.fixture
def app():
    configure_logging(level="INFO", json_logs=True)
    a = FastAPI()
    a.add_middleware(TraceMiddleware)

    @a.get("/ok")
    def ok():
        return {"hi": True}

    @a.get("/boom")
    def boom():
        raise RuntimeError("kaboom")

    return a


def test_response_carries_generated_trace_id(app):
    with TestClient(app) as c:
        r = c.get("/ok")
    assert r.status_code == 200
    tid = r.headers["x-trace-id"]
    uuid.UUID(tid)


def test_response_echoes_inbound_trace_id(app):
    inbound = "11111111-2222-3333-4444-555555555555"
    with TestClient(app) as c:
        r = c.get("/ok", headers={"X-Trace-Id": inbound})
    assert r.headers["x-trace-id"] == inbound


def test_invalid_trace_id_gets_replaced(app):
    with TestClient(app) as c:
        r = c.get("/ok", headers={"X-Trace-Id": "not-a-uuid"})
    tid = r.headers["x-trace-id"]
    uuid.UUID(tid)
    assert tid != "not-a-uuid"


def test_request_start_and_end_logged(app, capsys):
    with TestClient(app) as c:
        r = c.get("/ok")
    lines = [
        json.loads(x) for x in capsys.readouterr().out.strip().splitlines()
        if x.strip().startswith("{")
    ]
    by_msg = {line["msg"]: line for line in lines if "msg" in line}
    assert "request.start" in by_msg
    assert "request.end" in by_msg
    assert by_msg["request.start"]["traceId"] == r.headers["x-trace-id"]
    assert by_msg["request.end"]["traceId"] == r.headers["x-trace-id"]
    assert by_msg["request.end"]["status"] == 200
    assert by_msg["request.end"]["method"] == "GET"
    assert by_msg["request.end"]["path"] == "/ok"
    assert isinstance(by_msg["request.end"]["durationMs"], (int, float))


def test_unhandled_exception_logged_with_trace(app, capsys):
    with TestClient(app, raise_server_exceptions=False) as c:
        r = c.get("/boom")
    assert r.status_code == 500
    lines = [
        json.loads(x) for x in capsys.readouterr().out.strip().splitlines()
        if x.strip().startswith("{")
    ]
    unhandled = [l for l in lines if l.get("msg") == "unhandled_exception"]
    assert len(unhandled) == 1
    assert unhandled[0]["level"] == "error"
    assert unhandled[0]["traceId"] == r.headers["x-trace-id"]
```

- [ ] **Step 2: Run test to confirm fail**

Run: `cd backend && uv run pytest tests/unit/core/test_middleware.py -v`
Expected: FAIL — `ModuleNotFoundError: app.core.middleware`.

- [ ] **Step 3: Implement `backend/app/core/middleware.py`**

```python
"""TraceMiddleware — generates/propagates traceId and logs request start/end."""

from __future__ import annotations

import time
import uuid
from typing import Any

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from starlette.types import ASGIApp

from app.core.logging import get_logger
from app.core.trace import bind_trace, new_trace_id, reset_trace

HEADER = "X-Trace-Id"
_log = get_logger("app.request")


def _valid_uuid(value: str) -> bool:
    try:
        uuid.UUID(value)
        return True
    except ValueError:
        return False


class TraceMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)

    async def dispatch(self, request: Request, call_next: Any) -> Response:
        inbound = request.headers.get(HEADER, "")
        trace_id = inbound if _valid_uuid(inbound) else new_trace_id()
        token = bind_trace(trace_id)
        start = time.perf_counter()
        method = request.method
        path = request.url.path

        _log.info("request.start", method=method, path=path)

        try:
            response = await call_next(request)
        except Exception:
            duration_ms = (time.perf_counter() - start) * 1000.0
            _log.error(
                "unhandled_exception",
                method=method,
                path=path,
                durationMs=round(duration_ms, 2),
                exc_info=True,
            )
            reset_trace(token)
            raise

        duration_ms = (time.perf_counter() - start) * 1000.0
        _log.info(
            "request.end",
            method=method,
            path=path,
            status=response.status_code,
            durationMs=round(duration_ms, 2),
        )
        response.headers[HEADER] = trace_id
        reset_trace(token)
        return response
```

- [ ] **Step 4: Run test**

Run: `cd backend && uv run pytest tests/unit/core/test_middleware.py -v`
Expected: PASS (5 tests).

If the `test_unhandled_exception_logged_with_trace` fails with 500-exception bubbling and no log: confirm `TestClient` is created with `raise_server_exceptions=False`.

- [ ] **Step 5: Commit**

```bash
git add backend/app/core/middleware.py backend/tests/unit/core/test_middleware.py
git commit -m "feat(backend): TraceMiddleware with request.start/end and unhandled logs"
```

---

### Task 2.3: Wire `TraceMiddleware` in `main.py`

**Files:**
- Modify: `backend/app/main.py`

- [ ] **Step 1: Add middleware registration**

Import at top: `from app.core.middleware import TraceMiddleware`.

Inside `create_app()`, add `TraceMiddleware` **before** other middlewares so it wraps CORS/SlowAPI (outermost). Because Starlette's `add_middleware` stacks LIFO (last added = innermost), `TraceMiddleware` must be added **last**:

```python
# ... existing middlewares (SlowAPI, CORS) ...
app.add_middleware(TraceMiddleware)  # must be the LAST add_middleware so it is outermost
```

- [ ] **Step 2: Run full backend tests**

Run: `cd backend && uv run pytest -q`
Expected: PASS. Existing tests should still pass (TraceMiddleware is inert when no one reads headers).

- [ ] **Step 3: Commit**

```bash
git add backend/app/main.py
git commit -m "feat(backend): register TraceMiddleware on app"
```

---

## Phase 3 — Telemetry endpoint for frontend logs

### Task 3.1: Telemetry schema

**Files:**
- Create: `backend/app/schemas/telemetry.py`

- [ ] **Step 1: Implement schema**

```python
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator


class ClientLogRecord(BaseModel):
    ts: str = Field(..., description="Client-side ISO timestamp")
    level: Literal["debug", "info", "warn", "error"]
    msg: str = Field(..., min_length=1, max_length=200)
    traceId: str = Field(..., min_length=8, max_length=64)
    source: str = Field(default="frontend", max_length=32)
    fields: dict[str, str | int | float | bool | None] = Field(default_factory=dict)

    @field_validator("fields")
    @classmethod
    def _limit_fields_size(cls, v: dict) -> dict:
        # Cap total JSON size of extra fields so a buggy client cannot blow up ES.
        import json as _json

        if len(_json.dumps(v, default=str)) > 2048:
            raise ValueError("fields payload too large (max 2KB)")
        return v


class TelemetryBatch(BaseModel):
    records: list[ClientLogRecord] = Field(..., max_length=100)
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/schemas/telemetry.py
git commit -m "feat(backend): schema for /_telemetry/logs batch"
```

---

### Task 3.2: Telemetry endpoint

**Files:**
- Create: `backend/app/api/v1/telemetry.py`
- Create: `backend/tests/unit/api/test_telemetry.py`
- Modify: `backend/app/api/v1/router.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/unit/api/test_telemetry.py`:

```python
from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    return TestClient(app)


def test_empty_batch_returns_204(client):
    r = client.post("/api/v1/_telemetry/logs", json={"records": []})
    assert r.status_code == 204


def test_valid_batch_reemits_records(client, capsys):
    payload = {
        "records": [
            {
                "ts": "2026-04-24T22:00:00.000Z",
                "level": "info",
                "msg": "user.action",
                "traceId": "a" * 32,
                "fields": {"action": "click"},
            },
            {
                "ts": "2026-04-24T22:00:01.000Z",
                "level": "error",
                "msg": "api.error",
                "traceId": "b" * 32,
                "fields": {"status": 500},
            },
        ]
    }
    r = client.post("/api/v1/_telemetry/logs", json=payload)
    assert r.status_code == 204
    logs = [
        json.loads(ln)
        for ln in capsys.readouterr().out.strip().splitlines()
        if ln.strip().startswith("{")
    ]
    relevant = [l for l in logs if l.get("msg") in {"user.action", "api.error"}]
    assert len(relevant) == 2
    by_msg = {l["msg"]: l for l in relevant}
    assert by_msg["user.action"]["source"] == "frontend"
    assert by_msg["user.action"]["traceId"] == "a" * 32
    assert by_msg["user.action"]["action"] == "click"
    assert by_msg["api.error"]["level"] == "error"
    assert by_msg["api.error"]["status"] == 500


def test_oversized_batch_rejected(client):
    payload = {
        "records": [
            {
                "ts": "2026-04-24T22:00:00.000Z",
                "level": "info",
                "msg": "m",
                "traceId": "a" * 32,
            }
        ]
        * 101
    }
    r = client.post("/api/v1/_telemetry/logs", json=payload)
    assert r.status_code == 422


def test_bad_level_rejected(client):
    r = client.post(
        "/api/v1/_telemetry/logs",
        json={
            "records": [
                {
                    "ts": "2026-04-24T22:00:00.000Z",
                    "level": "fatal",  # not in Literal
                    "msg": "m",
                    "traceId": "a" * 32,
                }
            ]
        },
    )
    assert r.status_code == 422
```

- [ ] **Step 2: Run test to confirm fail**

Run: `cd backend && uv run pytest tests/unit/api/test_telemetry.py -v`
Expected: FAIL — 404 on route, because router not registered yet.

- [ ] **Step 3: Implement `backend/app/api/v1/telemetry.py`**

```python
"""Accepts batched frontend log records and re-emits them through structlog."""

from __future__ import annotations

from fastapi import APIRouter, Request, status

from app.core.logging import get_logger
from app.core.rate_limit import limiter
from app.schemas.telemetry import ClientLogRecord, TelemetryBatch

router = APIRouter(prefix="/_telemetry", tags=["telemetry"])

_log = get_logger("app.telemetry")

_LEVEL_DISPATCH = {
    "debug": lambda l, *a, **kw: l.debug(*a, **kw),
    "info": lambda l, *a, **kw: l.info(*a, **kw),
    "warn": lambda l, *a, **kw: l.warning(*a, **kw),
    "error": lambda l, *a, **kw: l.error(*a, **kw),
}


def _emit(rec: ClientLogRecord) -> None:
    bound = _log.bind(
        source=rec.source,
        traceId=rec.traceId,
        clientTs=rec.ts,
        **(rec.fields or {}),
    )
    _LEVEL_DISPATCH[rec.level](bound, rec.msg)


@router.post("/logs", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("200/minute")
async def ingest_logs(request: Request, batch: TelemetryBatch) -> None:
    for rec in batch.records:
        _emit(rec)
```

- [ ] **Step 4: Register router in `backend/app/api/v1/router.py`**

Add import: `from app.api.v1 import telemetry` and include:

```python
api_router.include_router(telemetry.router)
```

- [ ] **Step 5: Run test**

Run: `cd backend && uv run pytest tests/unit/api/test_telemetry.py -v`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add backend/app/api/v1/telemetry.py backend/app/api/v1/router.py backend/tests/unit/api/test_telemetry.py
git commit -m "feat(backend): POST /api/v1/_telemetry/logs for frontend batches"
```

---

## Phase 4 — Instrument business code

### Task 4.1: Auth service logs

**Files:**
- Modify: `backend/app/services/auth_service.py`

**Rules:**
- No raw emails. Use SHA-256 prefix: `hashlib.sha256(email.encode()).hexdigest()[:16]` stored as `emailHash`.
- No OTP codes. Log only success/failure booleans.

- [ ] **Step 1: Read existing auth_service**

Run: `grep -n "def " backend/app/services/auth_service.py | head -30`

Find method boundaries. Expected public methods: `request_otp(email)`, `verify_otp(email, code) -> (token, user)`.

- [ ] **Step 2: Add logger and instrumentation**

At top of file:

```python
import hashlib

from app.core.logging import get_logger

_log = get_logger("app.auth")


def _email_hash(email: str) -> str:
    return hashlib.sha256(email.lower().encode("utf-8")).hexdigest()[:16]
```

Inside `request_otp(email)`:
- At start: `_log.info("auth.otp_request_start", emailHash=_email_hash(email))`
- On successful send: `_log.info("auth.otp_request_ok", emailHash=_email_hash(email))`
- On failure (exception caught or raised): `_log.warning("auth.otp_request_failed", emailHash=_email_hash(email), reason=str(exc))`

Inside `verify_otp(email, code)`:
- At start: `_log.info("auth.otp_verify_start", emailHash=_email_hash(email))`
- On success (before return): `_log.info("auth.otp_verify_ok", emailHash=_email_hash(email), userId=str(user.id))`
- On mismatch/expired: `_log.warning("auth.otp_verify_failed", emailHash=_email_hash(email), reason="invalid_or_expired")`

- [ ] **Step 3: Run existing auth tests**

Run: `cd backend && uv run pytest tests/unit/ tests/integration/ -k auth -v`
Expected: PASS. Log statements must not break flow.

- [ ] **Step 4: Commit**

```bash
git add backend/app/services/auth_service.py
git commit -m "feat(backend): structured logs in auth flow (hashed email, no PII)"
```

---

### Task 4.2: Chats service logs

**Files:**
- Modify: `backend/app/services/chat_service.py` (confirm actual filename first)

- [ ] **Step 1: Locate chats service**

Run: `ls backend/app/services/ | grep -i chat`

If file name differs (e.g. `chats_service.py`), use whatever is actually there.

- [ ] **Step 2: Add logger and instrumentation**

At top:

```python
from app.core.logging import get_logger
_log = get_logger("app.chats")
```

Add `_log.info(...)` on entry/success of:
- `create_chat(user_id, ...)` → `_log.info("chat.create", userId=str(user_id))` before return: `_log.info("chat.created", chatId=str(chat.id), userId=str(user_id))`
- `rename_chat(user_id, chat_id, title)` → `_log.info("chat.renamed", chatId=str(chat_id), userId=str(user_id))`
- `delete_chat(user_id, chat_id)` → `_log.info("chat.deleted", chatId=str(chat_id), userId=str(user_id))`
- `list_chats(user_id)` → skip (noisy, happens on every page load). Optionally `_log.debug(...)`.

- [ ] **Step 3: Run chats tests**

Run: `cd backend && uv run pytest -k chat -v`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add backend/app/services/chat_service.py
git commit -m "feat(backend): structured logs in chat CRUD"
```

---

### Task 4.3: Messages / LLM service logs

**Files:**
- Modify: `backend/app/services/message_service.py`

**Rules:**
- No message content, no LLM prompts, no completion text. Only metadata.

- [ ] **Step 1: Read existing message service**

Run: `wc -l backend/app/services/message_service.py` and open it in a reader.
Identify `stream_new_message(user_id, chat_id, content)` and `stream_regenerate(user_id, chat_id)` flow.

- [ ] **Step 2: Add logger and instrumentation**

At top:

```python
import time

from app.core.logging import get_logger

_log = get_logger("app.messages")
```

In `stream_new_message(...)` (or its inner implementation):

- Entry: `_log.info("request.validate_start", userId=str(user_id), chatId=str(chat_id), contentLen=len(content))`
- After user message persisted: `_log.info("message.user_saved", userId=str(user_id), chatId=str(chat_id), messageId=str(msg.id))`
- Before LLM call — read model name from settings (`from app.config import get_settings; model_name = get_settings().vllm_model`) and stash `llm_started = time.perf_counter()`:
  ```python
  _log.info("llm.call_start", source="llm", chatId=str(chat_id), model=model_name)
  ```
- Per-chunk logs: **skip** (too noisy; no log per chunk).
- On LLM error inside the streaming loop:
  ```python
  _log.error("llm.call_failed", source="llm", chatId=str(chat_id), error=str(exc))
  ```
- After the stream completes, before yielding the SSE close event. If the service tracks an output-token count in a local, pass it; otherwise omit the `tokens` kwarg entirely (don't pass `None`):
  ```python
  duration_ms = round((time.perf_counter() - llm_started) * 1000, 2)
  log_kwargs = {"source": "llm", "chatId": str(chat_id), "durationMs": duration_ms}
  if token_count is not None:  # only if a token_count local exists in this function
      log_kwargs["tokens"] = token_count
  _log.info("llm.call_end", **log_kwargs)
  ```
- After assistant message persisted: `_log.info("message.assistant_saved", chatId=str(chat_id), messageId=str(assistant_msg.id))`

Replicate the four LLM-side logs (start, end/failed, assistant_saved) in `stream_regenerate` with an extra field `regenerate=True`.

- [ ] **Step 3: Run messages tests**

Run: `cd backend && uv run pytest -k message -v`
Expected: PASS. Existing LLM mocks are fine — logs are side-effects.

- [ ] **Step 4: Commit**

```bash
git add backend/app/services/message_service.py
git commit -m "feat(backend): structured logs for messages + LLM timing"
```

---

### Task 4.4: E2E trace-propagation integration test

**Files:**
- Create: `backend/tests/integration/test_trace_e2e.py`

- [ ] **Step 1: Write the test**

```python
from __future__ import annotations

import json

from fastapi.testclient import TestClient

from app.main import app


def test_health_request_logs_share_trace_id(capsys):
    with TestClient(app) as c:
        r = c.get("/api/v1/health")
    assert r.status_code == 200
    tid = r.headers["x-trace-id"]
    lines = [
        json.loads(ln)
        for ln in capsys.readouterr().out.strip().splitlines()
        if ln.strip().startswith("{")
    ]
    # All request.* records from this call should share traceId.
    related = [l for l in lines if l.get("traceId") == tid]
    msgs = {l.get("msg") for l in related}
    assert "request.start" in msgs
    assert "request.end" in msgs
```

- [ ] **Step 2: Run**

Run: `cd backend && uv run pytest tests/integration/test_trace_e2e.py -v`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/integration/test_trace_e2e.py
git commit -m "test(backend): e2e traceId propagation for health"
```

---

## Phase 5 — Frontend logger

### Task 5.1: traceId helper

**Files:**
- Create: `frontend/src/shared/logger/traceId.ts`
- Create: `frontend/src/shared/logger/traceId.test.ts`

- [ ] **Step 1: Write the test**

```ts
import { describe, it, expect } from 'vitest';
import { newTraceId } from './traceId';

describe('newTraceId', () => {
  it('returns a uuid-shaped string', () => {
    const tid = newTraceId();
    expect(tid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it('returns unique ids', () => {
    const a = newTraceId();
    const b = newTraceId();
    expect(a).not.toBe(b);
  });
});
```

- [ ] **Step 2: Implement**

```ts
export function newTraceId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  // Fallback (non-secure) — shouldn't hit in any modern browser we target.
  const rnd = (n: number) =>
    Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  return `${rnd(8)}-${rnd(4)}-4${rnd(3)}-${rnd(4)}-${rnd(12)}`;
}
```

- [ ] **Step 3: Run**

Run: `cd frontend && npx vitest run src/shared/logger/traceId.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/shared/logger/traceId.ts frontend/src/shared/logger/traceId.test.ts
git commit -m "feat(frontend): newTraceId helper"
```

---

### Task 5.2: clientLogger

**Files:**
- Create: `frontend/src/shared/logger/clientLogger.ts`
- Create: `frontend/src/shared/logger/clientLogger.test.ts`
- Create: `frontend/src/shared/logger/index.ts`

- [ ] **Step 1: Write the test**

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createClientLogger } from './clientLogger';

describe('clientLogger', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('flushes on size threshold', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    const logger = createClientLogger({ url: '/api/v1/_telemetry/logs', flushSize: 2, flushIntervalMs: 99999 });
    logger.log('info', 'a', { traceId: 'tid-1' });
    logger.log('info', 'b', { traceId: 'tid-2' });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.records).toHaveLength(2);
    expect(body.records[0].msg).toBe('a');
  });

  it('flushes on timer', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    const logger = createClientLogger({ url: '/api/v1/_telemetry/logs', flushSize: 100, flushIntervalMs: 500 });
    logger.log('info', 'one', { traceId: 'tid' });
    vi.advanceTimersByTime(500);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
  });

  it('requeues on fetch failure and retries next flush', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    const logger = createClientLogger({ url: '/api/v1/_telemetry/logs', flushSize: 1, flushIntervalMs: 99999 });
    logger.log('error', 'x', { traceId: 'tid' });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await logger.flush(); // second attempt
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('caps queue at 200 and drops oldest', () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('x')));
    const logger = createClientLogger({
      url: '/api/v1/_telemetry/logs',
      flushSize: 999, // do not auto-flush on size
      flushIntervalMs: 999999,
      maxQueue: 200,
    });
    for (let i = 0; i < 250; i++) {
      logger.log('info', `m-${i}`, { traceId: 'tid' });
    }
    expect(logger._queueSize()).toBe(200);
  });

  it('uses sendBeacon on beforeunload', () => {
    const sendBeacon = vi.fn().mockReturnValue(true);
    vi.stubGlobal('navigator', { ...navigator, sendBeacon });
    const logger = createClientLogger({ url: '/api/v1/_telemetry/logs', flushSize: 999, flushIntervalMs: 999999 });
    logger.log('info', 'bye', { traceId: 'tid' });
    logger.flushSync();
    expect(sendBeacon).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Implement clientLogger**

Create `frontend/src/shared/logger/clientLogger.ts`:

```ts
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface ClientLogRecord {
  ts: string;
  level: LogLevel;
  msg: string;
  traceId: string;
  source?: string;
  fields?: Record<string, string | number | boolean | null>;
}

export interface ClientLoggerOptions {
  url: string;
  flushSize?: number;
  flushIntervalMs?: number;
  maxQueue?: number;
}

export interface ClientLogger {
  log(level: LogLevel, msg: string, opts?: { traceId: string; [key: string]: unknown }): void;
  flush(): Promise<void>;
  flushSync(): void;
  _queueSize(): number;
}

export function createClientLogger(opts: ClientLoggerOptions): ClientLogger {
  const flushSize = opts.flushSize ?? 20;
  const flushIntervalMs = opts.flushIntervalMs ?? 5000;
  const maxQueue = opts.maxQueue ?? 200;

  let queue: ClientLogRecord[] = [];
  let flushing = false;

  const timer = setInterval(() => {
    void flush();
  }, flushIntervalMs);
  // Don't block Node test teardown; ignored in browser.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (timer as any).unref?.();

  function enqueue(rec: ClientLogRecord) {
    queue.push(rec);
    if (queue.length > maxQueue) {
      queue.splice(0, queue.length - maxQueue);
    }
    if (queue.length >= flushSize) {
      void flush();
    }
  }

  async function flush(): Promise<void> {
    if (flushing || queue.length === 0) return;
    flushing = true;
    const batch = queue;
    queue = [];
    try {
      await fetch(opts.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: batch }),
        credentials: 'include',
        keepalive: true,
      });
    } catch {
      // Re-queue at head, cap enforced.
      queue = [...batch, ...queue].slice(-maxQueue);
    } finally {
      flushing = false;
    }
  }

  function flushSync(): void {
    if (queue.length === 0) return;
    const body = JSON.stringify({ records: queue });
    queue = [];
    if (typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
      navigator.sendBeacon(opts.url, new Blob([body], { type: 'application/json' }));
    }
  }

  function log(level: LogLevel, msg: string, meta?: { traceId: string; [key: string]: unknown }): void {
    const traceId = (meta?.traceId as string) ?? '';
    const fields: Record<string, string | number | boolean | null> = {};
    if (meta) {
      for (const [k, v] of Object.entries(meta)) {
        if (k === 'traceId') continue;
        if (v === null || ['string', 'number', 'boolean'].includes(typeof v)) {
          fields[k] = v as string | number | boolean | null;
        }
      }
    }
    enqueue({
      ts: new Date().toISOString(),
      level,
      msg,
      traceId,
      source: 'frontend',
      fields,
    });
  }

  return {
    log,
    flush,
    flushSync,
    _queueSize: () => queue.length,
  };
}
```

- [ ] **Step 3: Create barrel `frontend/src/shared/logger/index.ts`**

```ts
export { newTraceId } from './traceId';
export { createClientLogger } from './clientLogger';
export type { LogLevel, ClientLogRecord, ClientLogger } from './clientLogger';

import { createClientLogger } from './clientLogger';
import { env } from '@/shared/config/env';

export const clientLogger = createClientLogger({
  url: `${env.VITE_API_URL.replace(/\/$/, '')}/_telemetry/logs`,
});
```

- [ ] **Step 4: Run tests**

Run: `cd frontend && npx vitest run src/shared/logger/`
Expected: PASS (5 tests for clientLogger + 2 for traceId).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/shared/logger
git commit -m "feat(frontend): clientLogger with batch + flush + beacon"
```

---

### Task 5.3: ky hooks for traceId + auto-log

**Files:**
- Modify: `frontend/src/shared/api/client.ts`
- Modify: `frontend/src/shared/api/client.test.ts`

- [ ] **Step 1: Update `client.ts`**

Replace file:

```ts
import ky, { type KyRequest, type Options } from 'ky';
import { env } from '@/shared/config/env';
import { clientLogger, newTraceId } from '@/shared/logger';

const TRACE_KEY = Symbol.for('nova.traceId');

export interface TracedKyOptions extends Options {
  traceId?: string;
}

export const apiClient = ky.create({
  prefixUrl: env.VITE_API_URL,
  credentials: 'include',
  timeout: 30_000,
  retry: {
    limit: 2,
    methods: ['get'],
    statusCodes: [408, 429, 500, 502, 503, 504],
  },
  hooks: {
    beforeRequest: [
      (request: KyRequest, options) => {
        // `options` carries our extension in `.traceId`.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const opts = options as any;
        const traceId: string = opts?.traceId ?? newTraceId();
        opts[TRACE_KEY] = traceId;
        request.headers.set('X-Trace-Id', traceId);
      },
    ],
    afterResponse: [
      (request, options, response) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const traceId: string = (options as any)[TRACE_KEY] ?? 'unknown';
        if (!response.ok) {
          clientLogger.log('error', 'api.error', {
            traceId,
            status: response.status,
            method: request.method,
            path: new URL(request.url).pathname,
          });
        }
        return response;
      },
    ],
    beforeError: [
      async (error) => {
        const { response, request } = error;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const traceId: string = (error.options as any)?.[TRACE_KEY] ?? 'unknown';
        if (!response) {
          clientLogger.log('error', 'api.network_error', {
            traceId,
            method: request?.method ?? 'UNKNOWN',
            path: request ? new URL(request.url).pathname : 'unknown',
            error: error.message,
          });
        }
        if (response) {
          try {
            const body = (await response.clone().json()) as { detail?: string };
            if (body.detail) error.message = body.detail;
          } catch {
            /* keep message */
          }
        }
        return error;
      },
    ],
  },
});
```

- [ ] **Step 2: Update `client.test.ts`**

Replace file:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from './client';

const BASE = 'http://localhost:8080/api/v1';

describe('apiClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('is a ky instance (has .get method)', () => {
    expect(typeof apiClient.get).toBe('function');
  });

  it('adds X-Trace-Id header on each request', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await apiClient.get('health').json();
    const [, init] = fetchMock.mock.calls[0];
    const headers = new Headers(init.headers);
    expect(headers.get('X-Trace-Id')).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it('reuses explicit traceId if provided via options', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const tid = '11111111-2222-3333-4444-555555555555';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (apiClient as any).get('health', { traceId: tid }).json();
    const [, init] = fetchMock.mock.calls[0];
    const headers = new Headers(init.headers);
    expect(headers.get('X-Trace-Id')).toBe(tid);
  });
});
```

- [ ] **Step 3: Run**

Run: `cd frontend && npx vitest run src/shared/api/`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/shared/api
git commit -m "feat(frontend): ky hooks — X-Trace-Id + auto-log api.error"
```

---

### Task 5.4: Initialize logger + global handlers at app root

**Files:**
- Modify: `frontend/src/app/main.tsx` (confirm exact path — could be `src/main.tsx`)

- [ ] **Step 1: Find entry file**

Run: `ls frontend/src/app/ 2>/dev/null; ls frontend/src/ | grep -E 'main|index'`

- [ ] **Step 2: Attach handlers**

At top of the entry module (before `createRoot` / router mount):

```ts
import { clientLogger, newTraceId } from '@/shared/logger';

window.addEventListener('error', (ev) => {
  clientLogger.log('error', 'unhandled.error', {
    traceId: newTraceId(),
    message: String(ev.message ?? ''),
    source: String(ev.filename ?? ''),
    line: Number(ev.lineno ?? 0),
    col: Number(ev.colno ?? 0),
  });
});

window.addEventListener('unhandledrejection', (ev) => {
  const reason = ev.reason instanceof Error ? ev.reason.message : String(ev.reason);
  clientLogger.log('error', 'unhandled.rejection', {
    traceId: newTraceId(),
    reason,
  });
});

window.addEventListener('beforeunload', () => {
  clientLogger.flushSync();
});
```

- [ ] **Step 3: Manual smoke**

Run: `cd frontend && npm run dev` (or whichever command the README lists).
Open the app in a browser, open devtools console, evaluate `throw new Error('from-console')`. Expect a POST to `/api/v1/_telemetry/logs` visible in the Network tab within 5s or on reload.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/main.tsx
git commit -m "feat(frontend): global error capture + beforeunload flush"
```

---

### Task 5.5: Route-change log

**Files:**
- Modify: wherever TanStack Router is configured (look under `frontend/src/app/`).

- [ ] **Step 1: Locate router setup**

Run: `grep -rn "createRouter\|RouterProvider" frontend/src --include='*.ts' --include='*.tsx'`

- [ ] **Step 2: Subscribe to navigation**

TanStack Router exposes `router.subscribe('onResolved', ...)` — attach:

```ts
import { clientLogger, newTraceId } from '@/shared/logger';

router.subscribe('onResolved', ({ toLocation }) => {
  clientLogger.log('info', 'nav', {
    traceId: newTraceId(),
    route: toLocation.pathname,
  });
});
```

(Adapt variable names to actual router instance.)

- [ ] **Step 3: Commit**

```bash
git add <file(s)>
git commit -m "feat(frontend): log nav on route change"
```

---

### Task 5.6: User-action logs (login, message send, regenerate)

**Files:**
- Modify: files under `frontend/src/features/auth/`, `frontend/src/features/chats/` (or `features/messages/`).

- [ ] **Step 1: Locate action handlers**

Run: `grep -rn "verify-otp\|post.*chats.*messages\|regenerate" frontend/src --include='*.ts' --include='*.tsx'`

- [ ] **Step 2: Login success**

In the mutation / callback that runs after `auth/verify-otp` returns 200:

```ts
import { clientLogger, newTraceId } from '@/shared/logger';

// after success
clientLogger.log('info', 'user.login', {
  traceId: newTraceId(),
  userId: user.id,
});
```

- [ ] **Step 3: Message send**

At the call site of the send-message API call, mint traceId once and thread it:

```ts
import { clientLogger, newTraceId } from '@/shared/logger';

const traceId = newTraceId();
clientLogger.log('info', 'user.message_send', {
  traceId,
  chatId,
});
// pass through to the API client
await apiClient.post(`chats/${chatId}/messages`, { json: { content }, traceId });
```

(The ky call with `{ traceId }` was enabled in Task 5.3 via `TracedKyOptions`.)

- [ ] **Step 4: Regenerate — same pattern**

```ts
const traceId = newTraceId();
clientLogger.log('info', 'user.regenerate', { traceId, chatId, messageId });
await apiClient.post(`chats/${chatId}/regenerate`, { traceId });
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features
git commit -m "feat(frontend): user action logs (login, message send, regenerate)"
```

---

## Phase 6 — Infrastructure: Filebeat + networks

### Task 6.1: Filebeat configuration

**Files:**
- Modify: `lab/docker-elk-main/extensions/filebeat/config/filebeat.yml`

- [ ] **Step 1: Rewrite filebeat.yml**

```yaml
name: filebeat

filebeat.autodiscover:
  providers:
    - type: docker
      hints.enabled: false
      templates:
        - condition:
            contains:
              docker.container.labels.logging: elk
          config:
            - type: container
              paths:
                - /var/lib/docker/containers/${data.docker.container.id}/*.log
              processors:
                - decode_json_fields:
                    fields: ["message"]
                    target: ""
                    overwrite_keys: true
                    add_error_key: true
                - drop_fields:
                    fields: ["message"]
                    ignore_missing: true

processors:
  - add_host_metadata: ~

output.logstash:
  hosts: ["logstash:5044"]

http:
  enabled: true
  host: 0.0.0.0
```

Rationale: targets containers tagged `logging=elk`, parses their JSON stdout so `@timestamp` / `level` / `msg` become top-level fields, drops raw `message`, ships to Logstash beats input.

- [ ] **Step 2: Commit**

```bash
git add lab/docker-elk-main/extensions/filebeat/config/filebeat.yml
git commit -m "config(filebeat): autodiscover by label=elk, JSON-decode, output to logstash"
```

---

### Task 6.2: Enable filebeat service in main ELK compose

**Files:**
- Modify: `lab/docker-elk-main/docker-compose.yml`

- [ ] **Step 1: Add `filebeat` service inline**

Append (under `services:`, before `grafana:`):

```yaml
  filebeat:
    build:
      context: extensions/filebeat/
      args:
        ELASTIC_VERSION: ${ELASTIC_VERSION}
    user: root
    command:
      - -e
      - --strict.perms=false
    volumes:
      - ./extensions/filebeat/config/filebeat.yml:/usr/share/filebeat/filebeat.yml:ro
      - /var/lib/docker/containers:/var/lib/docker/containers:ro
      - /var/run/docker.sock:/var/run/docker.sock:ro
    networks:
      - elk
    depends_on:
      - logstash
```

Keep the original `extensions/filebeat/filebeat-compose.yml` in place (it's the upstream example). This inline copy is what actually runs for us.

- [ ] **Step 2: Make `elk` network shareable with chat stack**

Change `networks:` block at bottom of the same file from:

```yaml
networks:
  elk:
    driver: bridge
```

to:

```yaml
networks:
  elk:
    name: elk
    driver: bridge
```

This names the network predictably so the chat compose can reference it as external.

- [ ] **Step 3: Commit**

```bash
git add lab/docker-elk-main/docker-compose.yml
git commit -m "config(elk): enable filebeat + name elk network"
```

---

### Task 6.3: Join chat backend to ELK network

**Files:**
- Modify: `docker-compose.yml` (project root)

- [ ] **Step 1: Label + network on backend**

Under `services.backend`, add:

```yaml
    labels:
      logging: "elk"
    networks:
      - default
      - elk
```

At the top level, add:

```yaml
networks:
  elk:
    external: true
    name: elk
```

- [ ] **Step 2: Commit**

```bash
git add docker-compose.yml
git commit -m "config(chat): backend joins elk network, labelled logging=elk"
```

---

## Phase 7 — Grafana provisioning

### Task 7.1: Datasource

**Files:**
- Create: `lab/docker-elk-main/grafana/provisioning/datasources/elasticsearch.yml`

- [ ] **Step 1: Write the file**

```yaml
apiVersion: 1
datasources:
  - name: Elasticsearch
    type: elasticsearch
    access: proxy
    url: http://elasticsearch:9200
    isDefault: true
    database: "logstash-*"
    jsonData:
      esVersion: "8.5.3"
      timeField: "@timestamp"
      logMessageField: msg
      logLevelField: level
      maxConcurrentShardRequests: 5
```

- [ ] **Step 2: Commit**

```bash
git add lab/docker-elk-main/grafana/provisioning/datasources/elasticsearch.yml
git commit -m "config(grafana): provisioned Elasticsearch datasource"
```

---

### Task 7.2: Dashboards loader + mounts

**Files:**
- Create: `lab/docker-elk-main/grafana/provisioning/dashboards/dashboards.yml`
- Modify: `lab/docker-elk-main/docker-compose.yml` — grafana volumes

- [ ] **Step 1: Write dashboards.yml**

```yaml
apiVersion: 1
providers:
  - name: Nova
    orgId: 1
    folder: Nova
    type: file
    disableDeletion: false
    editable: true
    allowUiUpdates: true
    options:
      path: /var/lib/grafana/dashboards
      foldersFromFilesStructure: false
```

- [ ] **Step 2: Mount in grafana service**

In `lab/docker-elk-main/docker-compose.yml`, under `grafana.volumes:` add:

```yaml
      - ./grafana/provisioning:/etc/grafana/provisioning:ro
      - ./grafana/dashboards:/var/lib/grafana/dashboards:ro
```

- [ ] **Step 3: Commit**

```bash
git add lab/docker-elk-main/grafana/provisioning/dashboards/dashboards.yml lab/docker-elk-main/docker-compose.yml
git commit -m "config(grafana): dashboards provider + volume mounts"
```

---

### Task 7.3: Nova Overview dashboard

**Files:**
- Create: `lab/docker-elk-main/grafana/dashboards/nova-overview.json`

- [ ] **Step 1: Write dashboard JSON**

```json
{
  "title": "Nova — Overview",
  "uid": "nova-overview",
  "schemaVersion": 39,
  "version": 1,
  "time": { "from": "now-1h", "to": "now" },
  "refresh": "30s",
  "panels": [
    {
      "id": 1,
      "title": "Requests / sec",
      "type": "timeseries",
      "gridPos": { "x": 0, "y": 0, "w": 12, "h": 8 },
      "datasource": { "type": "elasticsearch", "uid": "Elasticsearch" },
      "targets": [
        {
          "refId": "A",
          "query": "msg:\"request.end\"",
          "metrics": [{ "type": "count", "id": "1" }],
          "bucketAggs": [
            { "type": "date_histogram", "id": "2", "field": "@timestamp",
              "settings": { "interval": "auto" } }
          ]
        }
      ]
    },
    {
      "id": 2,
      "title": "Error rate",
      "type": "timeseries",
      "gridPos": { "x": 12, "y": 0, "w": 12, "h": 8 },
      "datasource": { "type": "elasticsearch", "uid": "Elasticsearch" },
      "targets": [
        {
          "refId": "A",
          "query": "level:error",
          "metrics": [{ "type": "count", "id": "1" }],
          "bucketAggs": [
            { "type": "date_histogram", "id": "2", "field": "@timestamp",
              "settings": { "interval": "auto" } }
          ]
        }
      ]
    },
    {
      "id": 3,
      "title": "p95 durationMs (request.end)",
      "type": "timeseries",
      "gridPos": { "x": 0, "y": 8, "w": 12, "h": 8 },
      "datasource": { "type": "elasticsearch", "uid": "Elasticsearch" },
      "targets": [
        {
          "refId": "A",
          "query": "msg:\"request.end\"",
          "metrics": [
            { "type": "percentiles", "id": "1", "field": "durationMs",
              "settings": { "percents": ["95"] } }
          ],
          "bucketAggs": [
            { "type": "date_histogram", "id": "2", "field": "@timestamp",
              "settings": { "interval": "auto" } }
          ]
        }
      ]
    },
    {
      "id": 4,
      "title": "Count by level",
      "type": "barchart",
      "gridPos": { "x": 12, "y": 8, "w": 12, "h": 8 },
      "datasource": { "type": "elasticsearch", "uid": "Elasticsearch" },
      "targets": [
        {
          "refId": "A",
          "query": "*",
          "metrics": [{ "type": "count", "id": "1" }],
          "bucketAggs": [
            { "type": "terms", "id": "2", "field": "level.keyword",
              "settings": { "order": "desc", "size": "10" } }
          ]
        }
      ]
    },
    {
      "id": 5,
      "title": "Top error messages",
      "type": "table",
      "gridPos": { "x": 0, "y": 16, "w": 24, "h": 8 },
      "datasource": { "type": "elasticsearch", "uid": "Elasticsearch" },
      "targets": [
        {
          "refId": "A",
          "query": "level:error",
          "metrics": [{ "type": "count", "id": "1" }],
          "bucketAggs": [
            { "type": "terms", "id": "2", "field": "msg.keyword",
              "settings": { "order": "desc", "size": "20" } }
          ]
        }
      ]
    }
  ]
}
```

**Note on datasource uid:** Grafana assigns a uid from the datasource name when provisioned — `Elasticsearch` here. If Grafana fails to resolve, check `GET /api/datasources` and patch the `uid` field in each panel.

- [ ] **Step 2: Commit**

```bash
git add lab/docker-elk-main/grafana/dashboards/nova-overview.json
git commit -m "config(grafana): Nova Overview dashboard"
```

---

### Task 7.4: Nova Trace Explorer dashboard

**Files:**
- Create: `lab/docker-elk-main/grafana/dashboards/nova-trace-explorer.json`

- [ ] **Step 1: Write dashboard JSON**

```json
{
  "title": "Nova — Trace Explorer",
  "uid": "nova-trace-explorer",
  "schemaVersion": 39,
  "version": 1,
  "time": { "from": "now-24h", "to": "now" },
  "refresh": "",
  "templating": {
    "list": [
      {
        "name": "traceId",
        "type": "textbox",
        "label": "traceId",
        "query": "",
        "current": { "text": "", "value": "" }
      }
    ]
  },
  "panels": [
    {
      "id": 1,
      "title": "Trace — $traceId",
      "type": "logs",
      "gridPos": { "x": 0, "y": 0, "w": 24, "h": 24 },
      "datasource": { "type": "elasticsearch", "uid": "Elasticsearch" },
      "options": {
        "showTime": true,
        "showLabels": true,
        "showCommonLabels": false,
        "wrapLogMessage": true,
        "sortOrder": "Ascending",
        "dedupStrategy": "none"
      },
      "targets": [
        {
          "refId": "A",
          "query": "traceId:\"$traceId\"",
          "metrics": [{ "type": "logs", "id": "1" }],
          "bucketAggs": []
        }
      ]
    }
  ]
}
```

- [ ] **Step 2: Commit**

```bash
git add lab/docker-elk-main/grafana/dashboards/nova-trace-explorer.json
git commit -m "config(grafana): Nova Trace Explorer dashboard"
```

---

## Phase 8 — Smoke + README

### Task 8.1: Lab README integration section

**Files:**
- Modify: `lab/README.md`

- [ ] **Step 1: Append a "Nova chat integration" section before "Полезные команды"**

```markdown
---

## Интеграция с чатом Nova

Чат-приложение из корня репозитория (`backend/`, `frontend/`) логирует в тот
же ELK-стек через Filebeat. `traceId` коррелирует фронт → бек → LLM в одной
записи.

### Запуск

```bash
# 1. Поднять ELK (создаёт network elk автоматически)
cd lab/docker-elk-main
docker compose up -d

# 2. Поднять чат (подключится к network elk по метке logging=elk)
cd ../..
docker compose up -d
```

### Проверка

1. Открыть http://localhost:5173, залогиниться, отправить сообщение.
2. Kibana (`http://localhost:5601`) → Discover → `logstash-*`:
   - фильтр `source:backend` — логи FastAPI
   - фильтр `source:frontend` — логи браузера
   - фильтр `source:llm` — вызовы модели
3. Скопировать любой `traceId` из Kibana.
4. Grafana (`http://localhost:3000`, admin/admin) → Dashboards → Nova →
   **Trace Explorer**, вставить traceId в переменную — увидеть всю цепочку
   событий в хронологическом порядке.
5. Dashboards → Nova → **Overview** — RPS, error rate, p95, топ ошибок.
```

- [ ] **Step 2: Commit**

```bash
git add lab/README.md
git commit -m "docs(lab): Nova chat integration + smoke-test section"
```

---

### Task 8.2: Full-stack smoke (manual)

**Files:** none (operational)

- [ ] **Step 1: Bring up stacks**

```bash
cd lab/docker-elk-main && docker compose up -d
cd ../.. && docker compose up -d
```

Wait ~2 min on first boot for Elasticsearch to finish initializing.

- [ ] **Step 2: Confirm containers**

Run:
```bash
docker compose ps
cd lab/docker-elk-main && docker compose ps
```
Expected: all services `running` / `healthy`.

- [ ] **Step 3: Generate traffic**

```bash
# Curl the backend directly
curl -i http://localhost:8080/api/v1/health
# Open the frontend, log in via OTP (mailpit http://localhost:8025), send a message
```

- [ ] **Step 4: Verify data in Elasticsearch**

```bash
docker exec -it $(docker ps -qf name=elasticsearch) \
  curl -s 'http://localhost:9200/logstash-*/_count'
# Expect {"count": >0, ...}

docker exec -it $(docker ps -qf name=elasticsearch) \
  curl -s 'http://localhost:9200/logstash-*/_search?q=source:backend&size=1&pretty'
# Expect a hit with @timestamp, level, msg, traceId fields at top level
```

- [ ] **Step 5: Verify Grafana**

Open `http://localhost:3000`, login `admin/admin`, confirm the two Nova dashboards exist under the Nova folder and render data.

- [ ] **Step 6: Write up findings**

If any step fails, file the cause in the task notes and fix in a new task rather than amending completed tasks. No commit unless the smoke revealed a bug needing a fix.

---

## Self-review checklist (run before handing off)

- [ ] Every spec section has at least one implementing task.
- [ ] No `TBD` / `TODO` / `fill in` text remains in any task.
- [ ] Type / function names are consistent across tasks (`bind_trace` / `reset_trace` / `new_trace_id` in backend; `newTraceId` / `clientLogger` in frontend).
- [ ] Traceid field name is **`traceId`** everywhere (not `trace_id`, not `trace-id`).
- [ ] All dashboards reference datasource `Elasticsearch` consistently.
- [ ] Each task ends with a commit.
- [ ] Tests precede implementation where behaviour is non-trivial.
