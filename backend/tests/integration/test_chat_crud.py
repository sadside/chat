"""Integration tests for chat CRUD endpoints."""
from __future__ import annotations

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_list_chats_empty(auth_client: AsyncClient) -> None:
    resp = await auth_client.get("/api/v1/chats")
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_create_chat(auth_client: AsyncClient) -> None:
    resp = await auth_client.post("/api/v1/chats")
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "New chat"
    assert "id" in data
    assert "created_at" in data


@pytest.mark.asyncio
async def test_list_chats_after_create(auth_client: AsyncClient) -> None:
    await auth_client.post("/api/v1/chats")
    await auth_client.post("/api/v1/chats")
    resp = await auth_client.get("/api/v1/chats")
    assert resp.status_code == 200
    assert len(resp.json()) == 2


@pytest.mark.asyncio
async def test_rename_chat(auth_client: AsyncClient) -> None:
    chat_id = (await auth_client.post("/api/v1/chats")).json()["id"]
    resp = await auth_client.patch(
        f"/api/v1/chats/{chat_id}", json={"title": "My Chat"}
    )
    assert resp.status_code == 200
    assert resp.json()["title"] == "My Chat"


@pytest.mark.asyncio
async def test_rename_chat_title_too_short(auth_client: AsyncClient) -> None:
    chat_id = (await auth_client.post("/api/v1/chats")).json()["id"]
    resp = await auth_client.patch(
        f"/api/v1/chats/{chat_id}", json={"title": ""}
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_delete_chat(auth_client: AsyncClient) -> None:
    chat_id = (await auth_client.post("/api/v1/chats")).json()["id"]
    resp = await auth_client.delete(f"/api/v1/chats/{chat_id}")
    assert resp.status_code == 204
    resp2 = await auth_client.get("/api/v1/chats")
    assert resp2.json() == []


@pytest.mark.asyncio
async def test_delete_chat_not_found(auth_client: AsyncClient) -> None:
    import uuid
    resp = await auth_client.delete(f"/api/v1/chats/{uuid.uuid4()}")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_ownership_isolation(
    auth_client: AsyncClient,
    auth_client_b: AsyncClient,
) -> None:
    """User A cannot access User B's chat — returns 404."""
    chat_id = (await auth_client.post("/api/v1/chats")).json()["id"]

    resp = await auth_client_b.get(f"/api/v1/chats/{chat_id}/messages")
    assert resp.status_code == 404

    resp = await auth_client_b.patch(
        f"/api/v1/chats/{chat_id}", json={"title": "hijacked"}
    )
    assert resp.status_code == 404

    resp = await auth_client_b.delete(f"/api/v1/chats/{chat_id}")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_list_messages_empty(auth_client: AsyncClient) -> None:
    chat_id = (await auth_client.post("/api/v1/chats")).json()["id"]
    resp = await auth_client.get(f"/api/v1/chats/{chat_id}/messages")
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_export_empty_chat(auth_client: AsyncClient) -> None:
    chat_id = (await auth_client.post("/api/v1/chats")).json()["id"]
    resp = await auth_client.get(f"/api/v1/chats/{chat_id}/export")
    assert resp.status_code == 200
    assert "New chat" in resp.text
