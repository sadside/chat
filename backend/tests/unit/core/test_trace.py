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
