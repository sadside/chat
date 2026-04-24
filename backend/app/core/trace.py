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
