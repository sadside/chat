"""Best-effort async title generation via LLM. Runs as asyncio.create_task."""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import update

from app.db.session import AsyncSessionLocal
from app.services.llm_client import LlmClient

logger = logging.getLogger(__name__)

_SYSTEM = "Ты генератор заголовков."

_USER_TMPL = (
    "Вот диалог:\n"
    "User: {user_msg}\n"
    "Assistant: {assistant_msg}\n\n"
    "Дай короткий заголовок (3-5 слов). Ответь только заголовком, без кавычек."
)


async def generate_title(
    llm: LlmClient,
    chat_id: UUID,
    user_msg: str,
    assistant_msg: str,
) -> None:
    """
    Best-effort: all errors are caught and logged.
    Uses its own AsyncSessionLocal — safe to run after the request session closes.
    """
    try:
        messages = [
            {"role": "system", "content": _SYSTEM},
            {
                "role": "user",
                "content": _USER_TMPL.format(
                    user_msg=user_msg, assistant_msg=assistant_msg
                ),
            },
        ]
        raw_title = await llm.complete(messages, max_tokens=30, temperature=0.3)
        title = raw_title.strip().strip('"').strip("'").strip()[:200]
        if not title:
            return

        async with AsyncSessionLocal() as session:
            # Import here to avoid circular at module level
            from app.db.models import Chat  # noqa: PLC0415

            await session.execute(
                update(Chat)
                .where(Chat.id == chat_id)
                .values(title=title, updated_at=datetime.now(timezone.utc))
            )
            await session.commit()
    except Exception:  # noqa: BLE001
        logger.exception("TitleGenerator failed for chat %s", chat_id)
