"""Pure function: list[Message] → OpenAI-compatible messages list with truncation."""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.db.models import Message


DEFAULT_SYSTEM_PROMPT = (
    "Ты — Nova, полезный AI-ассистент. "
    "Отвечай ТОЛЬКО на русском языке, кратко и по делу. "
    "\n\n"
    "Форматирование ответов:\n"
    "- Используй Markdown: заголовки `##` / `###`, маркированные и "
    "нумерованные списки, **жирный**, *курсив*, цитаты, таблицы.\n"
    "- Блоки кода всегда обрамляй тройными обратными кавычками с указанием "
    "языка: ```python, ```typescript, ```bash и т.д.\n"
    "\n"
    "Математические формулы — СТРОГО в нотации Markdown+KaTeX:\n"
    "- ИНЛАЙН-формула: пиши её ровно между двумя знаками доллара, "
    "например `$a^2 + b^2 = c^2$`.\n"
    "- БЛОЧНАЯ формула: обрамляй двумя знаками доллара с каждой стороны, "
    "на отдельной строке:\n"
    "$$\n"
    "Z_n = \\frac{\\sum_{i=1}^{n} X_i - n\\mu}{\\sigma\\sqrt{n}}\n"
    "$$\n"
    "- НИКОГДА не используй `\\(...\\)`, `\\[...\\]`, одиночные квадратные "
    "скобки `[ ... ]`, круглые скобки `( ... )` или любую другую нотацию "
    "для формул. Только `$...$` и `$$...$$` — иначе формула не отрендерится.\n"
    "- Переменные вне формул (например, «при больших n») пиши в тексте, но "
    "если в тексте встречается LaTeX-команда (`\\mu`, `\\sigma`, `\\frac`, "
    "`\\sum`, `_`, `^`) — обязательно оберни выражение в `$...$`.\n"
    "\n"
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
    chat_system_prompt: str | None = None,
) -> list[dict[str, str]]:
    """
    Convert DB Message objects to OpenAI-compatible dicts, truncating from head
    when token estimate exceeds context_window * fill_ratio.

    Token estimate: len(content) // 4 (rough char-to-token ratio).

    System message handling:
    - If `chat_system_prompt` is non-empty, it's appended as a second system
      message AFTER the default Nova prompt. Lets the user customise a chat's
      role without losing language/format guarantees.
    - If the first DB message is itself a system message, that is preserved
      AS-IS (back-compat for old chats).
    - Otherwise the default `system_prompt` is injected.

    Returns list of {"role": ..., "content": ...} dicts.
    """
    budget = int(context_window * fill_ratio)

    # Build leading system block (1 or 2 messages).
    system_messages: list[dict[str, str]] = []
    rest: list[Message] = list(messages)
    if rest and rest[0].role == "system":
        system_messages.append({"role": "system", "content": rest[0].content})
        rest = rest[1:]
    elif system_prompt:
        system_messages.append({"role": "system", "content": system_prompt})
    if chat_system_prompt:
        system_messages.append({"role": "system", "content": chat_system_prompt})

    # Greedily keep from tail until budget exhausted
    kept: list[dict[str, str]] = []
    used = sum(len(s["content"]) // 4 for s in system_messages)

    for msg in reversed(rest):
        tokens = len(msg.content) // 4
        if used + tokens > budget:
            break
        kept.insert(0, {"role": msg.role, "content": msg.content})
        used += tokens

    return [*system_messages, *kept]
