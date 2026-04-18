from __future__ import annotations

import uuid
from collections.abc import AsyncGenerator
from datetime import timedelta
from unittest.mock import AsyncMock

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import get_settings
from app.core.rate_limit import limiter
from app.core.security import encode_access_token
from app.db.base import Base
from app.db.models import User
from app.db.session import AsyncSessionLocal
from app.deps import get_email_sender, get_session
from app.main import create_app


@pytest_asyncio.fixture(autouse=True)
async def _reset_rate_limiter():
    """Reset slowapi's in-memory state so per-IP limits do not leak between tests."""
    limiter.reset()
    yield
    limiter.reset()


@pytest_asyncio.fixture(scope="session")
async def db_engine():
    settings = get_settings()
    engine = create_async_engine(settings.database_url, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(db_engine) -> AsyncGenerator[AsyncSession, None]:
    connection = await db_engine.connect()
    trans = await connection.begin()
    Session = async_sessionmaker(
        bind=connection,
        expire_on_commit=False,
        join_transaction_mode="create_savepoint",
    )
    async with Session() as session:
        try:
            yield session
        finally:
            await trans.rollback()
            await connection.close()


@pytest_asyncio.fixture
async def patch_email_sender() -> AsyncMock:
    sender = AsyncMock()
    sender.send_otp = AsyncMock()
    return sender


@pytest_asyncio.fixture
async def async_client(
    db_session: AsyncSession,
    patch_email_sender: AsyncMock,
) -> AsyncGenerator[AsyncClient, None]:
    app = create_app()

    async def _session_override():
        yield db_session

    app.dependency_overrides[get_session] = _session_override
    app.dependency_overrides[get_email_sender] = lambda: patch_email_sender

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest_asyncio.fixture
async def app(db_session: AsyncSession, patch_email_sender: AsyncMock):
    """Shared FastAPI app instance with test session override."""
    _app = create_app()

    async def _session_override():
        yield db_session

    _app.dependency_overrides[get_session] = _session_override
    _app.dependency_overrides[get_email_sender] = lambda: patch_email_sender
    return _app


@pytest_asyncio.fixture
async def auth_client(app) -> AsyncGenerator[AsyncClient, None]:
    """Authenticated client for user A."""
    settings = get_settings()

    async with AsyncSessionLocal() as session:
        user = User(email=f"user_a_{uuid.uuid4().hex[:8]}@test.com")
        session.add(user)
        await session.commit()
        await session.refresh(user)

    token = encode_access_token(
        user_id=user.id,
        secret=settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
        ttl=timedelta(hours=settings.jwt_ttl_hours),
    )
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        client.cookies.set(settings.jwt_cookie_name, token)
        yield client


@pytest_asyncio.fixture
async def auth_client_b(app) -> AsyncGenerator[AsyncClient, None]:
    """A second authenticated user (User B) for isolation tests."""
    settings = get_settings()

    async with AsyncSessionLocal() as session:
        user_b = User(email=f"user_b_{uuid.uuid4().hex[:8]}@test.com")
        session.add(user_b)
        await session.commit()
        await session.refresh(user_b)

    token = encode_access_token(
        user_id=user_b.id,
        secret=settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
        ttl=timedelta(hours=settings.jwt_ttl_hours),
    )
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        client.cookies.set(settings.jwt_cookie_name, token)
        yield client


@pytest_asyncio.fixture
def db(db_session: AsyncSession):
    """Context-manager factory that yields the current test transaction session.

    Usage: ``async with db() as session: ...``
    """
    from contextlib import asynccontextmanager

    @asynccontextmanager
    async def _factory():
        yield db_session

    return _factory
