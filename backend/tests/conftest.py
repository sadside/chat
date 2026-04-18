from __future__ import annotations

import asyncio
from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import get_settings
from app.db.base import Base
from app.main import create_app


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session", loop_scope="session")
async def db_engine():
    settings = get_settings()
    engine = create_async_engine(settings.database_url, echo=False)
    # Создаём схему один раз на сессию тестов.
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture(loop_scope="session")
async def db_session(db_engine) -> AsyncGenerator[AsyncSession, None]:
    """Каждый тест — отдельная транзакция, откатываемая в конце."""
    connection = await db_engine.connect()
    trans = await connection.begin()
    Session = async_sessionmaker(
        bind=connection,
        expire_on_commit=False,
        autoflush=False,
        join_transaction_mode="create_savepoint",
    )
    async with Session() as session:
        try:
            yield session
        finally:
            await trans.rollback()
            await connection.close()


@pytest_asyncio.fixture(loop_scope="session")
async def async_client() -> AsyncGenerator[AsyncClient, None]:
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
