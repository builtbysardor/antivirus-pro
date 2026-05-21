from __future__ import annotations

import logging

from fastapi import APIRouter

from backend.database import get_stats
from backend.models import StatsResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.get("", summary="Get dashboard statistics", response_model=StatsResponse)
async def get_dashboard_stats() -> StatsResponse:
    """Return aggregate scan statistics for the dashboard."""
    data = await get_stats()
    return StatsResponse(**data)
