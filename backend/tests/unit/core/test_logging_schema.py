from __future__ import annotations

import json

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
