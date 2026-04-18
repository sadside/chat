from __future__ import annotations

from typing import Protocol


class EmailSender(Protocol):
    async def send_otp(self, *, to: str, code: str) -> None: ...
