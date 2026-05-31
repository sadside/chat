from __future__ import annotations

from fastapi import APIRouter

from app.api.v1 import auth, health, telemetry
from app.api.v1 import models as models_api
from app.api.v1 import stats as stats_api
from app.api.v1.chats import router as chats_router
from app.api.v1.messages import router as messages_router

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(chats_router)
api_router.include_router(messages_router)
api_router.include_router(models_api.router)
api_router.include_router(stats_api.router)
api_router.include_router(telemetry.router)
