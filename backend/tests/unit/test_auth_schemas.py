from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.schemas.auth import MeOut, RequestOtpIn, UserOut, VerifyOtpIn


def test_request_otp_in_valid():
    dto = RequestOtpIn(email="User@Example.COM")
    assert dto.email == "user@example.com"  # нормализация


def test_request_otp_in_rejects_bad_email():
    with pytest.raises(ValidationError):
        RequestOtpIn(email="not-an-email")


def test_verify_otp_in_requires_6_digits():
    VerifyOtpIn(email="a@b.com", code="123456")
    with pytest.raises(ValidationError):
        VerifyOtpIn(email="a@b.com", code="12345")
    with pytest.raises(ValidationError):
        VerifyOtpIn(email="a@b.com", code="abcdef")


def test_me_out_has_user_field():
    from uuid import uuid4

    uid = uuid4()
    out = MeOut(user=UserOut(id=uid, email="a@b.com"))
    assert out.user.email == "a@b.com"
    assert out.user.id == uid
