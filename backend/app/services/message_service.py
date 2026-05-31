"""SSE streaming for chat messages. Handles send, regenerate, abort."""

from __future__ import annotations

import asyncio
import json
import time
from collections.abc import AsyncIterator
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.exceptions import NotFoundError
from app.core.logging import get_logger
from app.db.models import Chat, Message
from app.db.session import AsyncSessionLocal
from app.services.context_builder import build_context
from app.services.llm_client import LlmClient
from app.services.title_generator import generate_title

_log = get_logger("app.messages")

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
            .order_by(Message.created_at.asc(), Message.id.asc())
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
        self, user_id: UUID, chat_id: UUID, content: str, model: str | None = None
    ) -> AsyncIterator[bytes]:
        """
        Full SSE stream: user_message → assistant_start → delta* → assistant_done.
        On LLM error: error event (stream stays open until here, then closes).
        CancelledError: partial assistant saved with aborted=True via fresh session.
        """
        try:
            await self._get_chat_or_404(chat_id, user_id)
        except NotFoundError as exc:
            yield _sse("error", {"code": exc.code, "message": exc.message})
            return

        _log.info(
            "request.validate_start",
            userId=str(user_id),
            chatId=str(chat_id),
            contentLen=len(content),
        )

        # 1. Save user message.
        # IMPORTANT: pass an explicit Python-side timestamp instead of relying on
        # server_default=func.now(). Inside one Postgres transaction `now()`
        # returns the SAME value for every call, so user_msg and assistant_msg
        # would end up with identical created_at and the UI would render them
        # in non-deterministic order.
        user_msg = Message(
            chat_id=chat_id,
            role="user",
            content=content,
            created_at=datetime.now(UTC),
        )
        self._db.add(user_msg)
        await self._db.flush()
        await self._db.refresh(user_msg)

        _log.info(
            "message.user_saved",
            userId=str(user_id),
            chatId=str(chat_id),
            messageId=str(user_msg.id),
        )

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

        # 3. Reserve assistant message row (empty, will update on done).
        # Explicit timestamp guarantees ordering vs user_msg (see note above).
        assistant_msg = Message(
            chat_id=chat_id,
            role="assistant",
            content="",
            aborted=False,
            created_at=datetime.now(UTC),
        )
        self._db.add(assistant_msg)
        await self._db.flush()
        await self._db.refresh(assistant_msg)

        yield _sse("assistant_start", {"id": str(assistant_msg.id)})

        # 4. Stream from LLM
        accumulated: list[str] = []
        aborted = False

        settings = get_settings()
        _log.info(
            "llm.call_start",
            source="llm",
            chatId=str(chat_id),
            model=model or settings.vllm_model,
        )
        llm_started = time.perf_counter()

        try:
            async for delta in self._llm.stream(
                messages,
                temperature=self._temperature,
                max_tokens=self._max_tokens,
                model=model,
            ):
                accumulated.append(delta)
                yield _sse("delta", {"text": delta})
        except asyncio.CancelledError:
            aborted = True
            raise
        except Exception as exc:
            # LlmUnavailableError or unexpected — emit error event, persist empty partial
            _log.error(
                "llm.call_failed",
                source="llm",
                chatId=str(chat_id),
                error=str(exc),
                durationMs=round((time.perf_counter() - llm_started) * 1000, 2),
            )
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
                    from sqlalchemy import update

                    from app.db.models import Message as MsgModel

                    await fresh.execute(
                        update(MsgModel)
                        .where(MsgModel.id == assistant_msg.id)
                        .values(
                            content="".join(accumulated),
                            aborted=True,
                        )
                    )
                    import datetime as _dt

                    from app.db.models import Chat as ChatModel

                    await fresh.execute(
                        update(ChatModel)
                        .where(ChatModel.id == chat_id)
                        .values(updated_at=_dt.datetime.now(_dt.UTC))
                    )
                    await fresh.commit()
                return  # noqa: B012

        # 5. Persist completed assistant message
        _log.info(
            "llm.call_end",
            source="llm",
            chatId=str(chat_id),
            durationMs=round((time.perf_counter() - llm_started) * 1000, 2),
        )
        full_content = "".join(accumulated)
        assistant_msg.content = full_content
        assistant_msg.aborted = False
        await self._db.flush()

        # Touch chat updated_at
        from sqlalchemy import update

        from app.db.models import Chat as ChatModel

        await self._db.execute(
            update(ChatModel).where(ChatModel.id == chat_id).values(updated_at=datetime.now(UTC))
        )
        await self._db.flush()

        _log.info(
            "message.assistant_saved",
            chatId=str(chat_id),
            messageId=str(assistant_msg.id),
        )

        # 6. Fire title generation if this is the first exchange
        exchanges_before = await self._count_exchanges_before(chat_id, user_msg.id)
        if exchanges_before == 0:
            _task = asyncio.create_task(  # noqa: RUF006
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
        self, user_id: UUID, chat_id: UUID, model: str | None = None
    ) -> AsyncIterator[bytes]:
        """
        Remove last assistant message, replay streaming with the same history.
        Yields same SSE sequence as stream_new_message (minus user_message event).
        """
        try:
            await self._get_chat_or_404(chat_id, user_id)
        except NotFoundError as exc:
            yield _sse("error", {"code": exc.code, "message": exc.message})
            return

        messages_in_db = await self._get_messages(chat_id)

        # Find and remove last assistant message
        last_assistant: Message | None = None
        for msg in reversed(messages_in_db):
            if msg.role == "assistant":
                last_assistant = msg
                break
        if last_assistant is None:
            yield _sse(
                "error", {"code": "NOT_FOUND", "message": "No assistant message to regenerate"}
            )
            return

        await self._db.delete(last_assistant)
        await self._db.flush()

        # Rebuild history without removed message
        history = await self._get_messages(chat_id)
        context_messages = build_context(history, self._context_window)

        # Reserve new assistant row
        assistant_msg = Message(
            chat_id=chat_id,
            role="assistant",
            content="",
            aborted=False,
            created_at=datetime.now(UTC),
        )
        self._db.add(assistant_msg)
        await self._db.flush()
        await self._db.refresh(assistant_msg)

        yield _sse("assistant_start", {"id": str(assistant_msg.id)})

        accumulated: list[str] = []
        aborted = False

        settings = get_settings()
        _log.info(
            "llm.call_start",
            source="llm",
            chatId=str(chat_id),
            model=model or settings.vllm_model,
            regenerate=True,
        )
        llm_started = time.perf_counter()

        try:
            async for delta in self._llm.stream(
                context_messages,
                temperature=self._temperature,
                max_tokens=self._max_tokens,
                model=model,
            ):
                accumulated.append(delta)
                yield _sse("delta", {"text": delta})
        except asyncio.CancelledError:
            aborted = True
            raise
        except Exception as exc:
            _log.error(
                "llm.call_failed",
                source="llm",
                chatId=str(chat_id),
                error=str(exc),
                regenerate=True,
                durationMs=round((time.perf_counter() - llm_started) * 1000, 2),
            )
            yield _sse("error", {"code": "LLM_UNAVAILABLE", "message": str(exc)})
            await self._persist_assistant_fresh(
                chat_id, assistant_msg.id, "".join(accumulated), aborted=False
            )
            return
        finally:
            if aborted:
                async with AsyncSessionLocal() as fresh:
                    from sqlalchemy import update

                    from app.db.models import Message as MsgModel

                    await fresh.execute(
                        update(MsgModel)
                        .where(MsgModel.id == assistant_msg.id)
                        .values(content="".join(accumulated), aborted=True)
                    )
                    await fresh.commit()
                return  # noqa: B012

        _log.info(
            "llm.call_end",
            source="llm",
            chatId=str(chat_id),
            regenerate=True,
            durationMs=round((time.perf_counter() - llm_started) * 1000, 2),
        )
        full_content = "".join(accumulated)
        assistant_msg.content = full_content
        assistant_msg.aborted = False
        await self._db.flush()

        from sqlalchemy import update

        from app.db.models import Chat as ChatModel

        await self._db.execute(
            update(ChatModel).where(ChatModel.id == chat_id).values(updated_at=datetime.now(UTC))
        )
        await self._db.flush()

        _log.info(
            "message.assistant_saved",
            chatId=str(chat_id),
            messageId=str(assistant_msg.id),
            regenerate=True,
        )

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

    async def _count_exchanges_before(self, chat_id: UUID, before_user_msg_id: UUID) -> int:
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
            from sqlalchemy import update

            from app.db.models import Message as MsgModel

            await fresh.execute(
                update(MsgModel)
                .where(MsgModel.id == assistant_id)
                .values(content=content, aborted=aborted)
            )
            await fresh.commit()
