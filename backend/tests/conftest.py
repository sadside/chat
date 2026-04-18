from __future__ import annotations

import asyncio
from collections.abc import AsyncGenerator
from unittest.mock import AsyncMock

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import get_settings
from app.db.base import Base
from app.deps import get_email_sender, get_session
from app.main import create_app


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


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
