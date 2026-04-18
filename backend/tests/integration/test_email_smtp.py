from __future__ import annotations

import httpx
import pytest

from app.services.email.smtp import SMTPSender


@pytest.mark.asyncio
async def test_smtp_sender_delivers_to_mailpit():
    # очищаем Mailpit перед тестом
    async with httpx.AsyncClient() as http:
        await http.delete("http://localhost:8025/api/v1/messages")

    sender = SMTPSender(
        host="localhost",
        port=1025,
        username="",
        password="",
        from_addr="noreply@nova.local",
        use_tls=False,
    )
    await sender.send_otp(to="user@test.com", code="654321")

    # проверяем что письмо долетело
    async with httpx.AsyncClient() as http:
        resp = await http.get("http://localhost:8025/api/v1/messages")
    assert resp.status_code == 200
    messages = resp.json()["messages"]
    assert len(messages) == 1
    assert messages[0]["To"][0]["Address"] == "user@test.com"
    assert "654321" in messages[0]["Snippet"]
