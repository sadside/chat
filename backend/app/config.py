from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field, computed_field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # App
    app_env: Literal["development", "production"] = "development"
    app_host: str = "0.0.0.0"
    app_port: int = 8080
    # Stored as raw comma-separated string; parsed into list via computed_field
    app_cors_origins_raw: str = Field(default="", alias="app_cors_origins", exclude=True)
    log_level: str = "INFO"
    log_format: Literal["json", "console"] = "json"

    # Database
    database_url: str

    # JWT
    jwt_secret: str = Field(min_length=32)
    jwt_algorithm: str = "HS256"
    jwt_ttl_hours: int = 168
    jwt_cookie_name: str = "access_token"
    jwt_cookie_secure: bool = False
    jwt_cookie_samesite: Literal["lax", "strict", "none"] = "lax"

    # OTP
    otp_pepper: str
    otp_ttl_minutes: int = 10
    otp_max_attempts: int = 5
    otp_request_limit: int = 3
    otp_request_window_min: int = 15
    otp_code_length: int = 6

    # Email
    email_backend: Literal["smtp", "console"] = "smtp"
    smtp_host: str = "localhost"
    smtp_port: int = 1025
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str
    smtp_tls: bool = False

    # vLLM
    vllm_url: str = "http://localhost:8000/v1"
    vllm_model: str = "bond005/meno-lite-0.1"
    vllm_timeout_seconds: float = 120.0
    vllm_context_window: int = 8192
    vllm_temperature: float = 0.7
    vllm_max_tokens: int = 1024

    @computed_field  # type: ignore[prop-decorator]
    @property
    def app_cors_origins(self) -> list[str]:
        raw = self.app_cors_origins_raw
        if not raw:
            return []
        return [o.strip() for o in raw.split(",") if o.strip()]

    @model_validator(mode="after")
    def _validate_cookie_samesite_secure(self) -> Settings:
        # Modern browsers silently reject `SameSite=None` cookies that are not `Secure`.
        # Surface the misconfiguration at startup instead of letting auth fail at runtime.
        if self.jwt_cookie_samesite == "none" and not self.jwt_cookie_secure:
            raise ValueError(
                "JWT_COOKIE_SAMESITE=none requires JWT_COOKIE_SECURE=true "
                "(browsers reject insecure SameSite=None cookies)."
            )
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
