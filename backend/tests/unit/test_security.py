from __future__ import annotations

from datetime import timedelta
from uuid import uuid4

import pytest

from app.core.exceptions import UnauthorizedError
from app.core.security import decode_access_token, encode_access_token


def test_encode_decode_round_trip():
    user_id = uuid4()
    token = encode_access_token(
        user_id=user_id,
        secret="x" * 32,
        algorithm="HS256",
        ttl=timedelta(hours=1),
    )
    payload = decode_access_token(token, secret="x" * 32, algorithm="HS256")
    assert payload["sub"] == str(user_id)


def test_decode_rejects_wrong_secret():
    user_id = uuid4()
    token = encode_access_token(
        user_id=user_id,
        secret="x" * 32,
        algorithm="HS256",
        ttl=timedelta(hours=1),
    )
    with pytest.raises(UnauthorizedError):
        decode_access_token(token, secret="y" * 32, algorithm="HS256")


def test_decode_rejects_expired_token():
    user_id = uuid4()
    token = encode_access_token(
        user_id=user_id,
        secret="x" * 32,
        algorithm="HS256",
        ttl=timedelta(seconds=-1),
    )
    with pytest.raises(UnauthorizedError):
        decode_access_token(token, secret="x" * 32, algorithm="HS256")


def test_decode_rejects_malformed_token():
    with pytest.raises(UnauthorizedError):
        decode_access_token("not-a-jwt", secret="x" * 32, algorithm="HS256")
