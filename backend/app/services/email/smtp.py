from __future__ import annotations

from email.message import EmailMessage

import aiosmtplib


class SMTPSender:
    def __init__(
        self,
        *,
        host: str,
        port: int,
        username: str,
        password: str,
        from_addr: str,
        use_tls: bool,
    ) -> None:
        self._host = host
        self._port = port
        self._username = username
        self._password = password
        self._from = from_addr
        self._use_tls = use_tls

    async def send_otp(self, *, to: str, code: str) -> None:
        msg = EmailMessage()
        msg["From"] = self._from
        msg["To"] = to
        msg["Subject"] = f"Your Nova login code: {code}"
        msg.set_content(
            f"Your one-time login code is: {code}\n\n"
            f"It expires in a few minutes. If you did not request it, ignore this email.\n"
        )

        await aiosmtplib.send(
            msg,
            hostname=self._host,
            port=self._port,
            username=self._username or None,
            password=self._password or None,
            use_tls=self._use_tls,
            start_tls=False,
        )
