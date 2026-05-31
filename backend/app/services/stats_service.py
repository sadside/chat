"""Aggregate per-user statistics for the /stats endpoint."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Chat, Message


class StatsService:
    def __init__(self, session: AsyncSession) -> None:
        self._db = session

    async def collect(self, user_id: UUID) -> dict:
        total_chats = await self._scalar(
            select(func.count()).select_from(Chat).where(Chat.user_id == user_id)
        )
        total_messages = await self._scalar(
            select(func.count())
            .select_from(Message)
            .join(Chat, Chat.id == Message.chat_id)
            .where(Chat.user_id == user_id)
        )
        total_chars_user = await self._scalar(
            select(func.coalesce(func.sum(func.length(Message.content)), 0))
            .select_from(Message)
            .join(Chat, Chat.id == Message.chat_id)
            .where(Chat.user_id == user_id, Message.role == "user")
        )
        total_chars_assistant = await self._scalar(
            select(func.coalesce(func.sum(func.length(Message.content)), 0))
            .select_from(Message)
            .join(Chat, Chat.id == Message.chat_id)
            .where(Chat.user_id == user_id, Message.role == "assistant")
        )
        assistant_count = await self._scalar(
            select(func.count())
            .select_from(Message)
            .join(Chat, Chat.id == Message.chat_id)
            .where(Chat.user_id == user_id, Message.role == "assistant")
        )
        model_rows = (
            await self._db.execute(
                select(Message.model_used, func.count())
                .join(Chat, Chat.id == Message.chat_id)
                .where(
                    Chat.user_id == user_id,
                    Message.role == "assistant",
                    Message.model_used.is_not(None),
                )
                .group_by(Message.model_used)
                .order_by(func.count().desc())
            )
        ).all()

        since = datetime.now(UTC) - timedelta(days=14)
        day_rows = (
            await self._db.execute(
                select(func.date(Message.created_at), func.count())
                .join(Chat, Chat.id == Message.chat_id)
                .where(Chat.user_id == user_id, Message.created_at >= since)
                .group_by(func.date(Message.created_at))
                .order_by(func.date(Message.created_at))
            )
        ).all()

        longest_chat = await self._scalar(
            select(func.count())
            .select_from(Message)
            .join(Chat, Chat.id == Message.chat_id)
            .where(Chat.user_id == user_id)
            .group_by(Message.chat_id)
            .order_by(func.count().desc())
            .limit(1)
        )

        avg = (
            int(total_chars_assistant / assistant_count)
            if (assistant_count and assistant_count > 0)
            else 0
        )

        return {
            "total_chats": int(total_chats or 0),
            "total_messages": int(total_messages or 0),
            "total_chars_sent": int(total_chars_user or 0),
            "total_chars_generated": int(total_chars_assistant or 0),
            "model_usage": [
                {"model": m or "—", "messages": int(c)} for m, c in model_rows
            ],
            "messages_by_day": [
                {"date": str(d), "count": int(c)} for d, c in day_rows
            ],
            "avg_assistant_response_chars": avg,
            "longest_chat_messages": int(longest_chat or 0),
        }

    async def _scalar(self, stmt):
        return (await self._db.execute(stmt)).scalar()
