"""Async wrapper around vLLM OpenAI-compatible /v1/chat/completions."""

from __future__ import annotations

import json
import re
from collections.abc import AsyncIterator

import httpx

from app.core.exceptions import LlmUnavailableError

# Unicode ranges to scrub from model output — Nova is a Russian-only product,
# and some local models (notably the qwen family) slip into Chinese mid-reply
# regardless of the system prompt. Stripping CJK characters at the streaming
# layer guarantees the user never sees hieroglyphs.
_CJK_RE = re.compile(
    "["
    "\u4e00-\u9fff"  # CJK Unified Ideographs
    "\u3400-\u4dbf"  # CJK Unified Ideographs Extension A
    "\uf900-\ufaff"  # CJK Compatibility Ideographs
    "\u3040-\u309f"  # Hiragana
    "\u30a0-\u30ff"  # Katakana
    "\uff66-\uff9f"  # Half-width Katakana
    "\uac00-\ud7af"  # Hangul Syllables
    "\u3000-\u303f"  # CJK Symbols and Punctuation (full-width parens etc.)
    "\uff00-\uff5f"  # Full-width Latin / punctuation
    "]+"
)


def _strip_cjk(text: str) -> str:
    """Remove CJK characters and collapse the whitespace they leave behind."""
    if not text:
        return text
    # Fast path: no CJK at all → return as-is.
    if not _CJK_RE.search(text):
        return text
    out = _CJK_RE.sub("", text)
    # Tidy up double spaces the removal may leave.
    out = re.sub(r"[ \t]{2,}", " ", out)
    return out


class LlmClient:
    def __init__(
        self,
        base_url: str,
        model: str,
        timeout: float = 120.0,
        temperature: float = 0.7,
        max_tokens: int = 1024,
    ) -> None:
        self._client = httpx.AsyncClient(
            base_url=base_url,
            timeout=httpx.Timeout(timeout),
            http2=False,  # vLLM may not support h2 in all deployments
        )
        self._model = model
        self._temperature = temperature
        self._max_tokens = max_tokens

    async def stream(
        self,
        messages: list[dict[str, str]],
        *,
        temperature: float | None = None,
        max_tokens: int | None = None,
        model: str | None = None,
    ) -> AsyncIterator[str]:
        """Yield text deltas from vLLM SSE stream."""
        payload = {
            "model": model or self._model,
            "messages": messages,
            "stream": True,
            "temperature": temperature if temperature is not None else self._temperature,
            "max_tokens": max_tokens if max_tokens is not None else self._max_tokens,
        }
        try:
            async with self._client.stream("POST", "/chat/completions", json=payload) as response:
                if response.status_code >= 500:
                    await response.aread()
                    raise LlmUnavailableError(f"vLLM returned {response.status_code}")
                async for line in response.aiter_lines():
                    if not line.startswith("data:"):
                        continue
                    raw = line[len("data:") :].strip()
                    if raw == "[DONE]":
                        return
                    try:
                        chunk = json.loads(raw)
                        delta = chunk["choices"][0]["delta"].get("content")
                        if delta:
                            cleaned = _strip_cjk(delta)
                            if cleaned:
                                yield cleaned
                    except (KeyError, IndexError, json.JSONDecodeError):
                        continue
        except LlmUnavailableError:
            raise
        except (httpx.ConnectError, httpx.TimeoutException, httpx.RemoteProtocolError) as exc:
            raise LlmUnavailableError(str(exc)) from exc

    async def complete(
        self,
        messages: list[dict[str, str]],
        *,
        temperature: float | None = None,
        max_tokens: int | None = None,
        model: str | None = None,
    ) -> str:
        """Non-streaming completion. Used for title generation."""
        payload = {
            "model": model or self._model,
            "messages": messages,
            "stream": False,
            "temperature": temperature if temperature is not None else self._temperature,
            "max_tokens": max_tokens if max_tokens is not None else self._max_tokens,
        }
        try:
            response = await self._client.post("/chat/completions", json=payload)
            if response.status_code >= 500:
                raise LlmUnavailableError(f"vLLM returned {response.status_code}")
            response.raise_for_status()
            data = response.json()
            return _strip_cjk(data["choices"][0]["message"]["content"])
        except LlmUnavailableError:
            raise
        except (httpx.ConnectError, httpx.TimeoutException, httpx.RemoteProtocolError) as exc:
            raise LlmUnavailableError(str(exc)) from exc

    async def list_models(self) -> list[str]:
        """List model ids exposed by the OpenAI-compatible /models endpoint."""
        try:
            response = await self._client.get("/models")
            if response.status_code >= 500:
                raise LlmUnavailableError(f"vLLM returned {response.status_code}")
            response.raise_for_status()
            data = response.json()
            items = data.get("data", []) if isinstance(data, dict) else []
            return [m["id"] for m in items if isinstance(m, dict) and "id" in m]
        except (httpx.ConnectError, httpx.TimeoutException, httpx.RemoteProtocolError) as exc:
            raise LlmUnavailableError(str(exc)) from exc

    async def aclose(self) -> None:
        await self._client.aclose()
