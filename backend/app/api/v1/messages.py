"""SSE streaming endpoints for chat messages."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from app.db.models import User
from app.deps import get_current_user, get_message_service
from app.schemas.message import EditMessageIn, SendMessageIn
from app.services.message_service import SSE_HEADERS, MessageService

router = APIRouter(prefix="/chats", tags=["messages"])


@router.post("/{chat_id}/messages")
async def send_message(
    chat_id: UUID,
    body: SendMessageIn,
    model: str | None = None,
    current_user: User = Depends(get_current_user),  # noqa: B008
    svc: MessageService = Depends(get_message_service),  # noqa: B008
) -> StreamingResponse:
    return StreamingResponse(
        svc.stream_new_message(current_user.id, chat_id, body.content, model),
        headers=SSE_HEADERS,
    )


@router.post("/{chat_id}/regenerate")
async def regenerate_message(
    chat_id: UUID,
    model: str | None = None,
    current_user: User = Depends(get_current_user),  # noqa: B008
    svc: MessageService = Depends(get_message_service),  # noqa: B008
) -> StreamingResponse:
    return StreamingResponse(
        svc.stream_regenerate(current_user.id, chat_id, model),
        headers=SSE_HEADERS,
    )


@router.patch("/{chat_id}/messages/{message_id}/edit")
async def edit_message(
    chat_id: UUID,
    message_id: UUID,
    body: EditMessageIn,
    model: str | None = None,
    current_user: User = Depends(get_current_user),  # noqa: B008
    svc: MessageService = Depends(get_message_service),  # noqa: B008
) -> StreamingResponse:
    return StreamingResponse(
        svc.stream_edit(current_user.id, chat_id, message_id, body.content, model),
        headers=SSE_HEADERS,
    )
