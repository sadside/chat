from __future__ import annotations

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_request_otp_ip_rate_limit(async_client: AsyncClient, patch_email_sender):
    # 10 запросов подряд с одного IP → 11-й блокируется
    for i in range(10):
        await async_client.post(
            "/api/v1/auth/request-otp",
            json={"email": f"user{i}@x.com"},
        )
    resp = await async_client.post(
        "/api/v1/auth/request-otp",
        json={"email": "overflow@x.com"},
    )
    assert resp.status_code == 429
