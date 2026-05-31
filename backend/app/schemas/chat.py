from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class ChatSummary(BaseModel):
    id: UUID
    title: str
    pinned: bool = False
    system_prompt: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ChatCreateOut(ChatSummary):
    pass


class ChatUpdateIn(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    system_prompt: str | None = Field(default=None, max_length=4000)
    pinned: bool | None = None
