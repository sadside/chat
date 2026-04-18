from __future__ import annotations

from fastapi import APIRouter, Depends, Request, Response, status

from app.config import Settings, get_settings
from app.core.rate_limit import limiter
from app.core.security import cookie_kwargs
from app.db.models import User
from app.deps import get_auth_service, get_current_user
from app.schemas.auth import MeOut, RequestOtpIn, UserOut, VerifyOtpIn
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/request-otp", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("10/minute")
async def request_otp(
    request: Request,
    payload: RequestOtpIn,
    service: AuthService = Depends(get_auth_service),  # noqa: B008
) -> None:
    await service.request_otp(email=payload.email)


@router.post("/verify-otp", response_model=MeOut)
async def verify_otp(
    payload: VerifyOtpIn,
    response: Response,
    service: AuthService = Depends(get_auth_service),  # noqa: B008
    settings: Settings = Depends(get_settings),  # noqa: B008
) -> MeOut:
    token, user = await service.verify_otp(email=payload.email, code=payload.code)
    response.set_cookie(
        key=settings.jwt_cookie_name,
        value=token,
        **cookie_kwargs(
            secure=settings.jwt_cookie_secure,
            samesite=settings.jwt_cookie_samesite,
            max_age_seconds=settings.jwt_ttl_hours * 3600,
        ),
    )
    return MeOut(user=UserOut.model_validate(user))


@router.get("/me", response_model=MeOut)
async def me(current: User = Depends(get_current_user)) -> MeOut:  # noqa: B008
    return MeOut(user=UserOut.model_validate(current))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    response: Response,
    settings: Settings = Depends(get_settings),  # noqa: B008
) -> None:
    response.delete_cookie(key=settings.jwt_cookie_name, path="/")
