from app.core.exceptions import (
    AppException,
    BadRequestError,
    NotFoundError,
    RateLimitError,
    UnauthorizedError,
)


def test_app_exception_carries_code_and_status():
    exc = AppException(code="X", message="m", status_code=418)
    assert exc.code == "X"
    assert exc.message == "m"
    assert exc.status_code == 418
    assert str(exc) == "m"


def test_not_found_defaults():
    exc = NotFoundError("missing")
    assert exc.status_code == 404
    assert exc.code == "NOT_FOUND"


def test_unauthorized_defaults():
    exc = UnauthorizedError()
    assert exc.status_code == 401
    assert exc.code == "UNAUTHORIZED"


def test_bad_request_defaults():
    exc = BadRequestError("bad")
    assert exc.status_code == 400
    assert exc.code == "BAD_REQUEST"


def test_rate_limit_defaults():
    exc = RateLimitError("slow down")
    assert exc.status_code == 429
    assert exc.code == "RATE_LIMITED"
