"""Async wrapper around vLLM OpenAI-compatible /v1/chat/completions."""

from __future__ import annotations

import json
from collections.abc import AsyncIterator

import httpx

from app.core.exceptions import LlmUnavailableError


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
    ) -> AsyncIterator[str]:
        """Yield text deltas from vLLM SSE stream."""
        payload = {
            "model": self._model,
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
                            yield delta
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
    ) -> str:
        """Non-streaming completion. Used for title generation."""
        payload = {
            "model": self._model,
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
            return data["choices"][0]["message"]["content"]
        except LlmUnavailableError:
            raise
        except (httpx.ConnectError, httpx.TimeoutException, httpx.RemoteProtocolError) as exc:
            raise LlmUnavailableError(str(exc)) from exc

    async def aclose(self) -> None:
        await self._client.aclose()
