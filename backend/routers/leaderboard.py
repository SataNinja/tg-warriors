from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from routers.deps import get_current_user
from models.user import User
from schemas.game import LeaderboardEntry
from services.game_service import get_leaderboard

router = APIRouter(prefix="/leaderboard", tags=["leaderboard"])


@router.get("", response_model=list[LeaderboardEntry])
async def leaderboard(
    sort: str = Query("coins", pattern="^(coins|power|wins)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Топ-50 игроков. sort=coins|power|wins"""
    return await get_leaderboard(db, sort=sort)
