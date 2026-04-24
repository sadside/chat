from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.api.v1.router import api_router
from app.config import get_settings
from app.core.exceptions import AppException
from app.core.logging import configure_logging, get_logger
from app.core.middleware import TraceMiddleware
from app.core.rate_limit import limiter


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging(level=settings.log_level, json_logs=settings.log_format == "json")

    app = FastAPI(
        title="Nova API",
        version="0.1.0",
        docs_url="/api/docs" if settings.app_env == "development" else None,
        redoc_url=None,
    )

    # Rate limiter wiring
    app.state.limiter = limiter
    app.add_middleware(SlowAPIMiddleware)

    # Wildcard origins are only safe in development; in production we require an
    # explicit allow-list to avoid accidental credentialed-cross-origin exposure.
    cors_origins = (
        settings.app_cors_origins
        if settings.app_cors_origins
        else (["*"] if settings.app_env == "development" else [])
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # TraceMiddleware must be added LAST so it becomes the OUTERMOST layer
    # (Starlette applies add_middleware in LIFO order). This guarantees that
    # request.start / request.end instrument the full stack including CORS
    # and rate-limit middlewares.
    app.add_middleware(TraceMiddleware)

    @app.exception_handler(AppException)
    async def app_exception_handler(_: Request, exc: AppException) -> JSONResponse:
        logger = get_logger("app.errors")
        logger.warning("app_exception", code=exc.code, message=exc.message)
        return JSONResponse(
            status_code=exc.status_code,
            content={"code": exc.code, "message": exc.message},
        )

    @app.exception_handler(RateLimitExceeded)
    async def rate_limit_handler(_: Request, __: RateLimitExceeded) -> JSONResponse:
        return JSONResponse(
            status_code=429,
            content={"code": "RATE_LIMITED", "message": "Too many requests"},
        )

    app.include_router(api_router)
    return app


app = create_app()
