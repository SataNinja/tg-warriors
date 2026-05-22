from datetime import timezone, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from core.database import get_db
from models.user import User
from routers.deps import get_current_user
from schemas.user import UserOut, GameStateOut
from services.game_service import now_utc

router = APIRouter(tags=["user"])


@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    """Профиль текущего пользователя."""
    return current_user


@router.get("/state", response_model=GameStateOut)
async def get_state(current_user: User = Depends(get_current_user)):
    """
    Полное состояние игры для текущего пользователя.
    Frontend вызывает это при каждом открытии Mini App.
    """
    n = now_utc()

    can_claim_daily = True
    if current_user.last_daily_reward:
        next_reward_time = current_user.last_daily_reward + timedelta(hours=24)
        can_claim_daily = n >= next_reward_time

    raid_cooldown_remaining = 0
    if current_user.last_raid_at:
        elapsed = (n - current_user.last_raid_at).total_seconds()
        remaining = settings.RAID_COOLDOWN_SECONDS - elapsed
        raid_cooldown_remaining = max(0, int(remaining))

    shield_active = bool(
        current_user.shield_until and current_user.shield_until > n
    )

    return GameStateOut(
        user=current_user,
        can_claim_daily=can_claim_daily,
        daily_reward_coins=settings.DAILY_REWARD_COINS,
        raid_cooldown_remaining=raid_cooldown_remaining,
        shield_active=shield_active
    )
