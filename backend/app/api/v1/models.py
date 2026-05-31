"""List available LLM models (proxies the OpenAI-compatible /models endpoint)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from app.core.exceptions import LlmUnavailableError
from app.db.models import User
from app.deps import get_current_user, get_llm_client
from app.services.llm_client import LlmClient

router = APIRouter(prefix="/models", tags=["models"])


@router.get("")
async def list_models(
    _current_user: User = Depends(get_current_user),  # noqa: B008
    llm: LlmClient = Depends(get_llm_client),  # noqa: B008
) -> list[dict[str, str]]:
    try:
        ids = await llm.list_models()
    except LlmUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return [{"id": mid, "name": mid} for mid in ids]
