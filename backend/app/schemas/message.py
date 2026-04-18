from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class MessageOut(BaseModel):
    id: UUID
    chat_id: UUID
    role: str
    content: str
    aborted: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class SendMessageIn(BaseModel):
    content: str = Field(min_length=1, max_length=32_000)
