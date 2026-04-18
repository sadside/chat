import pytest
from pydantic import ValidationError

from app.config import Settings


def test_settings_load_from_env(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://u:p@host/db")
    monkeypatch.setenv("JWT_SECRET", "x" * 32)
    monkeypatch.setenv("OTP_PEPPER", "pepper")
    monkeypatch.setenv("SMTP_FROM", "noreply@example.com")
    monkeypatch.setenv("APP_CORS_ORIGINS", "http://a.com,http://b.com")

    settings = Settings()

    assert settings.database_url == "postgresql+asyncpg://u:p@host/db"
    assert settings.jwt_secret == "x" * 32
    assert settings.otp_pepper == "pepper"
    assert settings.app_cors_origins == ["http://a.com", "http://b.com"]
    assert settings.otp_code_length == 6
    assert settings.otp_ttl_minutes == 10


def test_settings_rejects_short_jwt_secret(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://u:p@host/db")
    monkeypatch.setenv("JWT_SECRET", "short")
    monkeypatch.setenv("OTP_PEPPER", "pepper")
    monkeypatch.setenv("SMTP_FROM", "noreply@example.com")
    with pytest.raises(ValidationError):
        Settings()
