"""Chat CRUD endpoints."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Response
from fastapi.responses import PlainTextResponse

from app.db.models import User
from app.deps import get_chat_service, get_current_user
from app.schemas.chat import ChatSummary, ChatUpdateIn
from app.schemas.message import MessageOut
from app.services.chat_service import ChatService

router = APIRouter(prefix="/chats", tags=["chats"])


@router.get("", response_model=list[ChatSummary])
async def list_chats(
    current_user: User = Depends(get_current_user),  # noqa: B008
    svc: ChatService = Depends(get_chat_service),  # noqa: B008
) -> list[ChatSummary]:
    chats = await svc.list_chats(current_user.id)
    return [ChatSummary.model_validate(c) for c in chats]


@router.post("", response_model=ChatSummary, status_code=201)
async def create_chat(
    current_user: User = Depends(get_current_user),  # noqa: B008
    svc: ChatService = Depends(get_chat_service),  # noqa: B008
) -> ChatSummary:
    chat = await svc.create_chat(current_user.id)
    return ChatSummary.model_validate(chat)


@router.patch("/{chat_id}", response_model=ChatSummary)
async def rename_chat(
    chat_id: UUID,
    body: ChatUpdateIn,
    current_user: User = Depends(get_current_user),  # noqa: B008
    svc: ChatService = Depends(get_chat_service),  # noqa: B008
) -> ChatSummary:
    chat = await svc.rename_chat(chat_id, current_user.id, body)
    return ChatSummary.model_validate(chat)


@router.delete("/{chat_id}", status_code=204)
async def delete_chat(
    chat_id: UUID,
    current_user: User = Depends(get_current_user),  # noqa: B008
    svc: ChatService = Depends(get_chat_service),  # noqa: B008
) -> Response:
    await svc.delete_chat(chat_id, current_user.id)
    return Response(status_code=204)


@router.get("/{chat_id}/messages", response_model=list[MessageOut])
async def list_messages(
    chat_id: UUID,
    current_user: User = Depends(get_current_user),  # noqa: B008
    svc: ChatService = Depends(get_chat_service),  # noqa: B008
) -> list[MessageOut]:
    messages = await svc.list_messages(chat_id, current_user.id)
    return [MessageOut.model_validate(m) for m in messages]


@router.get("/{chat_id}/export")
async def export_chat(
    chat_id: UUID,
    current_user: User = Depends(get_current_user),  # noqa: B008
    svc: ChatService = Depends(get_chat_service),  # noqa: B008
) -> PlainTextResponse:
    md = await svc.export_markdown(chat_id, current_user.id)
    chat = await svc.get_chat_or_404(chat_id, current_user.id)
    safe_title = chat.title.replace("/", "_").replace("\\", "_")
    return PlainTextResponse(
        content=md,
        media_type="text/markdown",
        headers={"Content-Disposition": f'attachment; filename="{safe_title}.md"'},
    )
