from __future__ import annotations

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_request_otp_returns_204(async_client: AsyncClient, patch_email_sender):
    resp = await async_client.post(
        "/api/v1/auth/request-otp",
        json={"email": "new@user.com"},
    )
    assert resp.status_code == 204
    patch_email_sender.send_otp.assert_awaited_once()


@pytest.mark.asyncio
async def test_request_otp_invalid_email_422(async_client: AsyncClient):
    resp = await async_client.post(
        "/api/v1/auth/request-otp",
        json={"email": "not-email"},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_verify_otp_sets_cookie_and_returns_user(
    async_client: AsyncClient, patch_email_sender
):
    await async_client.post("/api/v1/auth/request-otp", json={"email": "login@x.com"})
    code = patch_email_sender.send_otp.await_args.kwargs["code"]

    resp = await async_client.post(
        "/api/v1/auth/verify-otp",
        json={"email": "login@x.com", "code": code},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["user"]["email"] == "login@x.com"
    assert "access_token" in resp.cookies


@pytest.mark.asyncio
async def test_verify_otp_wrong_code_400(async_client: AsyncClient, patch_email_sender):
    await async_client.post("/api/v1/auth/request-otp", json={"email": "x@x.com"})
    resp = await async_client.post(
        "/api/v1/auth/verify-otp",
        json={"email": "x@x.com", "code": "000000"},
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_me_requires_auth(async_client: AsyncClient):
    resp = await async_client.get("/api/v1/auth/me")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_me_returns_user_when_authenticated(async_client: AsyncClient, patch_email_sender):
    await async_client.post("/api/v1/auth/request-otp", json={"email": "a@a.com"})
    code = patch_email_sender.send_otp.await_args.kwargs["code"]
    await async_client.post("/api/v1/auth/verify-otp", json={"email": "a@a.com", "code": code})

    resp = await async_client.get("/api/v1/auth/me")
    assert resp.status_code == 200
    assert resp.json()["user"]["email"] == "a@a.com"


@pytest.mark.asyncio
async def test_logout_clears_cookie(async_client: AsyncClient, patch_email_sender):
    await async_client.post("/api/v1/auth/request-otp", json={"email": "a@a.com"})
    code = patch_email_sender.send_otp.await_args.kwargs["code"]
    await async_client.post("/api/v1/auth/verify-otp", json={"email": "a@a.com", "code": code})

    resp = await async_client.post("/api/v1/auth/logout")
    assert resp.status_code == 204
    me = await async_client.get("/api/v1/auth/me")
    assert me.status_code == 401
