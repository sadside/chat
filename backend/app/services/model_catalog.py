"""Static metadata for known LLM model ids.

Ollama doesn't expose descriptions/capabilities, so we keep a small static
catalog. Unknown models fall back to a neutral default.
"""

from __future__ import annotations

CATALOG: dict[str, dict] = {
    "llama3.1:8b": {
        "description": "Универсальная модель Meta — хорошо держит инструкции, сильна в общих задачах.",
        "context_window": 128_000,
        "capabilities": ["chat", "code", "russian"],
    },
    "llama3.2:3b": {
        "description": "Лёгкая Llama 3.2 — быстрая, для коротких запросов.",
        "context_window": 128_000,
        "capabilities": ["chat", "russian"],
    },
    "qwen2.5:7b": {
        "description": "Сильна в коде и многоязычности — лучший выбор для русского.",
        "context_window": 32_768,
        "capabilities": ["chat", "code", "math", "russian"],
    },
    "qwen2.5:14b": {
        "description": "Старшая Qwen — заметно умнее на сложных задачах.",
        "context_window": 32_768,
        "capabilities": ["chat", "code", "math", "russian"],
    },
    "mistral:7b": {
        "description": "Лаконичная и быстрая модель Mistral.",
        "context_window": 32_768,
        "capabilities": ["chat", "russian"],
    },
    "deepseek-r1:7b": {
        "description": "Reasoning-модель с встроенным цепочечным размышлением.",
        "context_window": 32_768,
        "capabilities": ["chat", "math", "code", "reasoning"],
    },
    "deepseek-coder-v2": {
        "description": "Специализированная Coder-модель DeepSeek — лучше всего на коде.",
        "context_window": 128_000,
        "capabilities": ["code"],
    },
    "phi3:mini": {
        "description": "Микро-модель Microsoft Phi-3 — для слабого железа.",
        "context_window": 4_096,
        "capabilities": ["chat"],
    },
}

DEFAULT: dict = {
    "description": "—",
    "context_window": 8192,
    "capabilities": [],
}


def metadata_for(model_id: str) -> dict:
    return CATALOG.get(model_id, DEFAULT)
