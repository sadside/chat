"""GET /api/v1/stats — per-user usage aggregates."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import User
from app.deps import get_current_user, get_session
from app.services.stats_service import StatsService

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("")
async def get_stats(
    current_user: User = Depends(get_current_user),  # noqa: B008
    session: AsyncSession = Depends(get_session),  # noqa: B008
) -> dict:
    svc = StatsService(session)
    return await svc.collect(current_user.id)
