"""TraceMiddleware — generates/propagates traceId and logs request start/end."""

from __future__ import annotations

import time
import uuid
from typing import Any

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response
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
            response = JSONResponse(
                status_code=500,
                content={"code": "INTERNAL_ERROR", "message": "Internal Server Error"},
            )
            response.headers[HEADER] = trace_id
            reset_trace(token)
            return response

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
