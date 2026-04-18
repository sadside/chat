from __future__ import annotations

from unittest.mock import AsyncMock

import pytest
from sqlalchemy import select

from app.core.exceptions import RateLimitError
from app.db.models import OtpCode
from app.services.auth_service import AuthService


def _make_service(session, sender: AsyncMock, **overrides) -> AuthService:
    defaults: dict = dict(
        session=session,
        email_sender=sender,
        pepper="test-pepper",
        code_length=6,
        ttl_minutes=10,
        request_limit=3,
        request_window_minutes=15,
        jwt_secret="x" * 32,
        jwt_algorithm="HS256",
        jwt_ttl_hours=168,
    )
    defaults.update(overrides)
    return AuthService(**defaults)


@pytest.mark.asyncio
async def test_request_otp_sends_email_and_stores_hash(db_session):
    sender = AsyncMock()
    service = _make_service(db_session, sender)

    await service.request_otp(email="A@B.com")

    sender.send_otp.assert_awaited_once()
    kwargs = sender.send_otp.await_args.kwargs
    assert kwargs["to"] == "a@b.com"
    code = kwargs["code"]
    assert len(code) == 6

    stored = (await db_session.execute(select(OtpCode))).scalars().all()
    assert len(stored) == 1
    assert stored[0].email == "a@b.com"
    assert stored[0].code_hash != code
    assert stored[0].consumed_at is None


@pytest.mark.asyncio
async def test_request_otp_normalizes_email(db_session):
    sender = AsyncMock()
    service = _make_service(db_session, sender)
    await service.request_otp(email="  User@Example.COM  ")
    stored = (await db_session.execute(select(OtpCode))).scalars().first()
    assert stored.email == "user@example.com"


@pytest.mark.asyncio
async def test_request_otp_rate_limit(db_session):
    sender = AsyncMock()
    service = _make_service(db_session, sender, request_limit=2)

    await service.request_otp(email="a@b.com")
    await service.request_otp(email="a@b.com")

    with pytest.raises(RateLimitError):
        await service.request_otp(email="a@b.com")


@pytest.mark.asyncio
async def test_request_otp_rate_limit_scoped_by_email(db_session):
    sender = AsyncMock()
    service = _make_service(db_session, sender, request_limit=1)

    await service.request_otp(email="a@b.com")
    # другой email — не должен попасть под лимит
    await service.request_otp(email="b@c.com")
