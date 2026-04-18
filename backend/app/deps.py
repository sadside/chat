from __future__ import annotations

from collections.abc import AsyncGenerator
from uuid import UUID

from fastapi import Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.core.exceptions import UnauthorizedError
from app.core.security import decode_access_token
from app.db.models import User
from app.db.session import AsyncSessionLocal
from app.services.auth_service import AuthService
from app.services.email.base import EmailSender
from app.services.email.console import ConsoleSender
from app.services.email.smtp import SMTPSender


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


def get_email_sender(settings: Settings = Depends(get_settings)) -> EmailSender:
    if settings.email_backend == "console":
        return ConsoleSender(from_addr=settings.smtp_from)
    return SMTPSender(
        host=settings.smtp_host,
        port=settings.smtp_port,
        username=settings.smtp_user,
        password=settings.smtp_password,
        from_addr=settings.smtp_from,
        use_tls=settings.smtp_tls,
    )


def get_auth_service(
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
    sender: EmailSender = Depends(get_email_sender),
) -> AuthService:
    return AuthService(
        session=session,
        email_sender=sender,
        pepper=settings.otp_pepper,
        code_length=settings.otp_code_length,
        ttl_minutes=settings.otp_ttl_minutes,
        request_limit=settings.otp_request_limit,
        request_window_minutes=settings.otp_request_window_min,
        jwt_secret=settings.jwt_secret,
        jwt_algorithm=settings.jwt_algorithm,
        jwt_ttl_hours=settings.jwt_ttl_hours,
        max_attempts=settings.otp_max_attempts,
    )


def extract_user_id_from_request(request: Request, *, settings: Settings) -> UUID:
    token = request.cookies.get(settings.jwt_cookie_name)
    if not token:
        raise UnauthorizedError()
    payload = decode_access_token(
        token, secret=settings.jwt_secret, algorithm=settings.jwt_algorithm
    )
    try:
        return UUID(payload["sub"])
    except (KeyError, ValueError) as exc:
        raise UnauthorizedError() from exc


async def get_current_user(
    request: Request,
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> User:
    user_id = extract_user_id_from_request(request, settings=settings)
    stmt = select(User).where(User.id == user_id)
    user = (await session.execute(stmt)).scalar_one_or_none()
    if user is None:
        raise UnauthorizedError()
    return user
