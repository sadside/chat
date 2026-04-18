from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

import pytest
from sqlalchemy import select

from app.db.models import Chat, Message, OtpCode, User


@pytest.mark.asyncio
async def test_create_user(db_session):
    user = User(email="a@b.com")
    db_session.add(user)
    await db_session.flush()

    assert isinstance(user.id, UUID)
    assert user.email == "a@b.com"
    assert user.created_at is not None


@pytest.mark.asyncio
async def test_create_otp_code(db_session):
    otp = OtpCode(
        email="a@b.com",
        code_hash="x" * 64,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=10),
    )
    db_session.add(otp)
    await db_session.flush()

    assert otp.id is not None
    assert otp.attempts == 0
    assert otp.consumed_at is None


@pytest.mark.asyncio
async def test_create_chat_with_messages(db_session):
    user = User(email="a@b.com")
    db_session.add(user)
    await db_session.flush()

    chat = Chat(user_id=user.id, title="Hello")
    db_session.add(chat)
    await db_session.flush()

    msg1 = Message(chat_id=chat.id, role="user", content="Hi")
    msg2 = Message(chat_id=chat.id, role="assistant", content="Hello!")
    db_session.add_all([msg1, msg2])
    await db_session.flush()

    result = await db_session.execute(
        select(Message).where(Message.chat_id == chat.id).order_by(Message.created_at)
    )
    messages = list(result.scalars())
    assert len(messages) == 2
    assert messages[0].content == "Hi"
    assert messages[1].aborted is False


@pytest.mark.asyncio
async def test_user_email_is_unique(db_session):
    from sqlalchemy.exc import IntegrityError

    db_session.add(User(email="dup@x.com"))
    await db_session.flush()
    db_session.add(User(email="dup@x.com"))
    with pytest.raises(IntegrityError):
        await db_session.flush()
