from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from models.user import User
from routers.deps import get_current_user
from schemas.game import DailyRewardResult
from services.game_service import (
    claim_daily_reward, claim_passive_income,
    get_passive_income_ready, get_passive_income_next_in, get_passive_income_amount
)

router = APIRouter(prefix="/daily", tags=["daily"])


@router.post("/claim", response_model=DailyRewardResult)
async def claim_daily(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Получить ежедневную награду (раз в 24 часа)."""
    return await claim_daily_reward(db, current_user)


@router.post("/passive/claim")
async def claim_passive(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Забрать пассивный доход замка (раз в 5 часов)."""
    return await claim_passive_income(db, current_user)


@router.get("/passive/status")
async def passive_status(current_user: User = Depends(get_current_user)):
    """Статус пассивного дохода: готов ли, сколько монет, когда следующий."""
    return {
        "ready": get_passive_income_ready(current_user),
        "amount": get_passive_income_amount(current_user),
        "next_in_seconds": get_passive_income_next_in(current_user),
    }
