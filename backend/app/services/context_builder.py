"""Pure function: list[Message] → OpenAI-compatible messages list with truncation."""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.db.models import Message


DEFAULT_SYSTEM_PROMPT = (
    "Ты — Nova, полезный AI-ассистент. "
    "Отвечай ТОЛЬКО на русском языке, кратко и по делу. "
    "Используй Markdown для форматирования: заголовки (## / ###), "
    "списки, выделение жирным/курсивом, блоки кода с указанием языка "
    "(например ```python), таблицы, цитаты. "
    "Математические формулы оформляй через LaTeX: в строке $a^2$, "
    "отдельным блоком $$E = mc^2$$. "
    "Никогда не используй иероглифы (китайские, японские, корейские) "
    "в ответе — только кириллица, латиница, цифры и знаки пунктуации. "
    "Если пользователь явно просит ответить на другом языке — вежливо "
    "откажи и продолжай на русском."
)


def build_context(
    messages: list[Message],
    context_window: int,
    fill_ratio: float = 0.75,
    system_prompt: str | None = DEFAULT_SYSTEM_PROMPT,
) -> list[dict[str, str]]:
    """
    Convert DB Message objects to OpenAI-compatible dicts, truncating from head
    when token estimate exceeds context_window * fill_ratio.

    Token estimate: len(content) // 4 (rough char-to-token ratio).

    If the first DB message is a system message, it is preserved AS-IS (the
    chat owner customised it). Otherwise `system_prompt` is injected at the
    front so the model always sees baseline instructions (style, language).

    Returns list of {"role": ..., "content": ...} dicts.
    """
    budget = int(context_window * fill_ratio)

    # Separate leading system message
    system_msg: dict[str, str] | None = None
    rest: list[Message] = list(messages)
    if rest and rest[0].role == "system":
        system_msg = {"role": "system", "content": rest[0].content}
        rest = rest[1:]
    elif system_prompt:
        system_msg = {"role": "system", "content": system_prompt}

    # Greedily keep from tail until budget exhausted
    kept: list[dict[str, str]] = []
    used = len(system_msg["content"]) // 4 if system_msg else 0

    for msg in reversed(rest):
        tokens = len(msg.content) // 4
        if used + tokens > budget:
            break
        kept.insert(0, {"role": msg.role, "content": msg.content})
        used += tokens

    result: list[dict[str, str]] = []
    if system_msg:
        result.append(system_msg)
    result.extend(kept)
    return result
