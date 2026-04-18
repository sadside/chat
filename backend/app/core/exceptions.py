from __future__ import annotations


class AppException(Exception):
    """Domain-level exception that maps cleanly to an HTTP response."""

    code: str = "APP_ERROR"
    status_code: int = 500
    message: str = "Application error"

    def __init__(
        self,
        message: str | None = None,
        *,
        code: str | None = None,
        status_code: int | None = None,
    ) -> None:
        if message is not None:
            self.message = message
        if code is not None:
            self.code = code
        if status_code is not None:
            self.status_code = status_code
        super().__init__(self.message)


class NotFoundError(AppException):
    code = "NOT_FOUND"
    status_code = 404
    message = "Resource not found"


class UnauthorizedError(AppException):
    code = "UNAUTHORIZED"
    status_code = 401
    message = "Authentication required"


class BadRequestError(AppException):
    code = "BAD_REQUEST"
    status_code = 400
    message = "Bad request"


class RateLimitError(AppException):
    code = "RATE_LIMITED"
    status_code = 429
    message = "Too many requests"


class LlmUnavailableError(AppException):
    def __init__(self, message: str = "LLM service is unavailable") -> None:
        super().__init__(
            status_code=503,
            code="LLM_UNAVAILABLE",
            message=message,
        )
