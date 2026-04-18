from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from app.core.exceptions import BadRequestError
from app.core.security import decode_access_token
from app.db.models import User
from app.services.auth_service import AuthService


def _make_service(session, **overrides) -> AuthService:
    defaults: dict = dict(
        session=session,
        email_sender=AsyncMock(),
        pepper="p",
        code_length=6,
        ttl_minutes=10,
        request_limit=100,
        request_window_minutes=15,
        jwt_secret="x" * 32,
        jwt_algorithm="HS256",
        jwt_ttl_hours=168,
    )
    defaults.update(overrides)
    return AuthService(**defaults)


@pytest.mark.asyncio
async def test_verify_otp_creates_user_on_first_login(db_session):
    service = _make_service(db_session)
    await service.request_otp(email="new@x.com")
    sent_code = service._sender.send_otp.await_args.kwargs["code"]

    token, user = await service.verify_otp(email="new@x.com", code=sent_code)
    assert user.email == "new@x.com"
    payload = decode_access_token(token, secret="x" * 32, algorithm="HS256")
    assert payload["sub"] == str(user.id)


@pytest.mark.asyncio
async def test_verify_otp_reuses_existing_user(db_session):
    service = _make_service(db_session)
    existing = User(email="back@x.com")
    db_session.add(existing)
    await db_session.flush()

    await service.request_otp(email="back@x.com")
    code = service._sender.send_otp.await_args.kwargs["code"]

    _, user = await service.verify_otp(email="back@x.com", code=code)
    assert user.id == existing.id


@pytest.mark.asyncio
async def test_verify_otp_rejects_wrong_code(db_session):
    service = _make_service(db_session)
    await service.request_otp(email="a@b.com")

    with pytest.raises(BadRequestError):
        await service.verify_otp(email="a@b.com", code="000000")


@pytest.mark.asyncio
async def test_verify_otp_consumes_code(db_session):
    service = _make_service(db_session)
    await service.request_otp(email="a@b.com")
    code = service._sender.send_otp.await_args.kwargs["code"]

    await service.verify_otp(email="a@b.com", code=code)

    # второй verify тем же кодом — fail
    with pytest.raises(BadRequestError):
        await service.verify_otp(email="a@b.com", code=code)


@pytest.mark.asyncio
async def test_verify_otp_rejects_expired_code(db_session):
    service = _make_service(db_session, ttl_minutes=-1)  # уже просрочен
    await service.request_otp(email="a@b.com")
    code = service._sender.send_otp.await_args.kwargs["code"]

    with pytest.raises(BadRequestError):
        await service.verify_otp(email="a@b.com", code=code)


@pytest.mark.asyncio
async def test_verify_otp_max_attempts(db_session):
    service = _make_service(db_session, max_attempts=3)
    await service.request_otp(email="a@b.com")

    for _ in range(3):
        with pytest.raises(BadRequestError):
            await service.verify_otp(email="a@b.com", code="000000")

    # теперь даже правильный код не должен работать
    correct = service._sender.send_otp.await_args.kwargs["code"]
    with pytest.raises(BadRequestError):
        await service.verify_otp(email="a@b.com", code=correct)
