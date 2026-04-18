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
