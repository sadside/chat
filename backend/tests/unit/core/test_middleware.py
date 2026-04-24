from __future__ import annotations

import json
import uuid

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.logging import configure_logging
from app.core.middleware import TraceMiddleware


def _make_app() -> FastAPI:
    a = FastAPI()
    a.add_middleware(TraceMiddleware)

    @a.get("/ok")
    def ok():
        return {"hi": True}

    @a.get("/boom")
    def boom():
        raise RuntimeError("kaboom")

    return a


@pytest.fixture
def app():
    return _make_app()


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


def test_request_start_and_end_logged(capsys):
    configure_logging(level="INFO", json_logs=True)
    app = _make_app()
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


def test_unhandled_exception_logged_with_trace(capsys):
    configure_logging(level="INFO", json_logs=True)
    app = _make_app()
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
