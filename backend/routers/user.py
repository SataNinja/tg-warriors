from datetime import timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from core.database import get_db
from models.user import User
from routers.deps import get_current_user
from schemas.user import UserOut, GameStateOut, NicknameRequest, NicknameResponse
from services.game_service import now_utc, get_current_energy, energy_regen_eta, MAX_ENERGY

router = APIRouter(tags=["user"])


@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    current_user.energy = get_current_energy(current_user)
    return current_user


@router.get("/state", response_model=GameStateOut)
async def get_state(current_user: User = Depends(get_current_user)):
    n = now_utc()

    can_claim_daily = True
    if current_user.last_daily_reward:
        can_claim_daily = n >= current_user.last_daily_reward + timedelta(hours=24)

    raid_cooldown_remaining = 0  # кулдаун отключён

    shield_active = bool(current_user.shield_until and current_user.shield_until > n)

    current_energy = get_current_energy(current_user)
    regen_eta = energy_regen_eta(current_user) if current_energy < MAX_ENERGY else 0

    return GameStateOut(
        user=current_user,
        can_claim_daily=can_claim_daily,
        daily_reward_coins=settings.DAILY_REWARD_COINS,
        raid_cooldown_remaining=raid_cooldown_remaining,
        shield_active=shield_active,
        energy=current_energy,
        max_energy=MAX_ENERGY,
        energy_regen_minutes=regen_eta // 60
    )


@router.post("/me/nickname", response_model=NicknameResponse)
async def set_nickname(
    body: NicknameRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Сменить никнейм (3-20 символов)."""
    current_user.nickname = body.nickname
    await db.commit()
    return NicknameResponse(nickname=body.nickname)
