"""SSE streaming for chat messages. Handles send, regenerate, abort."""
from __future__ import annotations

import asyncio
import json
import logging
from collections.abc import AsyncIterator
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.db.models import Chat, Message
from app.db.session import AsyncSessionLocal
from app.schemas.message import MessageOut
from app.services.context_builder import build_context
from app.services.llm_client import LlmClient
from app.services.title_generator import generate_title

logger = logging.getLogger(__name__)

# SSE headers expected by callers:
SSE_HEADERS = {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "X-Accel-Buffering": "no",
    "Connection": "keep-alive",
}


def _sse(event: str, data: dict) -> bytes:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n".encode()


class MessageService:
    def __init__(
        self,
        session: AsyncSession,
        llm: LlmClient,
        context_window: int = 8192,
        temperature: float = 0.7,
        max_tokens: int = 1024,
    ) -> None:
        self._db = session
        self._llm = llm
        self._context_window = context_window
        self._temperature = temperature
        self._max_tokens = max_tokens

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _get_chat_or_404(self, chat_id: UUID, user_id: UUID) -> Chat:
        stmt = select(Chat).where(Chat.id == chat_id)
        chat = (await self._db.execute(stmt)).scalar_one_or_none()
        if chat is None or chat.user_id != user_id:
            raise NotFoundError("Chat not found")
        return chat

    async def _get_messages(self, chat_id: UUID) -> list[Message]:
        stmt = (
            select(Message)
            .where(Message.chat_id == chat_id)
            .order_by(Message.created_at.asc())
        )
        return list((await self._db.execute(stmt)).scalars().all())

    async def _count_exchanges(self, chat_id: UUID) -> int:
        """Return number of complete user+assistant pairs."""
        msgs = await self._get_messages(chat_id)
        return sum(1 for m in msgs if m.role == "user")

    # ------------------------------------------------------------------
    # Public streaming methods
    # ------------------------------------------------------------------

    async def stream_new_message(
        self, user_id: UUID, chat_id: UUID, content: str
    ) -> AsyncIterator[bytes]:
        """
        Full SSE stream: user_message → assistant_start → delta* → assistant_done.
        On LLM error: error event (stream stays open until here, then closes).
        CancelledError: partial assistant saved with aborted=True via fresh session.
        """
        await self._get_chat_or_404(chat_id, user_id)

        # 1. Save user message
        user_msg = Message(chat_id=chat_id, role="user", content=content)
        self._db.add(user_msg)
        await self._db.flush()
        await self._db.refresh(user_msg)

        yield _sse(
            "user_message",
            {
                "id": str(user_msg.id),
                "role": "user",
                "content": user_msg.content,
                "created_at": user_msg.created_at.isoformat(),
            },
        )

        # 2. Build context
        history = await self._get_messages(chat_id)
        messages = build_context(history, self._context_window)

        # 3. Reserve assistant message row (empty, will update on done)
        assistant_msg = Message(chat_id=chat_id, role="assistant", content="", aborted=False)
        self._db.add(assistant_msg)
        await self._db.flush()
        await self._db.refresh(assistant_msg)

        yield _sse("assistant_start", {"id": str(assistant_msg.id)})

        # 4. Stream from LLM
        accumulated: list[str] = []
        aborted = False

        try:
            async for delta in self._llm.stream(
                messages,
                temperature=self._temperature,
                max_tokens=self._max_tokens,
            ):
                accumulated.append(delta)
                yield _sse("delta", {"text": delta})
        except asyncio.CancelledError:
            aborted = True
            raise
        except Exception as exc:
            # LlmUnavailableError or unexpected — emit error event, persist empty partial
            logger.error("LLM streaming error: %s", exc)
            yield _sse("error", {"code": "LLM_UNAVAILABLE", "message": str(exc)})
            # persist partial (may be empty) without aborted flag
            await self._persist_assistant_fresh(
                chat_id, assistant_msg.id, "".join(accumulated), aborted=False
            )
            return
        finally:
            if aborted:
                # FRESH session — the injected session may be in an invalid
                # state after cancellation. Use AsyncSessionLocal directly.
                async with AsyncSessionLocal() as fresh:
                    from app.db.models import Message as MsgModel  # noqa: PLC0415
                    from sqlalchemy import update  # noqa: PLC0415

                    await fresh.execute(
                        update(MsgModel)
                        .where(MsgModel.id == assistant_msg.id)
                        .values(
                            content="".join(accumulated),
                            aborted=True,
                        )
                    )
                    from app.db.models import Chat as ChatModel  # noqa: PLC0415
                    from datetime import datetime, timezone  # noqa: PLC0415

                    await fresh.execute(
                        update(ChatModel)
                        .where(ChatModel.id == chat_id)
                        .values(updated_at=datetime.now(timezone.utc))
                    )
                    await fresh.commit()
                return

        # 5. Persist completed assistant message
        full_content = "".join(accumulated)
        assistant_msg.content = full_content
        assistant_msg.aborted = False
        await self._db.flush()

        # Touch chat updated_at
        from sqlalchemy import update  # noqa: PLC0415
        from app.db.models import Chat as ChatModel  # noqa: PLC0415

        await self._db.execute(
            update(ChatModel)
            .where(ChatModel.id == chat_id)
            .values(updated_at=datetime.now(timezone.utc))
        )
        await self._db.flush()

        # 6. Fire title generation if this is the first exchange
        exchanges_before = await self._count_exchanges_before(chat_id, user_msg.id)
        if exchanges_before == 0:
            asyncio.create_task(
                generate_title(self._llm, chat_id, content, full_content)
            )

        yield _sse(
            "assistant_done",
            {
                "id": str(assistant_msg.id),
                "content": full_content,
                "aborted": False,
            },
        )

    async def stream_regenerate(
        self, user_id: UUID, chat_id: UUID
    ) -> AsyncIterator[bytes]:
        """
        Remove last assistant message, replay streaming with the same history.
        Yields same SSE sequence as stream_new_message (minus user_message event).
        """
        await self._get_chat_or_404(chat_id, user_id)
        messages_in_db = await self._get_messages(chat_id)

        # Find and remove last assistant message
        last_assistant: Message | None = None
        for msg in reversed(messages_in_db):
            if msg.role == "assistant":
                last_assistant = msg
                break
        if last_assistant is None:
            raise NotFoundError("No assistant message to regenerate")

        await self._db.delete(last_assistant)
        await self._db.flush()

        # Rebuild history without removed message
        history = await self._get_messages(chat_id)
        context_messages = build_context(history, self._context_window)

        # Reserve new assistant row
        assistant_msg = Message(chat_id=chat_id, role="assistant", content="", aborted=False)
        self._db.add(assistant_msg)
        await self._db.flush()
        await self._db.refresh(assistant_msg)

        yield _sse("assistant_start", {"id": str(assistant_msg.id)})

        accumulated: list[str] = []
        aborted = False

        try:
            async for delta in self._llm.stream(
                context_messages,
                temperature=self._temperature,
                max_tokens=self._max_tokens,
            ):
                accumulated.append(delta)
                yield _sse("delta", {"text": delta})
        except asyncio.CancelledError:
            aborted = True
            raise
        except Exception as exc:
            logger.error("LLM regenerate error: %s", exc)
            yield _sse("error", {"code": "LLM_UNAVAILABLE", "message": str(exc)})
            await self._persist_assistant_fresh(
                chat_id, assistant_msg.id, "".join(accumulated), aborted=False
            )
            return
        finally:
            if aborted:
                async with AsyncSessionLocal() as fresh:
                    from app.db.models import Message as MsgModel  # noqa: PLC0415
                    from sqlalchemy import update  # noqa: PLC0415

                    await fresh.execute(
                        update(MsgModel)
                        .where(MsgModel.id == assistant_msg.id)
                        .values(content="".join(accumulated), aborted=True)
                    )
                    await fresh.commit()
                return

        full_content = "".join(accumulated)
        assistant_msg.content = full_content
        assistant_msg.aborted = False
        await self._db.flush()

        from sqlalchemy import update  # noqa: PLC0415
        from app.db.models import Chat as ChatModel  # noqa: PLC0415

        await self._db.execute(
            update(ChatModel)
            .where(ChatModel.id == chat_id)
            .values(updated_at=datetime.now(timezone.utc))
        )
        await self._db.flush()

        yield _sse(
            "assistant_done",
            {
                "id": str(assistant_msg.id),
                "content": full_content,
                "aborted": False,
            },
        )

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _count_exchanges_before(
        self, chat_id: UUID, before_user_msg_id: UUID
    ) -> int:
        """Count user messages in this chat before the given user message id."""
        msgs = await self._get_messages(chat_id)
        count = 0
        for msg in msgs:
            if msg.id == before_user_msg_id:
                break
            if msg.role == "user":
                count += 1
        return count

    async def _persist_assistant_fresh(
        self,
        chat_id: UUID,
        assistant_id: UUID,
        content: str,
        aborted: bool,
    ) -> None:
        """Persist assistant message via a fresh session (safe after any error)."""
        async with AsyncSessionLocal() as fresh:
            from app.db.models import Message as MsgModel  # noqa: PLC0415
            from sqlalchemy import update  # noqa: PLC0415

            await fresh.execute(
                update(MsgModel)
                .where(MsgModel.id == assistant_id)
                .values(content=content, aborted=aborted)
            )
            await fresh.commit()
