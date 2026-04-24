from __future__ import annotations

import json as _json
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
        if len(_json.dumps(v, default=str)) > 2048:
            raise ValueError("fields payload too large (max 2KB)")
        return v


class TelemetryBatch(BaseModel):
    records: list[ClientLogRecord] = Field(..., max_length=100)
