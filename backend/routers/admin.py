"""
Админ-роутер для @SataNinjaKOT (ID: 6320200740).
Доступ только через JWT администратора — обычные эндпоинты, но с проверкой admin_id.
"""
from pydantic import BaseModel
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from core.config import settings
from core.database import get_db
from models.user import User
from routers.deps import get_current_user

router = APIRouter(prefix="/admin", tags=["admin"])


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.id != settings.ADMIN_USER_ID:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Нет прав администратора")
    return current_user


# ── Запросы ───────────────────────────────────────────────────────────────────
class SetCoinsRequest(BaseModel):
    target_id: int
    coins: int

class SetCastleRequest(BaseModel):
    target_id: int
    castle_level: int

class SetIronRequest(BaseModel):
    target_id: int
    iron: int

class SetCrystalsRequest(BaseModel):
    target_id: int
    crystals: int

class PlayerInfoResponse(BaseModel):
    id: int
    name: str
    coins: int
    iron: int
    crystals: int
    castle_level: int
    win_streak: int
    energy: int
    units_count: int


async def _get_target(db: AsyncSession, target_id: int) -> User:
    result = await db.execute(select(User).where(User.id == target_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Игрок {target_id} не найден")
    return user


# ── Эндпоинты ────────────────────────────────────────────────────────────────
@router.get("/player/{target_id}", response_model=PlayerInfoResponse)
async def get_player_info(
    target_id: int,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Получить полную инфу об игроке."""
    u = await _get_target(db, target_id)
    return PlayerInfoResponse(
        id=u.id, name=u.nickname or u.first_name,
        coins=u.coins, iron=u.iron, crystals=getattr(u, 'crystals', 0),
        castle_level=u.castle_level, win_streak=u.win_streak,
        energy=u.energy, units_count=len(u.units)
    )


@router.post("/set-coins")
async def set_coins(
    body: SetCoinsRequest,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Установить количество монет игроку."""
    u = await _get_target(db, body.target_id)
    old = u.coins
    u.coins = body.coins
    await db.commit()
    return {"ok": True, "target": body.target_id, "old_coins": old, "new_coins": body.coins}


@router.post("/set-castle")
async def set_castle(
    body: SetCastleRequest,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Установить уровень замка игроку."""
    if not 1 <= body.castle_level <= 10:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Уровень замка 1-10")
    u = await _get_target(db, body.target_id)
    old = u.castle_level
    u.castle_level = body.castle_level
    await db.commit()
    return {"ok": True, "target": body.target_id, "old_level": old, "new_level": body.castle_level}


@router.post("/set-iron")
async def set_iron(
    body: SetIronRequest,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    u = await _get_target(db, body.target_id)
    u.iron = body.iron
    await db.commit()
    return {"ok": True, "target": body.target_id, "iron": body.iron}


@router.post("/set-crystals")
async def set_crystals(
    body: SetCrystalsRequest,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    u = await _get_target(db, body.target_id)
    u.crystals = body.crystals
    await db.commit()
    return {"ok": True, "target": body.target_id, "crystals": body.crystals}


@router.post("/reset-cooldowns")
async def reset_cooldowns(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Сброс всех кулдаунов для самого администратора."""
    admin.last_raid_at = None
    admin.last_daily_reward = None
    admin.energy = 50
    await db.commit()
    return {"ok": True, "message": "Кулдауны сброшены, энергия восстановлена"}


@router.post("/reset-cooldowns/{target_id}")
async def reset_target_cooldowns(
    target_id: int,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Сброс кулдаунов для любого игрока."""
    u = await _get_target(db, target_id)
    u.last_raid_at = None
    u.last_daily_reward = None
    u.energy = 50
    await db.commit()
    return {"ok": True, "target": target_id, "message": "Кулдауны сброшены"}
