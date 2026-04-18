from __future__ import annotations

import pytest

from app.services.email.console import ConsoleSender


@pytest.mark.asyncio
async def test_console_sender_logs_otp(capsys):
    sender = ConsoleSender(from_addr="noreply@test")
    await sender.send_otp(to="a@b.com", code="123456")
    captured = capsys.readouterr()
    assert "a@b.com" in captured.out
    assert "123456" in captured.out
