from __future__ import annotations

import hashlib
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BadRequestError, RateLimitError
from app.core.logging import get_logger
from app.core.security import encode_access_token
from app.db.models import OtpCode, User
from app.services.email.base import EmailSender
from app.services.otp_service import generate_code, hash_code, verify_code

_log = get_logger("app.auth")


def _email_hash(email: str) -> str:
    return hashlib.sha256(email.lower().encode("utf-8")).hexdigest()[:16]


class AuthService:
    def __init__(
        self,
        *,
        session: AsyncSession,
        email_sender: EmailSender,
        pepper: str,
        code_length: int,
        ttl_minutes: int,
        request_limit: int,
        request_window_minutes: int,
        jwt_secret: str,
        jwt_algorithm: str,
        jwt_ttl_hours: int,
        max_attempts: int = 5,
    ) -> None:
        self._session = session
        self._sender = email_sender
        self._pepper = pepper
        self._code_length = code_length
        self._ttl = timedelta(minutes=ttl_minutes)
        self._request_limit = request_limit
        self._request_window = timedelta(minutes=request_window_minutes)
        self._jwt_secret = jwt_secret
        self._jwt_algorithm = jwt_algorithm
        self._jwt_ttl = timedelta(hours=jwt_ttl_hours)
        self._max_attempts = max_attempts

    @staticmethod
    def _normalize_email(email: str) -> str:
        return email.strip().lower()

    async def request_otp(self, *, email: str) -> None:
        email = self._normalize_email(email)
        _log.info("auth.otp_request_start", emailHash=_email_hash(email))
        await self._check_rate_limit(email)

        code = generate_code(length=self._code_length)
        record = OtpCode(
            email=email,
            code_hash=hash_code(code, pepper=self._pepper),
            expires_at=datetime.now(tz=UTC) + self._ttl,
        )
        self._session.add(record)
        await self._session.flush()

        await self._sender.send_otp(to=email, code=code)
        _log.info("auth.otp_request_ok", emailHash=_email_hash(email))

    async def _check_rate_limit(self, email: str) -> None:
        since = datetime.now(tz=UTC) - self._request_window
        stmt = (
            select(func.count())
            .select_from(OtpCode)
            .where(
                OtpCode.email == email,
                OtpCode.created_at >= since,
            )
        )
        count = (await self._session.execute(stmt)).scalar_one()
        if count >= self._request_limit:
            _log.warning(
                "auth.otp_request_failed",
                emailHash=_email_hash(email),
                reason="rate_limited",
            )
            raise RateLimitError("Too many OTP requests. Try again later.")

    async def verify_otp(self, *, email: str, code: str) -> tuple[str, User]:
        email = self._normalize_email(email)
        _log.info("auth.otp_verify_start", emailHash=_email_hash(email))

        otp = await self._get_active_otp(email)
        if otp is None:
            _log.warning(
                "auth.otp_verify_failed",
                emailHash=_email_hash(email),
                reason="no_active_otp",
            )
            raise BadRequestError("No active OTP for this email")

        if otp.attempts >= self._max_attempts:
            _log.warning(
                "auth.otp_verify_failed",
                emailHash=_email_hash(email),
                reason="max_attempts",
            )
            raise BadRequestError("Too many attempts. Request a new code.")

        if datetime.now(tz=UTC) >= otp.expires_at:
            _log.warning(
                "auth.otp_verify_failed",
                emailHash=_email_hash(email),
                reason="expired",
            )
            raise BadRequestError("OTP expired. Request a new code.")

        if not verify_code(code, otp.code_hash, pepper=self._pepper):
            otp.attempts += 1
            await self._session.flush()
            _log.warning(
                "auth.otp_verify_failed",
                emailHash=_email_hash(email),
                reason="invalid_code",
            )
            raise BadRequestError("Invalid code")

        otp.consumed_at = datetime.now(tz=UTC)
        await self._session.flush()

        user = await self._get_or_create_user(email)

        token = encode_access_token(
            user_id=user.id,
            secret=self._jwt_secret,
            algorithm=self._jwt_algorithm,
            ttl=self._jwt_ttl,
        )
        _log.info(
            "auth.otp_verify_ok",
            emailHash=_email_hash(email),
            userId=str(user.id),
        )
        return token, user

    async def _get_active_otp(self, email: str) -> OtpCode | None:
        stmt = (
            select(OtpCode)
            .where(OtpCode.email == email, OtpCode.consumed_at.is_(None))
            .order_by(OtpCode.created_at.desc())
            .limit(1)
        )
        return (await self._session.execute(stmt)).scalar_one_or_none()

    async def _get_or_create_user(self, email: str) -> User:
        stmt = select(User).where(User.email == email)
        user = (await self._session.execute(stmt)).scalar_one_or_none()
        if user is None:
            user = User(email=email)
            self._session.add(user)
            await self._session.flush()
        return user
