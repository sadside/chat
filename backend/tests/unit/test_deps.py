from __future__ import annotations

from datetime import timedelta
from uuid import uuid4

import pytest
from fastapi import Request

from app.core.exceptions import UnauthorizedError
from app.core.security import encode_access_token
from app.deps import extract_user_id_from_request


def _make_settings():
    import os
    os.environ["DATABASE_URL"] = "postgresql+asyncpg://x:x@h/x"
    os.environ["JWT_SECRET"] = "x" * 32
    os.environ["OTP_PEPPER"] = "p"
    os.environ["SMTP_FROM"] = "x@x"
    from app.config import get_settings
    get_settings.cache_clear()
    return get_settings()


def _make_request(cookies: dict[str, str]) -> Request:
    scope = {
        "type": "http",
        "headers": [
            (b"cookie", "; ".join(f"{k}={v}" for k, v in cookies.items()).encode()),
        ],
    }
    return Request(scope)


def test_extract_user_id_from_valid_cookie():
    settings = _make_settings()
    uid = uuid4()
    token = encode_access_token(
        user_id=uid,
        secret=settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
        ttl=timedelta(hours=1),
    )
    req = _make_request({settings.jwt_cookie_name: token})
    assert extract_user_id_from_request(req, settings=settings) == uid


def test_extract_user_id_missing_cookie_raises():
    settings = _make_settings()
    req = _make_request({})
    with pytest.raises(UnauthorizedError):
        extract_user_id_from_request(req, settings=settings)


def test_extract_user_id_invalid_token_raises():
    settings = _make_settings()
    req = _make_request({settings.jwt_cookie_name: "garbage"})
    with pytest.raises(UnauthorizedError):
        extract_user_id_from_request(req, settings=settings)
