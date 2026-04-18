"""Unit tests for LlmClient using httpx mock transport."""
from __future__ import annotations

import json
import pytest
import httpx
from unittest.mock import AsyncMock, patch

from app.core.exceptions import LlmUnavailableError
from app.services.llm_client import LlmClient


def _sse_lines(*deltas: str) -> bytes:
    lines = []
    for d in deltas:
        chunk = {"choices": [{"delta": {"content": d}}]}
        lines.append(f"data: {json.dumps(chunk)}")
    lines.append("data: [DONE]")
    return "\n".join(lines).encode()


class MockTransport(httpx.AsyncBaseTransport):
    def __init__(self, status: int = 200, body: bytes = b""):
        self._status = status
        self._body = body

    async def handle_async_request(self, request: httpx.Request) -> httpx.Response:
        return httpx.Response(self._status, content=self._body)


@pytest.mark.asyncio
async def test_stream_yields_deltas():
    body = _sse_lines("Hello", " world")
    transport = MockTransport(body=body)
    client = LlmClient.__new__(LlmClient)
    client._model = "test-model"
    client._temperature = 0.7
    client._max_tokens = 100
    client._client = httpx.AsyncClient(
        base_url="http://fake", transport=transport
    )
    deltas = []
    async for d in client.stream([{"role": "user", "content": "hi"}]):
        deltas.append(d)
    assert deltas == ["Hello", " world"]
    await client.aclose()


@pytest.mark.asyncio
async def test_stream_raises_on_5xx():
    transport = MockTransport(status=503, body=b"error")
    client = LlmClient.__new__(LlmClient)
    client._model = "test-model"
    client._temperature = 0.7
    client._max_tokens = 100
    client._client = httpx.AsyncClient(
        base_url="http://fake", transport=transport
    )
    with pytest.raises(LlmUnavailableError):
        async for _ in client.stream([{"role": "user", "content": "hi"}]):
            pass
    await client.aclose()


@pytest.mark.asyncio
async def test_complete_returns_content():
    body = json.dumps({
        "choices": [{"message": {"content": "A title"}}]
    }).encode()
    transport = MockTransport(body=body)
    client = LlmClient.__new__(LlmClient)
    client._model = "test-model"
    client._temperature = 0.7
    client._max_tokens = 100
    client._client = httpx.AsyncClient(
        base_url="http://fake", transport=transport
    )
    result = await client.complete([{"role": "user", "content": "prompt"}])
    assert result == "A title"
    await client.aclose()


@pytest.mark.asyncio
async def test_complete_raises_on_5xx():
    transport = MockTransport(status=500, body=b"err")
    client = LlmClient.__new__(LlmClient)
    client._model = "test-model"
    client._temperature = 0.7
    client._max_tokens = 100
    client._client = httpx.AsyncClient(
        base_url="http://fake", transport=transport
    )
    with pytest.raises(LlmUnavailableError):
        await client.complete([{"role": "user", "content": "p"}])
    await client.aclose()
