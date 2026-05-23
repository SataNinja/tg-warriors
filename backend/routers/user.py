from datetime import timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from core.database import get_db
from fastapi import HTTPException
from models.user import User
from routers.deps import get_current_user
from schemas.user import UserOut, GameStateOut, NicknameRequest, NicknameResponse
from services.game_service import now_utc, get_current_energy, energy_regen_eta, MAX_ENERGY, get_next_daily_reward

router = APIRouter(tags=["user"])


@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    current_user.energy = get_current_energy(current_user)
    return current_user


@router.get("/state", response_model=GameStateOut)
async def get_state(current_user: User = Depends(get_current_user)):
    n = now_utc()

    daily_next_at = None
    can_claim_daily = True
    if current_user.last_daily_reward:
        daily_next_at = current_user.last_daily_reward + timedelta(hours=24)
        can_claim_daily = n >= daily_next_at

    raid_cooldown_remaining = 0  # кулдаун отключён

    shield_active = bool(current_user.shield_until and current_user.shield_until > n)

    current_energy = get_current_energy(current_user)
    regen_eta = energy_regen_eta(current_user) if current_energy < MAX_ENERGY else 0

    next_reward = get_next_daily_reward(current_user)
    streak = getattr(current_user, 'daily_streak', 0) or 0

    return GameStateOut(
        user=current_user,
        can_claim_daily=can_claim_daily,
        daily_reward_coins=next_reward,
        daily_next_at=daily_next_at,
        daily_streak=streak,
        raid_cooldown_remaining=raid_cooldown_remaining,
        shield_active=shield_active,
        energy=current_energy,
        max_energy=MAX_ENERGY,
        energy_regen_seconds=regen_eta,
        energy_regen_minutes=regen_eta // 60
    )


@router.post("/me/nickname", response_model=NicknameResponse)
async def set_nickname(
    body: NicknameRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Сменить никнейм (3-20 символов). Первый раз бесплатно, потом 100 монет."""
    from models.transaction import Transaction
    cost = 0 if current_user.nickname is None else settings.NICKNAME_CHANGE_COST
    if cost > 0:
        if current_user.coins < cost:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"Смена ника стоит {cost} монет. У тебя {current_user.coins}."
            )
        current_user.coins -= cost
        db.add(Transaction(user_id=current_user.id, amount=-cost,
                           type="nickname", description="Смена никнейма"))
    current_user.nickname = body.nickname
    await db.commit()
    return NicknameResponse(nickname=body.nickname)
