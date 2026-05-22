from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from models.user import User
from routers.deps import get_current_user
from schemas.game import DailyRewardResult
from services.game_service import claim_daily_reward

router = APIRouter(prefix="/daily", tags=["daily"])


@router.post("/claim", response_model=DailyRewardResult)
async def claim_daily(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Получить ежедневную награду (раз в 24 часа)."""
    return await claim_daily_reward(db, current_user)
