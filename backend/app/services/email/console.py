from __future__ import annotations


class ConsoleSender:
    def __init__(self, *, from_addr: str) -> None:
        self._from = from_addr

    async def send_otp(self, *, to: str, code: str) -> None:
        # stdout намеренно — это dev-fallback
        print(f"[EMAIL] from={self._from} to={to} OTP={code}")
