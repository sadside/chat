from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

import jwt
from jwt.exceptions import InvalidTokenError

from app.core.exceptions import UnauthorizedError


def encode_access_token(
    *,
    user_id: UUID,
    secret: str,
    algorithm: str,
    ttl: timedelta,
) -> str:
    now = datetime.now(tz=timezone.utc)
    payload = {
        "sub": str(user_id),
        "iat": int(now.timestamp()),
        "exp": int((now + ttl).timestamp()),
    }
    return jwt.encode(payload, secret, algorithm=algorithm)


def decode_access_token(
    token: str,
    *,
    secret: str,
    algorithm: str,
) -> dict[str, Any]:
    try:
        return jwt.decode(token, secret, algorithms=[algorithm])
    except InvalidTokenError as exc:
        raise UnauthorizedError("Invalid or expired token") from exc


def cookie_kwargs(
    *,
    secure: bool,
    samesite: str,
    max_age_seconds: int,
) -> dict[str, Any]:
    return {
        "httponly": True,
        "secure": secure,
        "samesite": samesite,
        "max_age": max_age_seconds,
        "path": "/",
    }
