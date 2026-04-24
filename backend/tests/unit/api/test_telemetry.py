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
    from app.core.logging import configure_logging

    configure_logging(level="INFO", json_logs=True)
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
                    "level": "fatal",
                    "msg": "m",
                    "traceId": "a" * 32,
                }
            ]
        },
    )
    assert r.status_code == 422
