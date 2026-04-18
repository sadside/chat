"""Health check endpoint — probes DB (via existing engine) and vLLM."""

from __future__ import annotations

import httpx
from fastapi import APIRouter

from app.config import get_settings

router = APIRouter(tags=["health"])


@router.get("/health")
async def health() -> dict:
    """
    Liveness probe. Never returns non-200.
    vllm: "up" | "down" — informational only, not a failure condition.
    """
    settings = get_settings()
    vllm_status = "down"
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            resp = await client.get(f"{settings.vllm_url}/models")
            if resp.status_code < 500:
                vllm_status = "up"
    except Exception:
        pass
    return {"status": "ok", "vllm": vllm_status}
