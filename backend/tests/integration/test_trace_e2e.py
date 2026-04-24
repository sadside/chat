from __future__ import annotations

import json

from fastapi.testclient import TestClient

from app.core.logging import configure_logging
from app.main import app


def test_health_request_logs_share_trace_id(capsys):
    configure_logging(level="INFO", json_logs=True)
    with TestClient(app) as c:
        r = c.get("/api/v1/health")
    assert r.status_code == 200
    tid = r.headers["x-trace-id"]
    lines = [
        json.loads(ln)
        for ln in capsys.readouterr().out.strip().splitlines()
        if ln.strip().startswith("{")
    ]
    related = [l for l in lines if l.get("traceId") == tid]
    msgs = {l.get("msg") for l in related}
    assert "request.start" in msgs
    assert "request.end" in msgs
