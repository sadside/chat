from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class ChatSummary(BaseModel):
    id: UUID
    title: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ChatCreateOut(ChatSummary):
    pass


class ChatUpdateIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
