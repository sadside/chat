"""Chat CRUD with ownership checks."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.db.models import Chat, Message
from app.schemas.chat import ChatUpdateIn


class ChatService:
    def __init__(self, session: AsyncSession) -> None:
        self._db = session

    async def list_chats(self, user_id: UUID) -> list[Chat]:
        stmt = select(Chat).where(Chat.user_id == user_id).order_by(Chat.updated_at.desc())
        result = await self._db.execute(stmt)
        return list(result.scalars().all())

    async def create_chat(self, user_id: UUID, title: str = "New chat") -> Chat:
        chat = Chat(user_id=user_id, title=title)
        self._db.add(chat)
        await self._db.flush()
        await self._db.refresh(chat)
        return chat

    async def get_chat_or_404(self, chat_id: UUID, user_id: UUID) -> Chat:
        stmt = select(Chat).where(Chat.id == chat_id)
        chat = (await self._db.execute(stmt)).scalar_one_or_none()
        if chat is None or chat.user_id != user_id:
            raise NotFoundError("Chat not found")
        return chat

    async def rename_chat(self, chat_id: UUID, user_id: UUID, data: ChatUpdateIn) -> Chat:
        chat = await self.get_chat_or_404(chat_id, user_id)
        chat.title = data.title
        chat.updated_at = datetime.now(UTC)
        await self._db.flush()
        await self._db.refresh(chat)
        return chat

    async def delete_chat(self, chat_id: UUID, user_id: UUID) -> None:
        await self.get_chat_or_404(chat_id, user_id)
        await self._db.execute(delete(Chat).where(Chat.id == chat_id))

    async def list_messages(self, chat_id: UUID, user_id: UUID) -> list[Message]:
        await self.get_chat_or_404(chat_id, user_id)
        stmt = select(Message).where(Message.chat_id == chat_id).order_by(Message.created_at.asc())
        result = await self._db.execute(stmt)
        return list(result.scalars().all())

    async def export_markdown(self, chat_id: UUID, user_id: UUID) -> str:
        chat = await self.get_chat_or_404(chat_id, user_id)
        messages = await self.list_messages(chat_id, user_id)
        lines: list[str] = [f"# {chat.title}", ""]
        for msg in messages:
            role_header = "**User**" if msg.role == "user" else "**Assistant**"
            lines.append(f"### {role_header}")
            lines.append("")
            lines.append(msg.content)
            if msg.aborted:
                lines.append("")
                lines.append("_[Response was stopped]_")
            lines.append("")
        return "\n".join(lines)

    async def touch_updated_at(self, chat_id: UUID) -> None:
        """Bump updated_at without full fetch — used after new message saved."""
        await self._db.execute(
            update(Chat).where(Chat.id == chat_id).values(updated_at=datetime.now(UTC))
        )
