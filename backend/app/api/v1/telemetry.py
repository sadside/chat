"""Accepts batched frontend log records and re-emits them through structlog."""

from __future__ import annotations

from fastapi import APIRouter, Request, status

from app.core.logging import get_logger
from app.core.rate_limit import limiter
from app.schemas.telemetry import ClientLogRecord, TelemetryBatch

router = APIRouter(prefix="/_telemetry", tags=["telemetry"])

_log = get_logger("app.telemetry")


def _emit(rec: ClientLogRecord) -> None:
    bound = _log.bind(
        source=rec.source,
        traceId=rec.traceId,
        clientTs=rec.ts,
        **(rec.fields or {}),
    )
    level = rec.level
    if level == "debug":
        bound.debug(rec.msg)
    elif level == "info":
        bound.info(rec.msg)
    elif level == "warn":
        bound.warning(rec.msg)
    else:  # error
        bound.error(rec.msg)


@router.post("/logs", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("200/minute")
async def ingest_logs(request: Request, batch: TelemetryBatch) -> None:  # noqa: ARG001
    for rec in batch.records:
        _emit(rec)
