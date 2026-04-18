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


def _base_env(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://u:p@host/db")
    monkeypatch.setenv("JWT_SECRET", "x" * 32)
    monkeypatch.setenv("OTP_PEPPER", "pepper")
    monkeypatch.setenv("SMTP_FROM", "noreply@example.com")


def test_settings_rejects_samesite_none_without_secure(monkeypatch):
    _base_env(monkeypatch)
    monkeypatch.setenv("JWT_COOKIE_SAMESITE", "none")
    monkeypatch.setenv("JWT_COOKIE_SECURE", "false")
    with pytest.raises(ValidationError) as excinfo:
        Settings()
    assert "SameSite=None" in str(excinfo.value)


def test_settings_accepts_samesite_none_with_secure(monkeypatch):
    _base_env(monkeypatch)
    monkeypatch.setenv("JWT_COOKIE_SAMESITE", "none")
    monkeypatch.setenv("JWT_COOKIE_SECURE", "true")
    s = Settings()
    assert s.jwt_cookie_samesite == "none"
    assert s.jwt_cookie_secure is True


def test_settings_model_dump_hides_raw_cors(monkeypatch):
    _base_env(monkeypatch)
    monkeypatch.setenv("APP_CORS_ORIGINS", "http://a.com")
    dumped = Settings().model_dump()
    assert "app_cors_origins_raw" not in dumped
    assert dumped["app_cors_origins"] == ["http://a.com"]
